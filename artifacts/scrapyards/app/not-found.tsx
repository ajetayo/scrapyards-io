import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container" style={{ padding: "4rem 1.25rem", textAlign: "center" }}>
      <h1 style={{ marginBottom: "1rem" }}>Page Not Found</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
        This yard, metal, or page doesn&apos;t exist yet.
      </p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/scrap-yards/" className="btn btn-primary">Browse Scrap Yards</Link>
        <Link href="/scrap-metal-prices/" className="btn" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          View Prices
        </Link>
      </div>
    </div>
  );
}
