import { db } from "@/lib/db";
import { metalPricesTable, metalsTable, metalCategoriesTable, statesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { metalLabel, formatDate, spotPriceJsonLd } from "@/lib/seo";

export const revalidate = 900;

export const metadata: Metadata = {
  title: `Scrap Metal Prices Today — Per-State Rates`,
  description: "Real-time scrap metal prices by metal and state. Copper, aluminum, steel, brass, and more — updated daily from commodity markets.",
  alternates: { canonical: "/scrap-metal-prices/" },
};

export default async function PricesHubPage() {
  const latestDate = await db
    .select({ maxDate: sql<string>`max(recorded_on)` })
    .from(metalPricesTable)
    .where(eq(metalPricesTable.regionCode, "US"));

  const maxDate = latestDate[0]?.maxDate;

  type PriceRow = { metalSlug: string; metalName: string; price: string; unit: string; category: string; displayOrder: number | null; recordedOn: string };

  const [prices, categories, states] = await Promise.all([
    maxDate
      ? db
          .select({
            metalSlug: metalPricesTable.metalSlug,
            metalName: metalsTable.name,
            price: metalPricesTable.price,
            unit: metalsTable.unit,
            category: metalsTable.category,
            displayOrder: metalsTable.displayOrder,
            recordedOn: metalPricesTable.recordedOn,
          })
          .from(metalPricesTable)
          .innerJoin(metalsTable, eq(metalPricesTable.metalSlug, metalsTable.slug))
          .where(and(eq(metalPricesTable.regionCode, "US"), eq(metalPricesTable.recordedOn, maxDate)))
          .orderBy(metalsTable.displayOrder)
      : Promise.resolve([] as PriceRow[]),
    db.select().from(metalCategoriesTable).orderBy(metalCategoriesTable.displayOrder),
    db.select().from(statesTable).orderBy(statesTable.name),
  ]);

  const byCategory = prices.reduce(
    (acc, p) => {
      const cat = p.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    },
    {} as Record<string, typeof prices>,
  );

  const topPrices = prices.slice(0, 6);

  return (
    <div className="container" style={{ padding: "2rem 1.25rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(spotPriceJsonLd(prices.map((p) => ({ metalName: p.metalName, price: p.price, unit: p.unit })))),
        }}
      />

      <nav className="breadcrumb">
        <Link href="/">Home</Link> › Scrap Metal Prices
      </nav>
      <h1 style={{ marginBottom: "0.25rem" }}>Scrap Metal Prices Today</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
        {maxDate ? `Updated ${formatDate(maxDate)} from commodity markets and user reports.` : "Prices will appear once the daily update runs."}{" "}
        Yard pay rates typically run 50–80% of these estimates — always confirm before hauling.
      </p>

      {topPrices.length > 0 && (
        <div className="grid-3" style={{ marginBottom: "2.5rem" }}>
          {topPrices.map((p) => (
            <Link
              key={p.metalSlug}
              href={`/scrap-metal-prices/${p.metalSlug}/`}
              className="card"
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {p.metalName}
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--color-accent)" }}>
                ${Number(p.price).toFixed(2)}
                <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", fontWeight: 400 }}>/{p.unit}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Browse by Category</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem" }}>
          {categories.map((c) => (
            <Link key={c.slug} href={`/scrap-metal-prices/${c.slug}/`}
              style={{ padding: "0.6rem 0.85rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", fontSize: "0.95rem", fontWeight: 600, background: "var(--color-bg)" }}>
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      {Object.entries(byCategory).map(([cat, metals]) => {
        const catRow = categories.find((c) => c.slug === cat);
        return (
          <section key={cat} className="card" style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ marginBottom: "1rem" }}>
              {catRow ? <Link href={`/scrap-metal-prices/${cat}/`}>{catRow.name}</Link> : metalLabel(cat)}
            </h2>
            <table>
              <thead>
                <tr><th>Metal</th><th>US Avg Price</th><th>Unit</th></tr>
              </thead>
              <tbody>
                {metals.map((m) => (
                  <tr key={m.metalSlug}>
                    <td><Link href={`/scrap-metal-prices/${m.metalSlug}/`}>{m.metalName}</Link></td>
                    <td style={{ fontWeight: 600 }}>${Number(m.price).toFixed(2)}</td>
                    <td style={{ color: "var(--color-text-muted)" }}>/{m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {prices.length === 0 && (
        <div className="card" style={{ marginBottom: "1.5rem", textAlign: "center", padding: "2rem" }}>
          <p style={{ color: "var(--color-text-muted)" }}>No price data yet. Seed the database or run the cron job.</p>
        </div>
      )}

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Copper Prices by State</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.4rem" }}>
          {states.map((s) => (
            <Link key={s.code} href={`/scrap-metal-prices/copper/${s.slug}/`} style={{ fontSize: "0.85rem" }}>
              Copper in {s.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
