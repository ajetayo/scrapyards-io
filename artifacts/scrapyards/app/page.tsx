import { db } from "@/lib/db";
import { statesTable, metalPricesTable, metalsTable, itemsTable, metalCategoriesTable } from "@workspace/db";
import { desc, eq, and, sql } from "drizzle-orm";
import Link from "next/link";
import { metalLabel, formatDate } from "@/lib/seo";
import { loadCalcContext, computeCalc, formatRange } from "@/lib/calculator";
import HomeSearchForm, { type CategoryOption } from "@/app/_components/HomeSearchForm";
import { AdSenseUnit } from "@/app/_components/AdSenseUnit";

export const revalidate = 3600;

export default async function HomePage() {
  let states: Array<{ code: string; slug: string; name: string }> = [];
  let topPrices: Array<{ metalSlug: string; metalName: string; price: string; unit: string; recordedOn: string }> = [];
  let popularItems: Array<{ slug: string; name: string; low: number; high: number }> = [];
  let categories: CategoryOption[] = [];

  try {
    categories = await db
      .select({ slug: metalCategoriesTable.slug, name: metalCategoriesTable.name })
      .from(metalCategoriesTable)
      .orderBy(metalCategoriesTable.displayOrder);
  } catch {
    // ignore — empty state
  }

  try {
    const ctx = await loadCalcContext("US");
    const featured = ctx.items.filter((i) => i.isFeatured).slice(0, 6);
    const pool = featured.length >= 6 ? featured : ctx.items.slice(0, 6);
    popularItems = pool.map((it) => {
      const r = computeCalc([{ slug: it.slug, quantity: 1 }], ctx);
      const li = r.items[0]!;
      return { slug: it.slug, name: it.name, low: li.item_value_low, high: li.item_value_high };
    });
  } catch {
    // ignore — empty state
  }

  try {
    const latestDateRows = await db
      .select({ maxDate: sql<string>`max(recorded_on)` })
      .from(metalPricesTable)
      .where(eq(metalPricesTable.regionCode, "US"));
    const maxDate = latestDateRows[0]?.maxDate;

    [states, topPrices] = await Promise.all([
      db.select({ code: statesTable.code, slug: statesTable.slug, name: statesTable.name })
        .from(statesTable).orderBy(statesTable.name),
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
            .where(and(eq(metalPricesTable.regionCode, "US"), eq(metalPricesTable.recordedOn, maxDate)))
            .orderBy(metalsTable.displayOrder)
            .limit(6)
        : Promise.resolve([]),
    ]);
  } catch {
    // DB not seeded yet — show empty state
  }

  return (
    <>
      <section style={{ background: "var(--color-accent)", color: "white", padding: "3rem 0" }}>
        <div className="container">
          <h1 style={{ color: "white", marginBottom: "0.5rem", fontSize: "2.4rem" }}>
            Find Scrap Yards &amp; Current Metal Prices
          </h1>
          <p style={{ opacity: 0.9, fontSize: "1.1rem", marginBottom: "1.25rem" }}>
            Hours, contact info, and live scrap prices for yards across the US.
          </p>
          <div style={{ maxWidth: "780px", marginBottom: "1rem" }}>
            <HomeSearchForm categories={categories} />
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link href="/scrap-yards/" className="btn" style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.4)" }}>
              Browse by State
            </Link>
            <Link href="/scrap-metal-prices/" className="btn" style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.4)" }}>
              View Scrap Prices
            </Link>
          </div>
        </div>
      </section>

      {topPrices.length > 0 && (
        <section style={{ padding: "2.5rem 0" }}>
          <div className="container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
              <h2>Today&apos;s Scrap Prices</h2>
              <Link href="/scrap-metal-prices/" style={{ fontSize: "0.9rem" }}>View all prices →</Link>
            </div>
            <div className="grid-3">
              {topPrices.map((p) => (
                <Link
                  key={p.metalSlug}
                  href={`/scrap-metal-prices/${p.metalSlug}/`}
                  className="card"
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
                    {p.metalName}
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-accent)" }}>
                    ${Number(p.price).toFixed(2)}<span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", fontWeight: 400 }}>/{p.unit}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                    Updated {formatDate(p.recordedOn)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="container"><AdSenseUnit /></div>

      {popularItems.length > 0 && (
        <section style={{ padding: "2.5rem 0", background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
          <div className="container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
              <h2 style={{ marginBottom: 0 }}>Popular items — what&apos;s yours worth?</h2>
              <Link href="/what-is-it-worth/" style={{ fontSize: "0.9rem" }}>See all 50 items →</Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.6rem" }}>
              {popularItems.map((it) => (
                <Link
                  key={it.slug}
                  href={`/what-is-it-worth/${it.slug}/`}
                  className="card"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", padding: "0.85rem 1rem", textDecoration: "none", color: "inherit" }}
                >
                  <span style={{ fontWeight: 600, fontSize: "0.92rem" }}>{it.name}</span>
                  <span style={{ color: "var(--color-accent)", fontWeight: 600, fontSize: "0.88rem", whiteSpace: "nowrap" }}>{formatRange(it.low, it.high)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="container"><AdSenseUnit slot="7063973314" /></div>

      {states.length > 0 && (
        <section style={{ padding: "2rem 0", background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
          <div className="container">
            <h2 style={{ marginBottom: "1rem" }}>Find Scrap Yards by State</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" }}>
              {states.map((s) => (
                <Link
                  key={s.code}
                  href={`/scrap-yards/${s.slug}/`}
                  style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", fontSize: "0.9rem", background: "var(--color-bg)" }}
                >
                  {s.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {states.length === 0 && (
        <section style={{ padding: "3rem 0" }}>
          <div className="container" style={{ textAlign: "center" }}>
            <p style={{ color: "var(--color-text-muted)" }}>
              Run <code>pnpm --filter @workspace/scripts run seed-scrapyards</code> to seed sample data.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
