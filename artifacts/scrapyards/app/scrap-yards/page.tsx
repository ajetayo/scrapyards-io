import { db } from "@/lib/db";
import { statesTable, yardsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Scrap Yards in the United States — Find a Yard Near You",
  description: "Browse scrap yards by state. Find hours, accepted materials, and current scrap prices at thousands of yards across the US.",
};

export default async function ScrapYardsPage() {
  const statesWithCounts = await db
    .select({
      code: statesTable.code,
      slug: statesTable.slug,
      name: statesTable.name,
      yardCount: sql<number>`count(${yardsTable.id})::int`,
    })
    .from(statesTable)
    .leftJoin(yardsTable, eq(yardsTable.stateCode, statesTable.code))
    .groupBy(statesTable.code, statesTable.slug, statesTable.name)
    .orderBy(statesTable.name);

  const total = statesWithCounts.reduce((s, r) => s + (r.yardCount || 0), 0);

  return (
    <div className="container" style={{ padding: "2rem 1.25rem" }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › Scrap Yards
      </nav>
      <h1 style={{ marginBottom: "0.5rem" }}>Scrap Yards in the United States</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
        Browse {total.toLocaleString()} scrap yards across all 50 states.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
        {statesWithCounts.map((s) => (
          <Link
            key={s.code}
            href={`/scrap-yards/${s.slug}/`}
            className="card"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit" }}
          >
            <span style={{ fontWeight: 600 }}>{s.name}</span>
            {s.yardCount > 0 && (
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>{s.yardCount} yards</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
