import { db } from "@/lib/db";
import { statesTable, citiesTable, yardsTable, metalPricesTable, metalsTable, priceReportsTable } from "@workspace/db";
import { eq, and, ne, sql, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { localBusinessJsonLd, isOpenNow, metalLabel, formatDate } from "@/lib/seo";
import { metersBetween } from "@/lib/geo";
import YardMap from "@/app/_components/maps/YardMap";
import { AdSenseUnit } from "@/app/_components/AdSenseUnit";

export const revalidate = 3600;

type Props = { params: Promise<{ state: string; city: string; slug: string }> };

async function getYard(state: string, city: string, slug: string) {
  const [st] = await db.select().from(statesTable).where(eq(statesTable.slug, state)).limit(1);
  if (!st) return null;
  const [ct] = await db.select().from(citiesTable)
    .where(and(eq(citiesTable.stateCode, st.code), eq(citiesTable.slug, city))).limit(1);
  if (!ct) return null;
  const [yard] = await db.select().from(yardsTable)
    .where(and(eq(yardsTable.stateCode, st.code), eq(yardsTable.cityId, ct.id), eq(yardsTable.slug, slug))).limit(1);
  if (!yard) return null;
  return { ...yard, stateName: st.name, stateSlug: st.slug, cityName: ct.name, citySlug: ct.slug };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, city, slug } = await params;
  const yard = await getYard(state, city, slug);
  if (!yard) return {};
  return {
    title: `${yard.name} — Scrap Yard in ${yard.cityName}, ${yard.stateCode}`,
    description: `${yard.name} buys ${(yard.accepted ?? []).slice(0, 4).join(", ")} and more. Hours, current scrap prices, and contact info.`,
    alternates: { canonical: `/scrap-yards/${state}/${city}/${slug}/` },
  };
}

