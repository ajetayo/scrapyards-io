import { db } from "@/lib/db";
import {
  yardsTable,
  citiesTable,
  statesTable,
  metalCategoriesTable,
} from "@workspace/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { metersBetween } from "@/lib/geo";
import { getZipCoords } from "@/lib/zip-coords-server";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search Scrap Yards Near You",
  description:
    "Find scrap yards within a chosen radius of your ZIP code, optionally filtered by material accepted.",
  robots: { index: false, follow: false },
};

const ALLOWED_RADII = [10, 25, 50, 100] as const;
const MILES_PER_DEGREE_LAT = 69.0;
const MILES_PER_METER = 1 / 1609.344;

type SearchProps = {
  searchParams: Promise<{
    zip?: string | string[];
    material?: string | string[];
    radius?: string | string[];
  }>;
};

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function SearchPage({ searchParams }: SearchProps) {
  const sp = await searchParams;
  const rawZip = (firstParam(sp.zip) ?? "").trim().slice(0, 5);
  const rawMaterial = (firstParam(sp.material) ?? "").trim();
  const rawRadius = parseInt(firstParam(sp.radius) ?? "25", 10);
  const radius = (ALLOWED_RADII as readonly number[]).includes(rawRadius)
    ? rawRadius
    : 25;

  // Load categories for context (label + validation)
  const categories = await db
    .select({
      slug: metalCategoriesTable.slug,
      name: metalCategoriesTable.name,
    })
    .from(metalCategoriesTable)
    .orderBy(metalCategoriesTable.displayOrder);
  const categoryMap = new Map(categories.map((c) => [c.slug, c.name]));

  const materialValid = rawMaterial && categoryMap.has(rawMaterial);
  const materialFallback = Boolean(rawMaterial) && !materialValid;
  const material = materialValid ? rawMaterial : "";

  const header = (
    <>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › Search
      </nav>
      <h1 style={{ marginBottom: "0.5rem" }}>Search Scrap Yards</h1>
    </>
  );

  // Validate ZIP
  if (!/^\d{5}$/.test(rawZip)) {
    return (
      <div className="container" style={{ padding: "2rem 1.25rem" }}>
        {header}
        <div
          className="card"
          style={{ marginTop: "1rem", borderColor: "#f0c8c4", background: "#fff5f3" }}
        >
          <p style={{ marginBottom: "0.5rem" }}>
            <strong>Please enter a valid 5-digit US ZIP code.</strong>
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
            Head back to the <Link href="/">homepage</Link> and try again, or browse the{" "}
            <Link href="/scrap-yards/">state-by-state directory</Link>.
          </p>
        </div>
      </div>
    );
  }

  const coords = getZipCoords(rawZip);
  if (!coords) {
    return (
      <div className="container" style={{ padding: "2rem 1.25rem" }}>
        {header}
        <div
          className="card"
          style={{ marginTop: "1rem", borderColor: "#f0c8c4", background: "#fff5f3" }}
        >
          <p style={{ marginBottom: "0.5rem" }}>
            <strong>We couldn&apos;t locate ZIP {rawZip}.</strong>
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
            Double-check the ZIP, or browse the{" "}
            <Link href="/scrap-yards/">state-by-state directory</Link>.
          </p>
        </div>
      </div>
    );
  }

  // Bounding-box pre-filter, then precise Haversine in JS
  const dLat = radius / MILES_PER_DEGREE_LAT;
  const cosLat = Math.cos((coords.lat * Math.PI) / 180);
  const dLng = radius / (MILES_PER_DEGREE_LAT * Math.max(0.01, cosLat));

  const minLat = coords.lat - dLat;
  const maxLat = coords.lat + dLat;
  const minLng = coords.lng - dLng;
  const maxLng = coords.lng + dLng;

  const candidates = await db
    .select({
      id: yardsTable.id,
      slug: yardsTable.slug,
      name: yardsTable.name,
      address: yardsTable.address,
      zip: yardsTable.zip,
      phone: yardsTable.phone,
      lat: yardsTable.lat,
      lng: yardsTable.lng,
      accepted: yardsTable.accepted,
      ratingAvg: yardsTable.ratingAvg,
      ratingCount: yardsTable.ratingCount,
      isPremium: yardsTable.isPremium,
      isVerified: yardsTable.isVerified,
      stateCode: yardsTable.stateCode,
      stateSlug: statesTable.slug,
      stateName: statesTable.name,
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
    .limit(1000);

  type Hit = (typeof candidates)[number] & {
    distance_mi: number;
    accepts_unknown: boolean;
    matches_material: boolean;
  };

  const hits: Hit[] = [];
  for (const y of candidates) {
    const meters = metersBetween({ lat: coords.lat, lng: coords.lng }, { lat: y.lat, lng: y.lng });
    const distance_mi = meters * MILES_PER_METER;
    if (distance_mi > radius) continue;
    const accepted = (y.accepted ?? []) as string[];
    const accepts_unknown = accepted.length === 0;
    const matches_material = material
      ? accepts_unknown || accepted.includes(material)
      : true;
    if (!matches_material) continue;
    hits.push({ ...y, distance_mi, accepts_unknown, matches_material });
  }

  hits.sort((a, b) => a.distance_mi - b.distance_mi);
  const yards = hits.slice(0, 50);

  const materialName = material ? categoryMap.get(material) : null;
  const [stateRow] = await db
    .select({ name: statesTable.name, slug: statesTable.slug })
    .from(statesTable)
    .where(eq(statesTable.code, coords.state))
    .limit(1);
  const stateNameForFallback = stateRow?.name ?? coords.state;
  const stateSlugForFallback = stateRow?.slug ?? coords.state.toLowerCase();

  return (
    <div className="container" style={{ padding: "2rem 1.25rem" }}>
      {header}
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1rem" }}>
        {yards.length === 0 ? "No yards found" : `${yards.length} yard${yards.length === 1 ? "" : "s"}`}
        {" within "}
        {radius} miles of ZIP {rawZip}
        {materialName ? ` accepting ${materialName}` : ""}.
        {coords.source === "state-centroid" && (
          <span style={{ display: "block", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Approximate location — using {coords.state} state center for this ZIP.
          </span>
        )}
        {materialFallback && (
          <span style={{ display: "block", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Unknown material filter ignored — showing all yards in range.
          </span>
        )}
      </p>

      {yards.length === 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p style={{ marginBottom: "0.5rem" }}>
            <strong>No yards within {radius} miles{materialName ? ` accepting ${materialName}` : ""}.</strong>
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
            Try a wider radius or check the{" "}
            <Link href={`/scrap-yards/${stateSlugForFallback}/`}>
              {stateNameForFallback} directory
            </Link>{" "}
            for the full list.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {yards.map((y) => (
            <Link
              key={y.id}
              href={`/scrap-yards/${y.stateSlug}/${y.citySlug}/${y.slug}/`}
              className="card"
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <h3 style={{ marginBottom: "0.25rem" }}>
                    {y.name}
                    {y.isPremium && <span className="badge" style={{ marginLeft: "0.5rem" }}>Premium</span>}
                    {y.isVerified && <span className="badge" style={{ marginLeft: "0.5rem", background: "#e8f5e9", color: "#1a7a3a" }}>Verified</span>}
                  </h3>
                  {y.address && (
                    <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                      {y.address}, {y.cityName}, {y.stateCode} {y.zip}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <div style={{ fontWeight: 600, color: "var(--color-accent)" }}>
                    {y.distance_mi < 10
                      ? y.distance_mi.toFixed(1)
                      : Math.round(y.distance_mi)}{" "}
                    mi
                  </div>
                  {y.ratingAvg && y.ratingCount && y.ratingCount > 0 && (
                    <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                      ★ {Number(y.ratingAvg).toFixed(1)} ({y.ratingCount})
                    </div>
                  )}
                </div>
              </div>
              {y.accepts_unknown && (
                <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                  Accepted materials list not on file — call ahead to confirm.
                </p>
              )}
              {!y.accepts_unknown && y.accepted && y.accepted.length > 0 && (
                <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {y.accepted.slice(0, 6).map((m) => (
                    <span
                      key={m}
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.15rem 0.4rem",
                        background: material === m ? "var(--color-accent)" : "var(--color-bg)",
                        color: material === m ? "white" : "inherit",
                        border: "1px solid var(--color-border)",
                        borderRadius: "100px",
                      }}
                    >
                      {categoryMap.get(m) ?? m}
                    </span>
                  ))}
                  {y.accepted.length > 6 && (
                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                      +{y.accepted.length - 6} more
                    </span>
                  )}
                </div>
              )}
              {y.phone && (
                <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--color-accent)" }}>
                  {y.phone}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
