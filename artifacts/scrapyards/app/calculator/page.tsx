import type { Metadata } from "next";
import { loadCalcContext, computeCalc, decodeCart } from "@/lib/calculator";
import { resolveZip } from "@/lib/zip-to-state";
import { Calculator } from "./Calculator";
import "./calculator.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scrap Metal Calculator — Estimate Your Scrap Value",
  description:
    "Calculate the scrap value of your appliances, wire, pipe, batteries, and more. Free tool with current market prices and a list of yards that buy your materials near you.",
  alternates: { canonical: "https://scrapyards.io/calculator/" },
};

type SearchParams = Promise<{ i?: string; z?: string }>;

export default async function CalculatorPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const cart = decodeCart(sp.i);
  const zipRes = resolveZip(sp.z);
  const region = zipRes?.state ?? "US";

  // Load full base (items + metals) plus prices for the region
  const ctx = await loadCalcContext(region);
  const initialResult = computeCalc(cart, ctx);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How are these scrap prices calculated?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "We track wholesale spot prices on the LME and COMEX daily and combine them with reports from yards across the United States. The estimate you see is a typical retail-yard payout range, which is normally 50–70% of the underlying spot price.",
        },
      },
      {
        "@type": "Question",
        name: "Why is the value shown as a range?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yards typically pay 50–70% of the wholesale spot price for residential scrap, depending on the grade quality, how clean the material is, your local competition, and current demand. The low end of the range is a conservative estimate; the high end is what well-prepared, clean material at a competitive yard can earn.",
        },
      },
      {
        "@type": "Question",
        name: "Why does my actual payout differ from this estimate?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Real payouts vary by yard. Factors include: weight measurement at scale, grade downgrade for contamination (paint, plastic, water), per-yard pricing policies, and quantity tiers. Always call ahead for a specific quote on large hauls.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to prepare the metal first?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes — preparation usually pays. Stripping copper wire to bare-bright roughly doubles the per-pound rate. Removing brass fittings from copper pipe lets you sell each metal at its proper grade. Refrigerators and AC units must have refrigerant removed by an EPA-certified technician before scrapping.",
        },
      },
    ],
  };

  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Scrapyards.io Garage Calculator",
    url: "https://scrapyards.io/calculator/",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description:
      "Free scrap metal value calculator. Pick the items in your garage, enter your ZIP, and see what they're worth at local scrap yards.",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([appJsonLd, faqJsonLd]) }}
      />
      <div className="container calc-wrap">
        <nav className="breadcrumb">
          <a href="/">Home</a> / Garage Calculator
        </nav>
        <h1 style={{ marginBottom: "0.4rem" }}>Garage Scrap Calculator</h1>
        <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem", maxWidth: "60ch" }}>
          Add the items in your garage, basement, or job site. We&apos;ll estimate what
          they&apos;re worth at scrap yards near you using current market prices.
        </p>
        <Calculator
          ctx={ctx}
          initialCart={cart}
          initialZip={sp.z ?? ""}
          initialResult={initialResult}
        />
      </div>
    </>
  );
}
