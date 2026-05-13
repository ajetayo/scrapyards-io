import type { Metadata } from "next";
import Link from "next/link";
import { loadCalcContext, computeCalc, formatRange } from "@/lib/calculator";
import { AdSenseUnit } from "@/app/_components/AdSenseUnit";
import "./what-is-it-worth.css";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "What's It Worth in Scrap? Item Value Estimates",
  description:
    "Quick value estimates for 50+ common scrap items: appliances, auto parts, wire, plumbing, and more. Live per-pound prices, prep tips, and yards near you.",
  alternates: { canonical: "/what-is-it-worth/" },
};

const CATEGORY_LABELS: Record<string, string> = {
  appliance: "Appliances",
  auto: "Auto Parts",
  electrical: "Electrical & Wire",
  electronics: "Electronics",
  plumbing: "Plumbing",
  outdoor: "Outdoor & Yard",
  misc: "Miscellaneous",
};

const CATEGORY_ORDER = ["appliance", "auto", "electrical", "electronics", "plumbing", "outdoor", "misc"];

export default async function Page() {
  const ctx = await loadCalcContext("US");

  type Row = {
    slug: string;
    name: string;
    category: string;
    low: number;
    high: number;
  };

  const rows: Row[] = ctx.items.map((item) => {
    const r = computeCalc([{ slug: item.slug, quantity: 1 }], ctx);
    const it = r.items[0];
    return {
      slug: item.slug,
      name: item.name,
      category: item.category,
      low: it?.item_value_low ?? 0,
      high: it?.item_value_high ?? 0,
    };
  });

  const grouped = new Map<string, Row[]>();
  for (const r of rows) {
    if (!grouped.has(r.category)) grouped.set(r.category, []);
    grouped.get(r.category)!.push(r);
  }
  for (const list of grouped.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const orderedCats = [
    ...CATEGORY_ORDER.filter((c) => grouped.has(c)),
    ...Array.from(grouped.keys()).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Scrap Item Value Estimates",
    numberOfItems: rows.length,
    itemListElement: rows.map((r, i) => {
      const url = `https://scrapyards.io/what-is-it-worth/${r.slug}/`;
      const product: Record<string, unknown> = {
        "@type": "Product",
        name: r.name,
        url,
        category: r.category,
      };
      if (r.high > 0) {
        product.offers = {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: r.low.toFixed(2),
          highPrice: r.high.toFixed(2),
          offerCount: 1,
          availability: "https://schema.org/InStock",
        };
      }
      return {
        "@type": "ListItem",
        position: i + 1,
        url,
        item: product,
      };
    }),
  };

  return (
    <div className="container wiit-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <nav className="breadcrumb" style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
        <Link href="/">Home</Link> › What's It Worth
      </nav>

      <h1 style={{ marginBottom: "0.5rem" }}>What's It Worth in Scrap? Item Value Estimates</h1>
      <p style={{ color: "var(--color-text-muted)", maxWidth: "65ch", marginBottom: "1.5rem" }}>
        Quick scrap value estimates for {rows.length} common items, calculated from live per-pound metal prices and
        typical yard payouts (50–70% of spot). Pick an item to see its components, prep tips, 90-day price trend,
        and yards near you that buy it.
      </p>

      <AdSenseUnit />

      {orderedCats.map((cat) => {
        const list = grouped.get(cat)!;
        return (
          <section key={cat} className="wiit-index-cat-block">
            <h2>{CATEGORY_LABELS[cat] ?? cat}</h2>
            <div className="wiit-index-grid">
              {list.map((r) => (
                <Link key={r.slug} href={`/what-is-it-worth/${r.slug}/`} className="wiit-index-card">
                  <span className="nm">{r.name}</span>
                  <span className="vl">{formatRange(r.low, r.high)}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <AdSenseUnit />

      <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "1.5rem" }}>
        Estimates use the US national average; your local yard may pay more or less. For a specific quote,{" "}
        <Link href="/calculator/">use the full Garage Calculator</Link>.
      </p>
    </div>
  );
}
