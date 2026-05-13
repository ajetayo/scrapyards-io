import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { itemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  loadCalcContext,
  computeCalc,
  formatRange,
  formatMoney,
  formatPriceDate,
  YARD_PAYOUT_LOW,
  YARD_PAYOUT_HIGH,
} from "@/lib/calculator";
import {
  loadMetalHistory,
  dominantMetalSlug,
  projectItemValueSeries,
  summarizeRange,
} from "@/lib/item-history";
import { Calculator } from "@/app/calculator/Calculator";
import { PriceSparkline } from "../PriceSparkline";
import { FindYardsBox } from "../FindYardsBox";
import { AdSenseUnit } from "@/app/_components/AdSenseUnit";
import "../what-is-it-worth.css";

export const revalidate = 900;
export const dynamicParams = false;

const CATEGORY_LABELS: Record<string, string> = {
  appliance: "Appliances",
  auto: "Auto Parts",
  electrical: "Electrical & Wire",
  electronics: "Electronics",
  plumbing: "Plumbing",
  outdoor: "Outdoor & Yard",
  misc: "Miscellaneous",
};

export async function generateStaticParams() {
  const rows = await db.select({ slug: itemsTable.slug }).from(itemsTable);
  return rows.map((r) => ({ slug: r.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await loadCalcContext("US");
  const item = ctx.items.find((i) => i.slug === slug);
  if (!item) return {};
  const result = computeCalc([{ slug, quantity: 1 }], ctx);
  const it = result.items[0];
  const low = it?.item_value_low ?? 0;
  const high = it?.item_value_high ?? 0;
  const year = new Date().getFullYear();
  const month = new Date().toLocaleString("en-US", { month: "long" });
  const variable = item.avgWeightLb == null && high === 0 && low === 0;
  const desc = variable
    ? `${item.name} scrap value depends on length and gauge. See current per-pound rates, prep tips, and yards that buy ${item.name} near you.`
    : `A ${item.name} is worth approximately ${formatRange(low, high)} in scrap as of ${month} ${year}. See current prices, prep tips, and yards that buy ${item.name} near you.`;
  return {
    title: `How Much Is ${variable ? "" : "a "}${item.name} Worth in Scrap? (${year} Prices)`,
    description: desc.slice(0, 200),
    alternates: { canonical: `/what-is-it-worth/${slug}/` },
  };
}

export default async function ItemValuePage({ params }: Props) {
  const { slug } = await params;
  const ctx = await loadCalcContext("US");
  const item = ctx.items.find((i) => i.slug === slug);
  if (!item) notFound();

  const [itemRow] = await db.select().from(itemsTable).where(eq(itemsTable.slug, slug));
  const descriptionMd = itemRow?.descriptionMd ?? "";
  const prepTipsMd = itemRow?.prepTipsMd ?? "";

  const initialCart = [{ slug, quantity: 1 }];
  const initialResult = computeCalc(initialCart, ctx);
  const itemResult = initialResult.items[0]!;

  const isUnitPriced = itemResult.notes.some((n) => n.includes("Unit-priced"));
  const lowVal = itemResult.item_value_low;
  const highVal = itemResult.item_value_high;
  // Items like THHN wire have null avg_weight_lb AND lb-priced metals → no fixed per-unit value.
  // We surface per-lb component rates instead and skip price-bearing JSON-LD/copy.
  const isVariableSize = item.avgWeightLb == null && !isUnitPriced;

  // Sparkline data for dominant component
  const dominant = dominantMetalSlug(item);
  const dominantMetal = dominant ? ctx.metals.find((m) => m.slug === dominant) : undefined;
  const [history90, history30] = dominant
    ? await Promise.all([loadMetalHistory(dominant, 90), loadMetalHistory(dominant, 30)])
    : [[], []];
  const series30 = dominant ? projectItemValueSeries(item, ctx.metals, dominant, history30) : [];
  const range30 = summarizeRange(series30);

  // Related items (same category, excluding self), up to 6
  const related = ctx.items
    .filter((i) => i.category === item.category && i.slug !== slug)
    .slice(0, 6)
    .map((rel) => {
      const r = computeCalc([{ slug: rel.slug, quantity: 1 }], ctx);
      const ri = r.items[0]!;
      return { slug: rel.slug, name: rel.name, low: ri.item_value_low, high: ri.item_value_high };
    });

  const updatedDate = ctx.pricesAsOf ? formatPriceDate(ctx.pricesAsOf) : "today";
  const year = new Date().getFullYear();
  const isoNow = new Date().toISOString();
  const componentsList = itemResult.components
    .map((c) => `${c.metal_name} (${(c.lb_or_units).toFixed(2)} ${c.price_unit})`)
    .join(", ");

  // FAQ
  const faqs: Array<{ q: string; a: string }> = [
    {
      q: `How much is ${item.name} worth in scrap?`,
      a: isVariableSize
        ? `${item.name} value depends on length and gauge. Use the per-pound rates listed above (yards typically pay 50–70% of the spot price) and the calculator below to estimate your specific haul.`
        : `A typical ${item.name} is currently worth approximately ${formatRange(lowVal, highVal)} at scrap yards in the United States. The exact payout depends on local prices, yard quality, and how well you've prepped the material.`,
    },
    {
      q: `What metals are inside a ${item.name}?`,
      a: itemResult.components.length > 0
        ? `A ${item.name} contains: ${componentsList}. Per-component recovery rates and current prices determine the value.`
        : `Component data for ${item.name} is not yet available.`,
    },
    {
      q: `Should I prep a ${item.name} before scrapping?`,
      a: prepTipsMd
        ? prepTipsMd.slice(0, 600)
        : `Most yards pay better for clean, separated material. Spending a few minutes on prep can meaningfully increase your payout.`,
    },
    {
      q: `Where can I take a ${item.name} to scrap?`,
      a: `Use the ZIP code form above to find scrap yards near you that accept ${item.name}, with distance, contact info, and accepted-materials notes.`,
    },
  ];

  // JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://scrapyards.io/" },
      { "@type": "ListItem", position: 2, name: "What's It Worth", item: "https://scrapyards.io/what-is-it-worth/" },
      { "@type": "ListItem", position: 3, name: item.name, item: `https://scrapyards.io/what-is-it-worth/${slug}/` },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `How Much Is a ${item.name} Worth in Scrap?`,
    datePublished: isoNow,
    dateModified: isoNow,
    author: { "@type": "Organization", name: "Scrapyards.io" },
    publisher: { "@type": "Organization", name: "Scrapyards.io", url: "https://scrapyards.io/" },
    mainEntityOfPage: `https://scrapyards.io/what-is-it-worth/${slug}/`,
    description: `Estimated scrap value for a ${item.name}: ${formatRange(lowVal, highVal)} based on current US national prices.`,
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  // HowTo from prep tips. Parse bullet/numbered lines if present, else single-step.
  const prepSteps = prepTipsMd
    ? prepTipsMd
        .split(/\n+/)
        .map((line) => line.replace(/^[-*]\s+|^\d+\.\s+/, "").trim())
        .filter((line) => line.length > 0)
    : [];
  const howToJsonLd = prepSteps.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to prep a ${item.name} before scrapping`,
    description: `Steps to prepare a ${item.name} for the scrap yard.`,
    step: prepSteps.slice(0, 10).map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text: s,
    })),
  } : null;

  const offersJsonLd = isVariableSize
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "Product",
        name: item.name,
        category: CATEGORY_LABELS[item.category] ?? item.category,
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: lowVal.toFixed(2),
          highPrice: highVal.toFixed(2),
          offerCount: 1,
          availability: "https://schema.org/InStock",
          seller: { "@type": "Organization", name: "Scrap Yards (US)" },
        },
      };

  return (
    <div className="container wiit-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {howToJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      )}
      {offersJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(offersJsonLd) }} />
      )}

      <nav className="breadcrumb" style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
        <Link href="/">Home</Link> › <Link href="/what-is-it-worth/">What's It Worth</Link> › {item.name}
      </nav>

      {/* Section 1: Hero */}
      <header className="wiit-hero">
        <h1>How Much Is {isVariableSize ? "" : "a "}{item.name} Worth in Scrap?</h1>
        <p className="wiit-hero-lead">
          {isVariableSize ? (
            <>
              {item.name} scrap value depends on <strong>length and gauge</strong>. See the per-pound rates below
              for each component, then use the calculator to enter your specific weight or length.
            </>
          ) : (
            <>
              A {item.name} is currently worth approximately{" "}
              <span className="wiit-hero-value">{formatRange(lowVal, highVal)}</span>{" "}
              at scrap yards across the United States. The exact payout depends on local prices, yard quality, and
              how well you've prepped the material.
            </>
          )}
        </p>
        <div className="wiit-hero-meta">
          <span>Updated {updatedDate}</span>
          <span>·</span>
          <span>US national average</span>
          <span>·</span>
          <span>Yard payouts assumed at {Math.round(YARD_PAYOUT_LOW * 100)}–{Math.round(YARD_PAYOUT_HIGH * 100)}% of spot</span>
        </div>
        <Link href={`/calculator/?i=${encodeURIComponent(slug)}:1`} className="wiit-cta-btn">
          Calculate exact value for your area →
        </Link>
      </header>

      {/* Section 2: What's inside */}
      <section className="wiit-section">
        <h2>What's inside a {item.name}?</h2>
        {descriptionMd && <div className="wiit-prose"><p>{descriptionMd}</p></div>}
        {itemResult.components.length > 0 && (
          <table className="wiit-component-table">
            <thead>
              {isUnitPriced ? (
                <tr><th>Material</th><th>Pricing</th><th>Per-unit rate</th><th>Per-unit value</th></tr>
              ) : (
                <tr><th>Material</th><th>Weight per unit</th><th>Per-lb rate (yard pays)</th><th>Per-unit value</th></tr>
              )}
            </thead>
            <tbody>
              {itemResult.components.map((c) => (
                <tr key={c.metal_slug}>
                  <td>
                    <Link href={`/scrap-metal-prices/${c.metal_slug}/`}>{c.metal_name}</Link>
                  </td>
                  {isUnitPriced ? (
                    <td>Priced per {c.price_unit}</td>
                  ) : (
                    <td>{c.lb_or_units.toFixed(2)} lb</td>
                  )}
                  <td>
                    {formatMoney(c.unit_price_low)} – {formatMoney(c.unit_price_high)}
                    <span style={{ color: "var(--color-text-muted)" }}> /{c.price_unit}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {formatRange(c.value_low, c.value_high)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {itemResult.notes.length > 0 && (
          <ul style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            {itemResult.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
      </section>

      <AdSenseUnit />

      {/* Section 3: How to prep */}
      <section className="wiit-section">
        <h2>How to prep your {item.name} before scrapping</h2>
        {prepTipsMd ? (
          <div className="wiit-prose"><p style={{ whiteSpace: "pre-wrap" }}>{prepTipsMd}</p></div>
        ) : (
          <p style={{ color: "var(--color-text-muted)" }}>Prep tips coming soon.</p>
        )}
        <p style={{ marginTop: "0.75rem", fontStyle: "italic", color: "var(--color-text-muted)" }}>
          <strong>Why prep matters:</strong> Most yards pay different rates for clean vs. mixed material. An hour of
          prep can roughly double your payout per pound on copper-bearing items.
        </p>
      </section>

      {/* Section 4: What yards typically pay */}
      <section className="wiit-section">
        <h2>What yards typically pay</h2>
        {dominantMetal ? (
          <>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              90-day {dominantMetal.name} spot price (US average) — the dominant material in a {item.name}.
            </p>
            <PriceSparkline data={history90} label={`${dominantMetal.name} per ${dominantMetal.unit}`} />
            {range30 ? (
              <div className="wiit-history-summary">
                <strong>{item.name} value range over the past 30 days:</strong>{" "}
                {formatRange(range30.min, range30.max)}{" "}
                <span style={{ color: "var(--color-text-muted)" }}>
                  (based on {dominantMetal.name} price movement and {Math.round((item.components.find((c) => c.metal_slug === dominantMetal.slug)?.pct ?? 0) * 100)}% recovery rate)
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <p style={{ color: "var(--color-text-muted)" }}>Price history not available for this item yet.</p>
        )}
      </section>

      {/* Section 5: Find yards */}
      <section className="wiit-section">
        <h2>Find yards that buy {item.name} near you</h2>
        <p style={{ color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
          Enter your ZIP to see scrap yards within 25 miles that accept this material.
        </p>
        <FindYardsBox itemSlug={slug} itemName={item.name} />
      </section>

      {/* Section 6: Embedded Calculator */}
      <section className="wiit-section">
        <h2>Calculate value for your specific situation</h2>
        <p style={{ color: "var(--color-text-muted)", marginBottom: "1rem" }}>
          Adjust the quantity, add other items, or enter your ZIP for a localized estimate.
        </p>
        <Calculator
          ctx={ctx}
          initialCart={initialCart}
          initialZip=""
          initialResult={initialResult}
          syncUrl={false}
        />
      </section>

      <AdSenseUnit />

      {/* Section 7: Related items */}
      {related.length > 0 && (
        <section className="wiit-section">
          <h2>Related {CATEGORY_LABELS[item.category] ?? item.category}</h2>
          <div className="wiit-related-grid">
            {related.map((r) => (
              <Link key={r.slug} href={`/what-is-it-worth/${r.slug}/`} className="wiit-related-card">
                <div className="nm">{r.name}</div>
                <div className="vl">{formatRange(r.low, r.high)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Section 8: FAQ */}
      <section className="wiit-section wiit-faq">
        <h2>Frequently asked questions</h2>
        {faqs.map((f, i) => (
          <details key={i}>
            <summary>{f.q}</summary>
            <p style={{ whiteSpace: "pre-wrap" }}>{f.a}</p>
          </details>
        ))}
      </section>

      {/* Footer CTAs */}
      <div className="wiit-footer-cta">
        <Link href={`/calculator/?i=${encodeURIComponent(slug)}:1`} className="primary">
          Use the full calculator →
        </Link>
        <Link href="/scrap-metal-prices/" className="secondary">
          See all scrap metal prices
        </Link>
      </div>

      <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
        Estimates assume yard payouts at {Math.round(YARD_PAYOUT_LOW * 100)}–{Math.round(YARD_PAYOUT_HIGH * 100)}% of national spot.
        Actual payouts vary by region, yard, and material condition. Last updated {updatedDate}. © {year} Scrapyards.io
      </p>
    </div>
  );
}
