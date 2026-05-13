import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact Scrapyards.io",
  description: "Get in touch with Scrapyards.io — corrections, listing updates, partnerships, and general inquiries.",
  alternates: { canonical: "/contact/" },
};

export default function ContactPage() {
  return (
    <div className="container" style={{ padding: "2rem 1.25rem", maxWidth: 760 }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › Contact
      </nav>
      <h1>Contact</h1>
      <p style={{ marginTop: "1rem", lineHeight: 1.7 }}>
        Reach out for corrections, listing updates, partnership inquiries, or general questions.
      </p>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Email</h2>
        <p>
          <a href="mailto:hello@scrapyards.io">hello@scrapyards.io</a>
        </p>
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
          We typically respond within 1–2 business days.
        </p>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Listing corrections</h2>
        <p>
          If a yard listing is wrong (closed, moved, wrong hours, wrong phone) please email us with the yard URL
          and a brief description of the change. We'll review and update within a few business days.
        </p>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Yard owners</h2>
        <p>
          Want to claim or update your yard's listing? Email us from a domain or address we can verify against
          your business and we'll get you set up.
        </p>
      </div>

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
        <em>Note:</em> Contact details on this page are placeholders — REPLACE BEFORE LAUNCH.
      </p>
    </div>
  );
}
