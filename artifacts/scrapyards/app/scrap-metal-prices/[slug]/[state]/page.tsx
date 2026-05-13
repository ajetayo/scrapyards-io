import { db } from "@/lib/db";
import { metalPricesTable, metalsTable, metalCategoriesTable, statesTable, yardsTable, citiesTable, metalStateContentTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/seo";

export const revalidate = 900;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string; state: string }> };

async function resolveSlug(slug: string) {
  const [cat] = await db.select().from(metalCategoriesTable).where(eq(metalCategoriesTable.slug, slug)).limit(1);
  if (cat) return { kind: "category" as const, category: cat };
  const [metal] = await db.select().from(metalsTable).where(eq(metalsTable.slug, slug)).limit(1);
  if (metal) return { kind: "metal" as const, metal };
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, state } = await params;
  const [resolved, [st]] = await Promise.all([
    resolveSlug(slug),
    db.select().from(statesTable).where(eq(statesTable.slug, state)).limit(1),
  ]);
  if (!resolved || !st) return {};
  if (resolved.kind === "category") {
    return {
      title: `${resolved.category.name} Scrap Prices in ${st.name} Today`,
      description: `Current ${resolved.category.name.toLowerCase()} scrap prices in ${st.name}. Every grade with state-level averages.`,
      alternates: { canonical: `/scrap-metal-prices/${slug}/${state}/` },
    };
  }
  return {
    title: `${resolved.metal.name} Scrap Price in ${st.name} Today`,
    description: `Current ${resolved.metal.name} scrap price in ${st.name}. State average and local yard prices.`,
    alternates: { canonical: `/scrap-metal-prices/${slug}/${state}/` },
  };
}

export default async function MetalOrCategoryStatePage({ params }: Props) {
  const { slug, state } = await params;
  const [resolved, [st]] = await Promise.all([
    resolveSlug(slug),
    db.select().from(statesTable).where(eq(statesTable.slug, state)).limit(1),
  ]);
  if (!resolved || !st) notFound();

  if (resolved.kind === "category") {
    return <CategoryStateView category={resolved.category} state={st} slug={slug} stateSlug={state} />;
  }
  return <MetalStateView metal={resolved.metal} state={st} slug={slug} stateSlug={state} />;
}

