import { db } from "@/lib/db";
import { legacyRedirectsTable, statesTable, citiesTable, yardsTable, metalsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NextRequest } from "next/server";

// State slug aliases observed in the WP/GeoDirectory dump (mapping spec §B1).
// Only these state slugs ever appear with a "-N" suffix; for any other state,
// "-N" is real (no real US state is named "foo-1") and must NOT be stripped.
const STATE_SLUG_ALIASES: Record<string, string> = {
  "delaware-2": "delaware",
  "indiana-1": "indiana",
  "kansas-1": "kansas",
  "michigan-1": "michigan",
  "nevada-2": "nevada",
  "north-dakota-1": "north-dakota",
  "south-dakota-1": "south-dakota",
  "virginia-2": "virginia",
  "washington-7": "washington",
};

function stripSuffix(s: string): string {
  return s.replace(/-\d+$/, "");
}

// Try to synthesize a redirect for /scrap-yards/<state>/<city>?/<yard>?/ paths
// when the literal slug doesn't exist but a normalized one does.
//   - state: only stripped if it matches the §B1 alias map
//   - city:  always stripped (suffixes are universal slug-collision artifacts)
//   - yard:  stripped only if the cleaned slug exists for that (state, city)
async function tryNormalize(rawPath: string): Promise<string | null> {
  const m = rawPath.match(/^\/scrap-yards\/([^/]+)\/?(?:([^/]+)\/?(?:([^/]+)\/?)?)?$/);
  if (!m) return null;
  const stateRaw = m[1]!;
  const cityRaw = m[2];
  const yardRaw = m[3];

  let stateNorm = STATE_SLUG_ALIASES[stateRaw] ?? stateRaw;

  // Verify the (possibly normalized) state exists. If not, nothing to do.
  const [stateRow] = await db
    .select({ code: statesTable.code, slug: statesTable.slug })
    .from(statesTable)
    .where(eq(statesTable.slug, stateNorm))
    .limit(1);
  if (!stateRow) return null;

  if (!cityRaw) {
    return stateNorm !== stateRaw ? `/scrap-yards/${stateNorm}/` : null;
  }

  const cityNorm = stripSuffix(cityRaw);
  const [cityRow] = await db
    .select({ id: citiesTable.id, slug: citiesTable.slug })
    .from(citiesTable)
    .where(and(eq(citiesTable.stateCode, stateRow.code), eq(citiesTable.slug, cityNorm)))
    .limit(1);
  if (!cityRow) {
    return stateNorm !== stateRaw ? `/scrap-yards/${stateNorm}/` : null;
  }

  if (!yardRaw) {
    if (stateNorm !== stateRaw || cityNorm !== cityRaw) {
      return `/scrap-yards/${stateNorm}/${cityNorm}/`;
    }
    return null;
  }

  // Yard: try the literal slug first; only strip "-N" if the cleaned form exists.
  let yardNorm = yardRaw;
  const [yardLit] = await db
    .select({ slug: yardsTable.slug })
    .from(yardsTable)
    .where(and(
      eq(yardsTable.stateCode, stateRow.code),
      eq(yardsTable.cityId, cityRow.id),
      eq(yardsTable.slug, yardRaw),
    ))
    .limit(1);
  if (!yardLit) {
    const cleaned = stripSuffix(yardRaw);
    if (cleaned !== yardRaw) {
      const [yardClean] = await db
        .select({ slug: yardsTable.slug })
        .from(yardsTable)
        .where(and(
          eq(yardsTable.stateCode, stateRow.code),
          eq(yardsTable.cityId, cityRow.id),
          eq(yardsTable.slug, cleaned),
        ))
        .limit(1);
      if (yardClean) yardNorm = cleaned;
    }
  }

  if (stateNorm === stateRaw && cityNorm === cityRaw && yardNorm === yardRaw) {
    return null;
  }
  return `/scrap-yards/${stateNorm}/${cityNorm}/${yardNorm}/`;
}

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get("path");
  if (!rawPath) {
    return Response.json({ error: "path required" }, { status: 400 });
  }

  // 1. DB lookup with trailing-slash variants.
  const variants = Array.from(
    new Set([
      rawPath,
      rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath + "/",
    ]),
  );

  for (const v of variants) {
    const [row] = await db
      .select()
      .from(legacyRedirectsTable)
      .where(eq(legacyRedirectsTable.sourcePath, v))
      .limit(1);
    if (row) {
      return Response.json({
        targetPath: row.targetPath,
        statusCode: row.statusCode ?? 301,
      });
    }
  }

  // 2. Slug normalization fallback for /scrap-yards/<state>/<city>/<yard>/
  //    (strips state alias suffixes, city collision suffixes, and yard
  //    suffixes when the cleaned slug exists). See spec §B1.
  for (const v of variants) {
    const target = await tryNormalize(v);
    if (target) {
      return Response.json({ targetPath: target, statusCode: 301 });
    }
  }

  // 3. /blog/metal/<slug>/ → /scrap-metal-prices/<slug>/ when the grade
  //    actually exists in the metals table. Unknown grades fall through
  //    to 404 here and are then sent to the hub by the middleware fallback.
  for (const v of variants) {
    const bm = v.match(/^\/blog\/metal\/([^/]+)\/?$/);
    if (!bm) continue;
    const slug = bm[1]!;
    const [row] = await db
      .select({ slug: metalsTable.slug })
      .from(metalsTable)
      .where(eq(metalsTable.slug, slug))
      .limit(1);
    if (row) {
      return Response.json({
        targetPath: `/scrap-metal-prices/${row.slug}/`,
        statusCode: 301,
      });
    }
  }

  return Response.json({ found: false }, { status: 404 });
}
