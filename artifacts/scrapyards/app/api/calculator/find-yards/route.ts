import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { yardsTable, citiesTable, statesTable, itemsTable, metalsTable } from "@workspace/db";
import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import { metersBetween } from "@/lib/geo";
import { getZipCoords } from "@/lib/zip-coords-server";
import type { ItemComponent } from "@workspace/db";

export const runtime = "nodejs";

type FindYardsBody = {
  items: Array<{ slug: string; quantity?: number }>;
  zip?: string;
  lat?: number;
  lng?: number;
  radius_miles?: number;
};

const MILES_PER_DEGREE_LAT = 69.0;
const MILES_PER_METER = 1 / 1609.344;

export async function POST(request: Request) {
  let body: FindYardsBody;
  try {
    body = (await request.json()) as FindYardsBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const itemSlugs = (body.items ?? []).map((i) => i.slug).filter(Boolean);
  if (itemSlugs.length === 0) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }

  const radiusMiles = Math.min(500, Math.max(5, Number(body.radius_miles) || 25));

  // Resolve location
  let lat: number | null = body.lat != null ? Number(body.lat) : null;
  let lng: number | null = body.lng != null ? Number(body.lng) : null;
  let approximate = false;
  let resolvedState: string | null = null;
  let coordSource: "zip" | "state-centroid" | "client" = "client";
  if ((lat == null || lng == null) && body.zip) {
    const r = getZipCoords(body.zip);
    if (r) {
      lat = r.lat;
      lng = r.lng;
      resolvedState = r.state;
      coordSource = r.source;
      approximate = r.source === "state-centroid";
    }
  }
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "zip or lat/lng required" }, { status: 400 });
  }

  // Look up needed categories from items + metals
  const itemRows = await db
    .select({ slug: itemsTable.slug, components: itemsTable.components })
    .from(itemsTable)
    .where(inArray(itemsTable.slug, itemSlugs));

  const metalSlugs = new Set<string>();
  for (const it of itemRows) {
    for (const c of (it.components ?? []) as ItemComponent[]) metalSlugs.add(c.metal_slug);
  }
  if (metalSlugs.size === 0) {
    return NextResponse.json({ yards: [], needed_categories: [], note: "No valid metals found in cart." });
  }

  const metalRows = await db
    .select({ slug: metalsTable.slug, category: metalsTable.category })
    .from(metalsTable)
    .where(inArray(metalsTable.slug, Array.from(metalSlugs)));

  const neededCategories = Array.from(new Set(metalRows.map((m) => m.category))).sort();

  // Bounding box pre-filter (cheap), then precise Haversine in JS.
  const dLat = radiusMiles / MILES_PER_DEGREE_LAT;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng = radiusMiles / (MILES_PER_DEGREE_LAT * Math.max(0.01, cosLat));

  const minLat = lat - dLat;
  const maxLat = lat + dLat;
  const minLng = lng - dLng;
  const maxLng = lng + dLng;

  const candidates = await db
    .select({
      id: yardsTable.id,
      slug: yardsTable.slug,
      name: yardsTable.name,
      address: yardsTable.address,
      zip: yardsTable.zip,
      lat: yardsTable.lat,
      lng: yardsTable.lng,
      phone: yardsTable.phone,
      accepted: yardsTable.accepted,
      ratingAvg: yardsTable.ratingAvg,
      ratingCount: yardsTable.ratingCount,
      stateCode: yardsTable.stateCode,
      stateSlug: statesTable.slug,
      cityName: citiesTable.name,
      citySlug: citiesTable.slug,
    })
    .from(yardsTable)
    .innerJoin(statesTable, eq(statesTable.code, yardsTable.stateCode))
    .innerJoin(citiesTable, eq(citiesTable.id, yardsTable.cityId))
    .where(
      and(
        eq(yardsTable.status, "active"),
        sql`${yardsTable.lat} IS NOT NULL`,
        sql`${yardsTable.lng} IS NOT NULL`,
        gte(yardsTable.lat, String(minLat)),
        lte(yardsTable.lat, String(maxLat)),
        gte(yardsTable.lng, String(minLng)),
        lte(yardsTable.lng, String(maxLng)),
      ),
    )
    .limit(500);

  type Hit = (typeof candidates)[number] & {
    distance_mi: number;
    accepts_subset: string[];
    accepts_unknown: boolean;
  };

  const hits: Hit[] = [];
  for (const y of candidates) {
    const meters = metersBetween({ lat, lng }, { lat: y.lat, lng: y.lng });
    const distance_mi = meters * MILES_PER_METER;
    if (distance_mi > radiusMiles) continue;

    const accepted = (y.accepted ?? []) as string[];
    const acceptsUnknown = accepted.length === 0;
    const acceptsSubset = acceptsUnknown
      ? neededCategories.slice() // unknown — assume accepts all
      : neededCategories.filter((c) => accepted.includes(c));

    hits.push({ ...y, distance_mi, accepts_subset: acceptsSubset, accepts_unknown: acceptsUnknown });
  }

  // Strict matches: yard accepts ALL needed categories (or has unknown/empty accepted list).
  const strict = hits.filter(
    (h) => h.accepts_unknown || h.accepts_subset.length === neededCategories.length,
  );
  const partial = hits.filter(
    (h) => !h.accepts_unknown && h.accepts_subset.length > 0 && h.accepts_subset.length < neededCategories.length,
  );

  const sortByDist = (a: Hit, b: Hit) => a.distance_mi - b.distance_mi;
  strict.sort(sortByDist);
  partial.sort(sortByDist);

  const yards = strict.length > 0 ? strict.slice(0, 20) : partial.slice(0, 20);
  const fellBackToPartial = strict.length === 0 && partial.length > 0;

  return NextResponse.json({
    yards: yards.map((y) => ({
      id: y.id,
      slug: y.slug,
      name: y.name,
      address: y.address,
      zip: y.zip,
      phone: y.phone,
      lat: y.lat == null ? null : Number(y.lat),
      lng: y.lng == null ? null : Number(y.lng),
      distance_mi: Math.round(y.distance_mi * 10) / 10,
      city_name: y.cityName,
      url: `/scrap-yards/${y.stateSlug}/${y.citySlug}/${y.slug}/`,
      rating_avg: y.ratingAvg == null ? null : Number(y.ratingAvg),
      rating_count: y.ratingCount ?? 0,
      accepts_subset: y.accepts_subset,
      accepts_unknown: y.accepts_unknown,
    })),
    needed_categories: neededCategories,
    radius_miles: radiusMiles,
    location_approximate: approximate,
    resolved_state: resolvedState,
    coord_source: coordSource,
    zip: body.zip ?? null,
    fell_back_to_partial: fellBackToPartial,
  });
}