async function CategoryStateView({
  category, state, slug, stateSlug,
}: {
  category: { slug: string; name: string };
  state: { code: string; name: string };
  slug: string; stateSlug: string;
}) {
  const metalsInCat = await db.select().from(metalsTable).where(eq(metalsTable.category, category.slug)).orderBy(metalsTable.displayOrder);
  const metalSlugs = metalsInCat.map((m) => m.slug);

  let stateMap: Record<string, string> = {};
  let nationalMap: Record<string, string> = {};
  if (metalSlugs.length > 0) {
    const stateRows = await db.execute(sql`
      SELECT DISTINCT ON (metal_slug) metal_slug, price::text AS price
      FROM metal_prices
      WHERE region_code = ${state.code} AND metal_slug IN (${sql.join(metalSlugs.map((s) => sql`${s}`), sql`, `)})
      ORDER BY metal_slug, recorded_on DESC
    `);
    stateMap = Object.fromEntries((stateRows.rows as Array<{ metal_slug: string; price: string }>).map((r) => [r.metal_slug, r.price]));
    const usRows = await db.execute(sql`
      SELECT DISTINCT ON (metal_slug) metal_slug, price::text AS price
      FROM metal_prices
      WHERE region_code = 'US' AND metal_slug IN (${sql.join(metalSlugs.map((s) => sql`${s}`), sql`, `)})
      ORDER BY metal_slug, recorded_on DESC
    `);
    nationalMap = Object.fromEntries((usRows.rows as Array<{ metal_slug: string; price: string }>).map((r) => [r.metal_slug, r.price]));
  }

  return (
    <div className="container" style={{ padding: "2rem 1.25rem" }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › <Link href="/scrap-metal-prices/">Scrap Metal Prices</Link> ›{" "}
        <Link href={`/scrap-metal-prices/${slug}/`}>{category.name}</Link> › {state.name}
      </nav>

      <h1 style={{ marginBottom: "0.25rem" }}>{category.name} Scrap Prices in {state.name}</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        State-level averages for every {category.name.toLowerCase()} grade we track.
      </p>

      {metalsInCat.length > 0 ? (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>{category.name} Grades — {state.name}</h2>
          <table>
            <thead>
              <tr><th>Grade</th><th>{state.code} Avg</th><th>US Avg</th><th>Unit</th></tr>
            </thead>
            <tbody>
              {metalsInCat.map((m) => (
                <tr key={m.slug}>
                  <td><Link href={`/scrap-metal-prices/${m.slug}/${stateSlug}/`}>{m.name}</Link></td>
                  <td style={{ fontWeight: 600 }}>{stateMap[m.slug] ? `$${Number(stateMap[m.slug]).toFixed(2)}` : "—"}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>{nationalMap[m.slug] ? `$${Number(nationalMap[m.slug]).toFixed(2)}` : "—"}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>/{m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ color: "var(--color-text-muted)" }}>No grades tracked in this category yet.</p>
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
        <Link href={`/scrap-yards/${stateSlug}/`}>Find scrap yards in {state.name} →</Link>
        <Link href={`/scrap-metal-prices/${slug}/`}>View all states for {category.name} →</Link>
      </div>
    </div>
  );
}

async function MetalStateView({
  metal, state, slug, stateSlug,
}: {
  metal: { slug: string; name: string; unit: string };
  state: { code: string; name: string };
  slug: string; stateSlug: string;
}) {
  const latestDate = await db
    .select({ maxDate: sql<string>`max(recorded_on)` })
    .from(metalPricesTable)
    .where(and(eq(metalPricesTable.metalSlug, slug), eq(metalPricesTable.regionCode, state.code)));

  const maxDate = latestDate[0]?.maxDate;

  const [statePrice, nationalPrice, yardsAccepting, marketContext] = await Promise.all([
    maxDate
      ? db.select().from(metalPricesTable)
          .where(and(eq(metalPricesTable.metalSlug, slug), eq(metalPricesTable.regionCode, state.code), eq(metalPricesTable.recordedOn, maxDate)))
          .limit(1)
      : Promise.resolve([]),
    maxDate
      ? db.select().from(metalPricesTable)
          .where(and(eq(metalPricesTable.metalSlug, slug), eq(metalPricesTable.regionCode, "US"), eq(metalPricesTable.recordedOn, maxDate)))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: yardsTable.id,
        name: yardsTable.name,
        slug: yardsTable.slug,
        cityName: citiesTable.name,
        citySlug: citiesTable.slug,
      })
      .from(yardsTable)
      .innerJoin(citiesTable, eq(yardsTable.cityId, citiesTable.id))
      .where(and(
        eq(yardsTable.stateCode, state.code),
        eq(yardsTable.status, "active"),
        sql`${slug} = ANY(${yardsTable.accepted})`,
      ))
      .limit(20),
    db.select().from(metalStateContentTable)
      .where(and(eq(metalStateContentTable.metalSlug, slug), eq(metalStateContentTable.stateSlug, stateSlug)))
      .limit(1),
  ]);

  return (
    <div className="container" style={{ padding: "2rem 1.25rem" }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › <Link href="/scrap-metal-prices/">Scrap Metal Prices</Link> ›{" "}
        <Link href={`/scrap-metal-prices/${slug}/`}>{metal.name}</Link> › {state.name}
      </nav>

      <h1 style={{ marginBottom: "0.25rem" }}>{metal.name} Scrap Price in {state.name}</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        {maxDate ? `Updated ${formatDate(maxDate)}.` : "Prices not yet available."}
      </p>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        {statePrice[0] && (
          <div className="card" style={{ padding: "1.5rem 2rem" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>{state.name} Average</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--color-accent)" }}>
              ${Number(statePrice[0].price).toFixed(2)}
              <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", fontWeight: 400 }}>/{metal.unit}</span>
            </div>
          </div>
        )}
        {nationalPrice[0] && (
          <div className="card" style={{ padding: "1.5rem 2rem" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>US National Average</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--color-text)" }}>
              ${Number(nationalPrice[0].price).toFixed(2)}
              <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", fontWeight: 400 }}>/{metal.unit}</span>
            </div>
          </div>
        )}
      </div>

      {marketContext[0]?.marketContextMd && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>{metal.name} market context — {state.name}</h2>
          <p style={{ lineHeight: 1.7, marginBottom: 0 }}>{marketContext[0].marketContextMd}</p>
        </section>
      )}

      {yardsAccepting.length > 0 && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>Scrap Yards Buying {metal.name} in {state.name}</h2>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {yardsAccepting.map((y) => (
              <li key={y.id}>
                <Link href={`/scrap-yards/${stateSlug}/${y.citySlug}/${y.slug}/`}>
                  {y.name}
                </Link>
                <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginLeft: "0.4rem" }}>— {y.cityName}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
        <Link href={`/scrap-yards/${stateSlug}/`}>Find scrap yards in {state.name} →</Link>
        <Link href={`/scrap-metal-prices/${slug}/`}>View all state prices for {metal.name} →</Link>
      </div>
    </div>
  );
}
