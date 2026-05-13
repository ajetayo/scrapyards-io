import { db } from "@/lib/db";
import { statesTable, citiesTable, yardsTable } from "@workspace/db";
import { eq, sql, and, isNotNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { STATE_CENTROIDS } from "@/lib/zip-to-state";
import { metersBetween } from "@/lib/geo";
import StateMap from "@/app/_components/maps/StateMap";
import { AdSenseUnit } from "@/app/_components/AdSenseUnit";

export const revalidate = 3600;

type Props = { params: Promise<{ state: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const [st] = await db.select().from(statesTable).where(eq(statesTable.slug, state)).limit(1);
  if (!st) return {};
  return {
    title: `Scrap Yards in ${st.name}`,
    description: `Find scrap yards in ${st.name}. Browse by city with hours, accepted materials, and scrap prices.`,
    alternates: { canonical: `/scrap-yards/${state}/` },
  };
}

export async function generateStaticParams() {
  const states = await db.select({ slug: statesTable.slug }).from(statesTable);
  return states.map((s) => ({ state: s.slug }));
}

export default async function StateYardsPage({ params }: Props) {
  const { state } = await params;

  const [st] = await db.select().from(statesTable).where(eq(statesTable.slug, state)).limit(1);
  if (!st) notFound();

  const [cities, mapYardsRaw] = await Promise.all([
    db
      .select({
        id: citiesTable.id,
        slug: citiesTable.slug,
        name: citiesTable.name,
        yardCount: sql<number>`count(${yardsTable.id})::int`,
      })
      .from(citiesTable)
      .leftJoin(yardsTable, eq(yardsTable.cityId, citiesTable.id))
      .where(eq(citiesTable.stateCode, st.code))
      .groupBy(citiesTable.id, citiesTable.slug, citiesTable.name)
      .having(sql`count(${yardsTable.id}) > 0`)
      .orderBy(citiesTable.name),

    db
      .select({
        id: yardsTable.id,
        name: yardsTable.name,
        slug: yardsTable.slug,
        lat: yardsTable.lat,
        lng: yardsTable.lng,
        citySlug: citiesTable.slug,
      })
      .from(yardsTable)
      .innerJoin(citiesTable, eq(yardsTable.cityId, citiesTable.id))
      .where(
        and(
          eq(yardsTable.stateCode, st.code),
          eq(yardsTable.status, "active"),
          isNotNull(yardsTable.lat),
          isNotNull(yardsTable.lng),
        ),
      ),
  ]);

  const centroid = STATE_CENTROIDS[st.code];
  const mapYards = centroid
    ? mapYardsRaw
        .map((y) => ({
          id: y.id,
          name: y.name,
          slug: y.slug,
          lat: Number(y.lat),
          lng: Number(y.lng),
          citySlug: y.citySlug,
          dist: metersBetween(
            { lat: Number(y.lat), lng: Number(y.lng) },
            { lat: centroid.lat, lng: centroid.lng },
          ),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 100)
    : [];

  return (
    <div className="container" style={{ padding: "2rem 1.25rem" }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › <Link href="/scrap-yards/">Scrap Yards</Link> › {st.name}
      </nav>
      <h1 style={{ marginBottom: "0.5rem" }}>Scrap Yards in {st.name}</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        {cities.length} {cities.length === 1 ? "city" : "cities"} with scrap yards in {st.name}.
      </p>

      {centroid && mapYards.length > 0 && (
        <>
          <StateMap
            yards={mapYards.map(({ dist: _dist, ...y }) => y)}
            stateSlug={state}
            centerLat={centroid.lat}
            centerLng={centroid.lng}
          />
          {mapYardsRaw.length > 100 && (
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "-0.75rem", marginBottom: "1.5rem" }}>
              Showing the 100 yards closest to the {st.name} center. View all yards by city below.
            </p>
          )}
        </>
      )}

      {st.introMd && (
        <div className="card" style={{ marginBottom: "2rem", lineHeight: 1.7 }}>
          <p>{st.introMd}</p>
        </div>
      )}

      <AdSenseUnit />

      {cities.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
          {cities.map((c) => (
            <Link
              key={c.id}
              href={`/scrap-yards/${state}/${c.slug}/`}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit" }}
            >
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>{c.yardCount} yards</span>
            </Link>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--color-text-muted)" }}>No yards listed for {st.name} yet.</p>
      )}

      <div style={{ marginTop: "2rem" }}>
        <Link href={`/scrap-metal-prices/bare-bright-copper/${state}/`} style={{ fontSize: "0.9rem" }}>
          View copper prices in {st.name} →
        </Link>
      </div>

      <AdSenseUnit />
    </div>
  );
}
