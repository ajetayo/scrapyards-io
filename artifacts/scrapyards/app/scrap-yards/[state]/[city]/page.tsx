import { db } from "@/lib/db";
import { statesTable, citiesTable, yardsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import CityMap from "@/app/_components/maps/CityMap";
import { AdSenseUnit } from "@/app/_components/AdSenseUnit";

export const revalidate = 3600;

type Props = { params: Promise<{ state: string; city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, city } = await params;
  const [st] = await db.select().from(statesTable).where(eq(statesTable.slug, state)).limit(1);
  if (!st) return {};
  const [ct] = await db.select().from(citiesTable).where(and(eq(citiesTable.stateCode, st.code), eq(citiesTable.slug, city))).limit(1);
  if (!ct) return {};
  const [{ count: yardCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(yardsTable)
    .where(and(eq(yardsTable.cityId, ct.id), eq(yardsTable.status, "active")));
  const robots = yardCount <= 1
    ? { index: false, follow: true }
    : { index: true, follow: true };
  return {
    title: `Scrap Yards in ${ct.name}, ${st.code}`,
    description: `Find scrap yards in ${ct.name}, ${st.name}. Compare hours, accepted materials, and prices.`,
    alternates: { canonical: `/scrap-yards/${state}/${city}/` },
    robots,
  };
}

export default async function CityYardsPage({ params }: Props) {
  const { state, city } = await params;

  const [st] = await db.select().from(statesTable).where(eq(statesTable.slug, state)).limit(1);
  if (!st) notFound();

  const [ct] = await db.select().from(citiesTable)
    .where(and(eq(citiesTable.stateCode, st.code), eq(citiesTable.slug, city)))
    .limit(1);
  if (!ct) notFound();

  const yards = await db.select().from(yardsTable)
    .where(and(eq(yardsTable.stateCode, st.code), eq(yardsTable.cityId, ct.id), eq(yardsTable.status, "active")))
    .orderBy(yardsTable.isPremium, yardsTable.name);

  return (
    <div className="container" style={{ padding: "2rem 1.25rem" }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › <Link href="/scrap-yards/">Scrap Yards</Link> ›{" "}
        <Link href={`/scrap-yards/${state}/`}>{st.name}</Link> › {ct.name}
      </nav>
      <h1 style={{ marginBottom: "0.5rem" }}>Scrap Yards in {ct.name}, {st.code}</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        {yards.length} scrap yard{yards.length !== 1 ? "s" : ""} in {ct.name}, {st.name}.
      </p>

      {ct.descriptionMd && (
        <div style={{ marginBottom: "1.5rem", lineHeight: 1.6, color: "var(--color-text)" }}>
          {ct.descriptionMd.split(/\n\n+/).map((para, i) => (
            <p key={i} style={{ marginBottom: "0.75rem" }}>{para}</p>
          ))}
        </div>
      )}

      <CityMap
        yards={yards
          .filter((y) => y.lat != null && y.lng != null)
          .map((y) => ({
            id: y.id,
            name: y.name,
            slug: y.slug,
            lat: Number(y.lat),
            lng: Number(y.lng),
            address: y.address,
          }))}
        stateSlug={state}
        citySlug={city}
      />

      <AdSenseUnit />

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {yards.map((y) => (
          <Link
            key={y.id}
            href={`/scrap-yards/${state}/${city}/${y.slug}/`}
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
                {y.address && <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>{y.address}, {ct.name}, {st.code} {y.zip}</p>}
              </div>
              {y.ratingAvg && y.ratingCount && y.ratingCount > 0 && (
                <div style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                  ★ {Number(y.ratingAvg).toFixed(1)} ({y.ratingCount})
                </div>
              )}
            </div>
            {y.accepted && y.accepted.length > 0 && (
              <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {y.accepted.slice(0, 6).map((m) => (
                  <span key={m} style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "100px" }}>
                    {m}
                  </span>
                ))}
                {y.accepted.length > 6 && <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>+{y.accepted.length - 6} more</span>}
              </div>
            )}
            {y.phone && <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--color-accent)" }}>{y.phone}</p>}
          </Link>
        ))}
      </div>

      <AdSenseUnit />
    </div>
  );
}
