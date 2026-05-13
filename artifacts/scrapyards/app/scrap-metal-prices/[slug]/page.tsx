import { db } from "@/lib/db";
import { metalPricesTable, metalsTable, metalCategoriesTable, statesTable, itemsTable } from "@workspace/db";
import type { ItemComponent } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/seo";
import { loadCalcContext, computeCalc, formatRange } from "@/lib/calculator";
import { loadMetalHistory } from "@/lib/item-history";
import { PriceSparkline } from "@/app/what-is-it-worth/PriceSparkline";
import MetalSearchForm from "@/app/_components/MetalSearchForm";
import { AdSenseUnit } from "@/app/_components/AdSenseUnit";

export const revalidate = 900;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

// NOTE on slug shadowing: this resolver checks `metal_categories` BEFORE
// `metals`, so a category slug always wins over a same-named grade slug.
// Do NOT add a new category whose slug collides with an existing grade slug
// (e.g. don't introduce a `stainless-steel` or `cast-iron` category — those
// are grades inside the `steel` category and would silently shadow the grade
// page). If you must introduce such a slug, rename the grade or pick a
// distinct category slug.
async function resolveSlug(slug: string) {
  const [cat] = await db.select().from(metalCategoriesTable).where(eq(metalCategoriesTable.slug, slug)).limit(1);
  if (cat) return { kind: "category" as const, category: cat };
  const [metal] = await db.select().from(metalsTable).where(eq(metalsTable.slug, slug)).limit(1);
  if (metal) return { kind: "metal" as const, metal };
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveSlug(slug);
  if (!resolved) return {};
  if (resolved.kind === "category") {
    return {
      title: `${resolved.category.name} Scrap Prices Today — Per-Pound Rates by Grade & State`,
      description: `Current ${resolved.category.name.toLowerCase()} scrap prices: every grade with national and per-state averages.`,
      alternates: { canonical: `/scrap-metal-prices/${slug}/` },
    };
  }
  return {
    title: `${resolved.metal.name} Scrap Price Today — Per Pound, By State`,
    description: `Current ${resolved.metal.name} scrap price: national average and per-state rates. Updated daily from commodity markets.`,
    alternates: { canonical: `/scrap-metal-prices/${slug}/` },
  };
}

export default async function MetalOrCategoryPage({ params }: Props) {
  const { slug } = await params;
  const resolved = await resolveSlug(slug);
  if (!resolved) notFound();

  if (resolved.kind === "category") {
    return <CategoryView category={resolved.category} slug={slug} />;
  }
  return <MetalView metal={resolved.metal} slug={slug} />;
}

type CategoryViewInput = {
  slug: string;
  name: string;
  descriptionMd: string | null;
  aboutMd: string | null;
  marketDriversMd: string | null;
  gradeComparisonMd: string | null;
  faqJson: Array<{ q: string; a: string }> | null;
};