export default async function YardPage({ params }: Props) {
  const { state, city, slug } = await params;
  const yard = await getYard(state, city, slug);
  if (!yard) notFound();

  const latestDateRows = await db
    .select({ maxDate: sql<string>`max(recorded_on)` })
    .from(metalPricesTable)
    .where(eq(metalPricesTable.regionCode, yard.stateCode));
  const maxDate = latestDateRows[0]?.maxDate;

  const [latestPrices, recentReports, nearbyRaw] = await Promise.all([
    maxDate
      ? db
          .select({
            metalSlug: metalPricesTable.metalSlug,
            metalName: metalsTable.name,
            price: metalPricesTable.price,
            unit: metalsTable.unit,
            recordedOn: metalPricesTable.recordedOn,
          })
          .from(metalPricesTable)
          .innerJoin(metalsTable, eq(metalPricesTable.metalSlug, metalsTable.slug))
          .where(and(eq(metalPricesTable.regionCode, yard.stateCode), eq(metalPricesTable.recordedOn, maxDate)))
          .orderBy(metalsTable.displayOrder)
          .limit(12)
      : Promise.resolve([]),

    db
      .select({
        id: priceReportsTable.id,
        metalSlug: priceReportsTable.metalSlug,
        metalName: metalsTable.name,
        price: priceReportsTable.price,
        unit: metalsTable.unit,
        reportedOn: priceReportsTable.reportedOn,
        notes: priceReportsTable.notes,
      })
      .from(priceReportsTable)
      .innerJoin(metalsTable, eq(priceReportsTable.metalSlug, metalsTable.slug))
      .where(and(eq(priceReportsTable.yardId, yard.id), eq(priceReportsTable.isApproved, true)))
      .orderBy(desc(priceReportsTable.reportedOn))
      .limit(10),

    db
      .select({
        id: yardsTable.id,
        name: yardsTable.name,
        slug: yardsTable.slug,
        lat: yardsTable.lat,
        lng: yardsTable.lng,
        stateSlug: statesTable.slug,
        citySlug: citiesTable.slug,
      })
      .from(yardsTable)
      .innerJoin(statesTable, eq(yardsTable.stateCode, statesTable.code))
      .innerJoin(citiesTable, eq(yardsTable.cityId, citiesTable.id))
      .where(and(eq(yardsTable.stateCode, yard.stateCode), ne(yardsTable.id, yard.id), eq(yardsTable.status, "active")))
      .limit(20),
  ]);

  const nearby = nearbyRaw
    .filter((n) => n.lat && n.lng && yard.lat && yard.lng)
    .map((n) => ({ ...n, distMeters: metersBetween(yard, n) }))
    .sort((a, b) => a.distMeters - b.distMeters)
    .slice(0, 6);

  const jsonLd = localBusinessJsonLd(yard);

  const dayLabels: Record<string, string> = {
    mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
    fri: "Friday", sat: "Saturday", sun: "Sunday",
  };

  // Hours shape detection. ~28% of migrated yards have unstructured hours
  // stored as { raw: "..." } (no parsed open/close). For those we skip the
  // open-now badge and render the raw text as a single line.
  const hoursObj = (yard.hours && typeof yard.hours === "object")
    ? (yard.hours as Record<string, unknown>)
    : null;
  const rawHours = hoursObj && typeof hoursObj.raw === "string" && hoursObj.raw.trim().length > 0
    ? (hoursObj.raw as string)
    : null;
  const structuredHourKeys = hoursObj
    ? Object.keys(hoursObj).filter((k) => k !== "raw" && k in dayLabels)
    : [];
  const hasStructuredHours = structuredHourKeys.length > 0;

  return (
    <div className="container" style={{ padding: "2rem 1.25rem" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="breadcrumb">
        <Link href="/">Home</Link> › <Link href="/scrap-yards/">Scrap Yards</Link> ›{" "}
        <Link href={`/scrap-yards/${state}/`}>{yard.stateName}</Link> ›{" "}
        <Link href={`/scrap-yards/${state}/${city}/`}>{yard.cityName}</Link> › {yard.name}
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "2rem", alignItems: "start" }}>
        <div>
          <header style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
              <h1 style={{ marginBottom: 0 }}>{yard.name}</h1>
              {yard.isVerified && <span className="badge" style={{ background: "#e8f5e9", color: "#1a7a3a" }}>Verified</span>}
              {yard.isPremium && <span className="badge">Premium</span>}
            </div>
            {yard.address && (
              <p style={{ color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
                {yard.address}, {yard.cityName}, {yard.stateCode} {yard.zip}
              </p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              {hasStructuredHours && (
                isOpenNow(yard.hours)
                  ? <span style={{ color: "var(--color-up)", fontWeight: 600, fontSize: "0.9rem" }}>● Open now</span>
                  : <span style={{ color: "var(--color-down)", fontWeight: 600, fontSize: "0.9rem" }}>● Closed</span>
              )}
              {yard.ratingAvg && yard.ratingCount && yard.ratingCount > 0 && (
                <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                  ★ {Number(yard.ratingAvg).toFixed(1)} ({yard.ratingCount} reviews)
                </span>
              )}
            </div>
          </header>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2rem" }}>
            {yard.phone && (
              <a href={`tel:${yard.phone}`} className="btn btn-primary">{yard.phone}</a>
            )}
            {yard.lat && yard.lng && (
              <a href={`https://maps.google.com/?q=${yard.lat},${yard.lng}`} className="btn" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }} target="_blank" rel="noopener noreferrer">
                Get Directions
              </a>
            )}
            {yard.website && (
              <a href={yard.website} className="btn" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }} target="_blank" rel="nofollow noopener noreferrer">
                Website
              </a>
            )}
          </div>

          {yard.lat && yard.lng && (
            <YardMap
              lat={Number(yard.lat)}
              lng={Number(yard.lng)}
              name={yard.name}
              address={yard.address ? `${yard.address}, ${yard.cityName}, ${yard.stateCode} ${yard.zip ?? ""}`.trim() : null}
            />
          )}

          {yard.description && (
            <section className="card" style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ marginBottom: "0.75rem" }}>About {yard.name}</h2>
              <p style={{ lineHeight: 1.7 }}>{yard.description}</p>
            </section>
          )}

          <AdSenseUnit />

          {yard.accepted && yard.accepted.length > 0 && (
            <section className="card" style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ marginBottom: "0.75rem" }}>What {yard.name} Buys</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {yard.accepted.map((m) => (
                  <Link key={m} href={`/scrap-metal-prices/${m}/${state}/`}
                    style={{ padding: "0.3rem 0.75rem", border: "1px solid var(--color-border)", borderRadius: "100px", fontSize: "0.85rem", background: "var(--color-bg)" }}>
                    {metalLabel(m)}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {latestPrices.length > 0 && (
            <section className="card" style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ marginBottom: "0.25rem" }}>Current Scrap Prices in {yard.cityName}, {yard.stateCode}</h2>
              <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
                Regional averages — call {yard.name} for exact pay rates. Last updated {formatDate(latestPrices[0]?.recordedOn)}.
              </p>
              <table>
                <thead>
                  <tr><th>Metal</th><th>Est. Price</th><th>Unit</th></tr>
                </thead>
                <tbody>
                  {latestPrices.map((p) => (
                    <tr key={p.metalSlug}>
                      <td><Link href={`/scrap-metal-prices/${p.metalSlug}/`}>{p.metalName}</Link></td>
                      <td style={{ fontWeight: 600 }}>${Number(p.price).toFixed(2)}</td>
                      <td style={{ color: "var(--color-text-muted)" }}>/{p.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {recentReports.length > 0 && (
            <section className="card" style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ marginBottom: "0.75rem" }}>Recently Reported Prices at {yard.name}</h2>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {recentReports.map((r) => (
                  <li key={r.id} style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                    <strong>{r.metalName}</strong>: ${Number(r.price).toFixed(2)}/{r.unit}
                    {" — "}{formatDate(r.reportedOn)}
                    {r.notes && <em style={{ marginLeft: "0.5rem" }}>&ldquo;{r.notes}&rdquo;</em>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card" style={{ marginBottom: "1.5rem", background: "var(--color-accent-light)", border: "1px solid #f3c4b6" }}>
            <h2 style={{ marginBottom: "0.25rem" }}>Sold scrap here recently?</h2>
            <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>Help other scrappers — report what you got paid.</p>
            <a href={`/api/price-report?yard=${yard.id}`} className="btn btn-primary">Report a Price</a>
          </section>

          <AdSenseUnit />

          {nearby.length > 0 && (
            <section className="card" style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ marginBottom: "0.75rem" }}>Other Scrap Yards Near {yard.cityName}</h2>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {nearby.map((n) => (
                  <li key={n.id}>
                    <Link href={`/scrap-yards/${n.stateSlug}/${n.citySlug}/${n.slug}/`}>
                      {n.name}
                    </Link>
                    <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>
                      — {(n.distMeters / 1609).toFixed(1)} mi
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside>
          {hasStructuredHours && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "0.75rem" }}>Hours</h3>
              <table style={{ fontSize: "0.85rem" }}>
                <tbody>
                  {structuredHourKeys.map((day) => {
                    const h = (hoursObj as Record<string, { open?: string; close?: string }>)[day];
                    return (
                      <tr key={day}>
                        <td style={{ padding: "0.3rem 0.5rem 0.3rem 0", fontWeight: 600 }}>{dayLabels[day] ?? day}</td>
                        <td style={{ padding: "0.3rem 0" }}>
                          {h?.open && h?.close ? `${h.open} – ${h.close}` : "Closed"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!hasStructuredHours && rawHours && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>Hours</h3>
              <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>{rawHours}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", margin: 0 }}>
                Call to confirm — structured hours coming soon.
              </p>
            </div>
          )}

          {yard.services && yard.services.length > 0 && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>Services</h3>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.85rem" }}>
                {yard.services.map((s) => (
                  <li key={s}>✓ {metalLabel(s)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <h3 style={{ marginBottom: "0.75rem" }}>Scrap Prices in {yard.stateName}</h3>
            <Link href={`/scrap-metal-prices/bare-bright-copper/${state}/`} style={{ display: "block", fontSize: "0.9rem", marginBottom: "0.25rem" }}>Copper prices</Link>
            <Link href={`/scrap-metal-prices/aluminum/${state}/`} style={{ display: "block", fontSize: "0.9rem", marginBottom: "0.25rem" }}>Aluminum prices</Link>
            <Link href={`/scrap-metal-prices/steel/${state}/`} style={{ display: "block", fontSize: "0.9rem" }}>Steel prices</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
