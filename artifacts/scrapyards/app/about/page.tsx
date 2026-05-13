import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Scrapyards.io",
  description: "About Scrapyards.io — a free directory of US scrap yards with current scrap metal prices.",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <div className="container" style={{ padding: "2rem 1.25rem", maxWidth: 760 }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › About
      </nav>
      <h1>About Scrapyards.io</h1>
      <p style={{ marginTop: "1rem", lineHeight: 1.7 }}>
        Scrapyards.io is a free directory of scrap yards across the United States, paired with current scrap metal
        price references and a calculator that helps you estimate what your haul is worth before you drive to the yard.
      </p>
      <h2 style={{ marginTop: "2rem" }}>What you'll find here</h2>
      <ul style={{ marginTop: "0.75rem", paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>Yard listings for every state, with hours, accepted materials, and contact info</li>
        <li>National and per-state price references for 22 common scrap metals</li>
        <li>A garage scrap calculator that estimates a payout range from items you have on hand</li>
        <li>Item pages explaining what each common scrap item is worth and how to prep it</li>
      </ul>
      <h2 style={{ marginTop: "2rem" }}>How prices are calculated</h2>
      <p style={{ lineHeight: 1.7 }}>
        We track wholesale spot prices and combine them with reports submitted by users. The estimates shown are a
        typical retail-yard payout range — usually 50–70% of the underlying spot price. Always call ahead to confirm
        what your local yard is paying today.
      </p>
      <p style={{ marginTop: "2rem", color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
        Spot a listing that's out of date? <Link href="/contact/">Let us know</Link>.
      </p>
    </div>
  );
}