async function CategoryView({ category, slug }: { category: CategoryViewInput; slug: string }) {
  const [metalsInCat, states] = await Promise.all([
    db.select().from(metalsTable).where(eq(metalsTable.category, category.slug)).orderBy(metalsTable.displayOrder),
    db.select().from(statesTable).orderBy(statesTable.name),
  ]);

  const metalSlugs = metalsInCat.map((m) => m.slug);

  let priceMap: Record<string, { price: string; recordedOn: string }> = {};
  if (metalSlugs.length > 0) {
    const latestRows = await db.execute(sql`
      SELECT DISTINCT ON (metal_slug) metal_slug, price::text AS price, recorded_on::text AS recorded_on
      FROM metal_prices
      WHERE region_code = 'US' AND metal_slug IN (${sql.join(metalSlugs.map((s) => sql`${s}`), sql`, `)})
      ORDER BY metal_slug, recorded_on DESC
    `);
    priceMap = Object.fromEntries(
      (latestRows.rows as Array<{ metal_slug: string; price: string; recorded_on: string }>).map((r) => [r.metal_slug, { price: r.price, recordedOn: r.recorded_on }]),
    );
  }

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${category.name} Scrap Prices`,
    itemListElement: metalsInCat.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: m.name,
        url: `https://scrapyards.io/scrap-metal-prices/${m.slug}/`,
        offers: priceMap[m.slug]
          ? {
              "@type": "Offer",
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: priceMap[m.slug].price,
                priceCurrency: "USD",
                unitText: m.unit,
              },
            }
          : undefined,
      },
    })),
  };

  return (
    <div className="container" style={{ padding: "2rem 1.25rem" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />

      <nav className="breadcrumb">
        <Link href="/">Home</Link> › <Link href="/scrap-metal-prices/">Scrap Metal Prices</Link> › {category.name}
      </nav>

      <h1 style={{ marginBottom: "0.25rem" }}>{category.name} Scrap Prices Today</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        {metalsInCat.length} {category.name.toLowerCase()} grade{metalsInCat.length !== 1 ? "s" : ""} tracked. National averages updated daily.
      </p>

      {(category.aboutMd || category.descriptionMd) && (
        <section className="card" style={{ marginBottom: "1.5rem", lineHeight: 1.7 }}>
          {category.aboutMd ? (
            <>
              <h2 style={{ marginBottom: "0.75rem" }}>About {category.name}</h2>
              <p style={{ marginBottom: 0 }}>{category.aboutMd}</p>
            </>
          ) : (
            <p style={{ marginBottom: 0 }}>{category.descriptionMd}</p>
          )}
        </section>
      )}

      {metalsInCat.length > 0 ? (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>{category.name} Grades</h2>
          <table>
            <thead>
              <tr><th>Grade</th><th>Current Price</th><th>Unit</th><th>Last Updated</th></tr>
            </thead>
            <tbody>
              {metalsInCat.map((m) => {
                const p = priceMap[m.slug];
                return (
                  <tr key={m.slug}>
                    <td><Link href={`/scrap-metal-prices/${m.slug}/`}>{m.name}</Link></td>
                    <td style={{ fontWeight: 600 }}>{p ? `$${Number(p.price).toFixed(2)}` : "—"}</td>
                    <td style={{ color: "var(--color-text-muted)" }}>/{m.unit}</td>
                    <td style={{ color: "var(--color-text-muted)" }}>{p ? formatDate(p.recordedOn) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ color: "var(--color-text-muted)" }}>No grades tracked in this category yet.</p>
        </div>
      )}

      {category.marketDriversMd && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>What drives the {category.name} market</h2>
          <p style={{ lineHeight: 1.7, marginBottom: 0 }}>{category.marketDriversMd}</p>
        </section>
      )}

      {category.gradeComparisonMd && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>How {category.name} grades compare</h2>
          <p style={{ lineHeight: 1.7, marginBottom: 0 }}>{category.gradeComparisonMd}</p>
        </section>
      )}

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>{category.name} Prices by State</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.4rem" }}>
          {states.map((s) => (
            <Link key={s.code} href={`/scrap-metal-prices/${slug}/${s.slug}/`} style={{ fontSize: "0.9rem" }}>
              {category.name} in {s.name}
            </Link>
          ))}
        </div>
      </section>

      {category.faqJson && category.faqJson.length > 0 && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: category.faqJson.map((p) => ({
                  "@type": "Question",
                  name: p.q,
                  acceptedAnswer: { "@type": "Answer", text: p.a },
                })),
              }),
            }}
          />
          <h2 style={{ marginBottom: "0.75rem" }}>Frequently asked about {category.name}</h2>
          <dl style={{ marginBottom: 0 }}>
            {category.faqJson.map((p, i) => (
              <div key={i} style={{ marginBottom: i < category.faqJson!.length - 1 ? "1rem" : 0 }}>
                <dt style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{p.q}</dt>
                <dd style={{ margin: 0, lineHeight: 1.7, color: "var(--color-text)" }}>{p.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

type ItemContainingMetal = {
  slug: string;
  name: string;
  prepTipsMd: string | null;
  pct: number;
  low: number;
  high: number;
};

async function MetalView({ metal, slug }: { metal: { slug: string; name: string; unit: string; category: string; descriptionMd: string | null; prepTipsMd: string | null; marketDriversMd: string | null; gradeDifferencesMd: string | null; faqJson: Array<{ q: string; a: string }> | null }; slug: string }) {
  const latestDate = await db
    .select({ maxDate: sql<string>`max(recorded_on)` })
    .from(metalPricesTable)
    .where(and(eq(metalPricesTable.metalSlug, slug), eq(metalPricesTable.regionCode, "US")));

  const maxDate = latestDate[0]?.maxDate;

  const [nationalPrice, statePrices, siblings, category, allItemsRaw, history] = await Promise.all([
    maxDate
      ? db.select().from(metalPricesTable)
          .where(and(eq(metalPricesTable.metalSlug, slug), eq(metalPricesTable.regionCode, "US"), eq(metalPricesTable.recordedOn, maxDate)))
          .limit(1)
      : Promise.resolve([]),
    maxDate
      ? db
          .select({
            regionCode: metalPricesTable.regionCode,
            price: metalPricesTable.price,
            stateName: statesTable.name,
            stateSlug: statesTable.slug,
          })
          .from(metalPricesTable)
          .innerJoin(statesTable, eq(metalPricesTable.regionCode, statesTable.code))
          .where(and(eq(metalPricesTable.metalSlug, slug), eq(metalPricesTable.recordedOn, maxDate)))
          .orderBy(statesTable.name)
      : Promise.resolve([]),
    db.select().from(metalsTable)
      .where(and(eq(metalsTable.category, metal.category), sql`${metalsTable.slug} != ${slug}`))
      .orderBy(metalsTable.displayOrder),
    db.select().from(metalCategoriesTable).where(eq(metalCategoriesTable.slug, metal.category)).limit(1),
    db
      .select({
        slug: itemsTable.slug,
        name: itemsTable.name,
        components: itemsTable.components,
        prepTipsMd: itemsTable.prepTipsMd,
        displayOrder: itemsTable.displayOrder,
      })
      .from(itemsTable)
      .where(sql`${itemsTable.components} @> ${JSON.stringify([{ metal_slug: slug }])}::jsonb`),
    loadMetalHistory(slug, 90),
  ]);

  const cat = category[0];

  // Compute item value ranges (qty=1, US prices) for items containing this metal
  let itemsContaining: ItemContainingMetal[] = [];
  if (allItemsRaw.length > 0) {
    try {
      const ctx = await loadCalcContext("US");
      const enriched: ItemContainingMetal[] = [];
      for (const it of allItemsRaw) {
        const comp = (it.components as ItemComponent[] | null)?.find((c) => c.metal_slug === slug);
        if (!comp) continue;
        const ctxItem = ctx.items.find((ci) => ci.slug === it.slug);
        if (!ctxItem) continue;
        const r = computeCalc([{ slug: it.slug, quantity: 1 }], ctx);
        const li = r.items[0];
        if (!li) continue;
        enriched.push({
          slug: it.slug,
          name: it.name,
          prepTipsMd: it.prepTipsMd,
          pct: comp.pct,
          low: li.item_value_low,
          high: li.item_value_high,
        });
      }
      // Sort by relevance (pct of recovery from this metal) descending
      enriched.sort((a, b) => b.pct - a.pct);
      itemsContaining = enriched;
    } catch {
      // calc context unavailable — leave list empty
    }
  }

  const sourcesList = itemsContaining.slice(0, 8);
  const prepItems = itemsContaining.filter((i) => i.prepTipsMd && i.prepTipsMd.trim().length > 0).slice(0, 4);
  const showcaseItems = itemsContaining.slice(0, 6);

  return (
    <div className="container" style={{ padding: "2rem 1.25rem" }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › <Link href="/scrap-metal-prices/">Scrap Metal Prices</Link>
        {cat && <> › <Link href={`/scrap-metal-prices/${cat.slug}/`}>{cat.name}</Link></>}
        {" "}› {metal.name}
      </nav>

      <h1 style={{ marginBottom: "0.25rem" }}>{metal.name} Scrap Price Today</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        National average and per-state rates.{" "}
        {maxDate ? `Last updated ${formatDate(maxDate)}.` : "Prices not yet available."}
      </p>

      {nationalPrice[0] && (
        <div className="card" style={{ marginBottom: "2rem", display: "inline-block", padding: "1.5rem 2rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>US National Average</div>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--color-accent)" }}>
            ${Number(nationalPrice[0].price).toFixed(2)}
            <span style={{ fontSize: "1rem", color: "var(--color-text-muted)", fontWeight: 400 }}>/{metal.unit}</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            Source: {nationalPrice[0].source}
          </div>
        </div>
      )}

      {/* Section 1: What is {metal} */}
      {(metal.descriptionMd || sourcesList.length > 0) && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>What is {metal.name}?</h2>
          {metal.descriptionMd && (
            <p style={{ lineHeight: 1.7, marginBottom: sourcesList.length > 0 ? "0.85rem" : 0 }}>
              {metal.descriptionMd}
            </p>
          )}
          {sourcesList.length > 0 && (
            <p style={{ lineHeight: 1.7, marginBottom: 0 }}>
              <strong>Common scrap sources:</strong>{" "}
              {sourcesList.map((it, i) => (
                <span key={it.slug}>
                  <Link href={`/what-is-it-worth/${it.slug}/`}>{it.name.toLowerCase()}</Link>
                  {i < sourcesList.length - 2 ? ", " : i === sourcesList.length - 2 ? (sourcesList.length === 2 ? " and " : ", and ") : "."}
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      {/* Section 2: How to prep {metal} */}
      {(metal.prepTipsMd || prepItems.length > 0) && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>How to prep {metal.name}</h2>
          {metal.prepTipsMd && (
            <p style={{ lineHeight: 1.7, marginBottom: prepItems.length > 0 ? "1rem" : 0 }}>
              {metal.prepTipsMd}
            </p>
          )}
          {prepItems.length > 0 && (
            <>
              <p style={{ fontSize: "0.95rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
                Prep guidance for items that contain {metal.name}:
              </p>
              <ul style={{ paddingLeft: "1.2rem", marginBottom: 0, lineHeight: 1.6 }}>
                {prepItems.map((it) => (
                  <li key={it.slug} style={{ marginBottom: "0.5rem" }}>
                    <Link href={`/what-is-it-worth/${it.slug}/`}><strong>{it.name}</strong></Link>
                    {": "}
                    {it.prepTipsMd}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Section 3: 90-day chart */}
      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>{metal.name} — 90-day price history</h2>
        {history.length >= 30 ? (
          <PriceSparkline
            data={history}
            label={`${metal.name} ($/${metal.unit})`}
          />
        ) : (
          <div
            style={{
              padding: "1.5rem",
              color: "var(--color-text-muted)",
              fontSize: "0.9rem",
              textAlign: "center",
              border: "1px dashed var(--color-border)",
              borderRadius: "8px",
            }}
          >
            Building price history — chart appears after 30 days of recorded prices ({history.length} so far).
          </div>
        )}
      </section>

      <AdSenseUnit />

      {/* Section 3b: Market drivers */}
      {metal.marketDriversMd && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>What drives the {metal.name} market</h2>
          <p style={{ lineHeight: 1.7, marginBottom: 0 }}>{metal.marketDriversMd}</p>
        </section>
      )}

      {/* Section 3c: Grade differences */}
      {metal.gradeDifferencesMd && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>How {metal.name} grades differ on the price board</h2>
          <p style={{ lineHeight: 1.7, marginBottom: 0 }}>{metal.gradeDifferencesMd}</p>
        </section>
      )}

      {/* Section 3d: FAQ */}
      {metal.faqJson && metal.faqJson.length > 0 && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: metal.faqJson.map((p) => ({
                  "@type": "Question",
                  name: p.q,
                  acceptedAnswer: { "@type": "Answer", text: p.a },
                })),
              }),
            }}
          />
          <h2 style={{ marginBottom: "0.75rem" }}>Frequently asked about {metal.name}</h2>
          <dl style={{ marginBottom: 0 }}>
            {metal.faqJson.map((p, i) => (
              <div key={i} style={{ marginBottom: i < metal.faqJson!.length - 1 ? "1rem" : 0 }}>
                <dt style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{p.q}</dt>
                <dd style={{ margin: 0, lineHeight: 1.7, color: "var(--color-text)" }}>{p.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Section 4: What does {metal} go into */}
      {showcaseItems.length > 0 && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>What does {metal.name} go into?</h2>
          <p style={{ fontSize: "0.95rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
            Common items that contain {metal.name}. Click any item to see its full value breakdown.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
            {showcaseItems.map((it) => (
              <Link
                key={it.slug}
                href={`/what-is-it-worth/${it.slug}/`}
                style={{
                  display: "block",
                  padding: "0.85rem 1rem",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  background: "var(--color-bg)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{it.name}</div>
                <div style={{ color: "var(--color-accent)", fontSize: "0.9rem", fontWeight: 600 }}>
                  {formatRange(it.low, it.high)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Section 5: Find yards near you */}
      {cat && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>Find yards near you that buy {metal.name}</h2>
          <p style={{ fontSize: "0.95rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
            Enter your ZIP to see scrap yards in the {cat.name} category within range.
          </p>
          <MetalSearchForm categorySlug={cat.slug} metalName={metal.name} />
        </section>
      )}

      {siblings.length > 0 && cat && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>Compare other {cat.name} grades</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {siblings.map((s) => (
              <Link key={s.slug} href={`/scrap-metal-prices/${s.slug}/`}
                style={{ padding: "0.4rem 0.75rem", border: "1px solid var(--color-border)", borderRadius: "100px", fontSize: "0.85rem", background: "var(--color-bg)" }}>
                {s.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <AdSenseUnit />

      {statePrices.length > 0 && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>{metal.name} Prices by State</h2>
          <table>
            <thead>
              <tr><th>State</th><th>Avg Price</th><th>Unit</th></tr>
            </thead>
            <tbody>
              {statePrices.map((p) => (
                <tr key={p.regionCode}>
                  <td><Link href={`/scrap-metal-prices/${slug}/${p.stateSlug}/`}>{p.stateName}</Link></td>
                  <td style={{ fontWeight: 600 }}>${Number(p.price).toFixed(2)}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>/{metal.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
