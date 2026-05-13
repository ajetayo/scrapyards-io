/**
 * Builds the per-city enrichment data report consumed by city-desc-templates.
 *
 * One row per city; emitted as JSONL to stdout (or to scripts/city-enrichment-data.jsonl
 * with --out). All fields derived from existing public.yards rows.
 *
 * Service-focus classification is keyword-based on the yards.services text[]
 * (the schema has no service_focus column). A yard can be classified into
 * multiple buckets (e.g. a yard with both auto-* and steel-* services counts
 * in both). City-level majority is computed from boolean per-yard membership.
 */

import { Pool } from "pg";
import * as fs from "node:fs";

type CityRow = {
  city_id: number;
  state_code: string;
  state_slug: string;
  city_name: string;
  city_slug: string;
  yard_count: number;
  accepted_top_3: string[];
  accepted_total_unique: number;
  empty_accepted_pct: number;
  auto_count: number;
  industrial_count: number;
  general_count: number;
  service_focus_majority: "auto-salvage" | "industrial-steel" | "general-scrap" | "mixed";
  has_industrial_yards: boolean;
  has_auto_specialists: boolean;
  yards_with_hours: number;
  yards_with_phone: number;
  yards_with_website: number;
};

const AUTO_KEYWORDS = [
  "automobile-salvage",
  "automobile-parts-supplies",
  "used-rebuilt-auto-parts",
  "automobile-parts-supplies-used-rebuilt-wholesale-manufacturers",
  "automobile-accessories",
  "truck-wrecking",
];

const INDUSTRIAL_KEYWORDS = [
  "steel-distributors-warehouses",
  "steel-processing",
  "steel-erectors",
  "steel-fabricators",
  "steel-used",
  "demolition-contractors",
  "smelters-refiners-precious-metals",
  "metal-tubing",
  "metal-tanks",
  "metal-wholesale-manufacturers",
  "metal-specialties",
  "scrap-metals-wholesale",
  "recycling-equipment-services",
];

// Exclusive priority classification: auto > industrial > general. Each yard
// gets exactly one focus class so city-level counts sum to yard_count and the
// ratio math in focusMajority() is well-defined. Pre-fix this allowed multi-
// classification (auto+industrial+general all true for a single yard), which
// produced impossible aggregates like {yard_count:1, auto:1, industrial:1,
// general:1, ratio=1.0/each} and biased the majority label.
function classify(services: string[] | null): { auto: boolean; industrial: boolean; general: boolean } {
  const s = new Set(services ?? []);
  if (AUTO_KEYWORDS.some((k) => s.has(k))) return { auto: true, industrial: false, general: false };
  if (INDUSTRIAL_KEYWORDS.some((k) => s.has(k))) return { auto: false, industrial: true, general: false };
  return { auto: false, industrial: false, general: true };
}

function focusMajority(auto: number, industrial: number, general: number, total: number): CityRow["service_focus_majority"] {
  if (total === 0) return "general-scrap";
  if (auto / total > 0.5) return "auto-salvage";
  if (industrial / total > 0.5) return "industrial-steel";
  if (general / total >= 0.7) return "general-scrap";
  return "mixed";
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const pool = new Pool({ connectionString: url });

  const args = process.argv.slice(2);
  const outFlag = args.find((a) => a.startsWith("--out="));
  const outPath = outFlag ? outFlag.slice("--out=".length) : null;

  const sql = `
    SELECT
      c.id            AS city_id,
      c.state_code    AS state_code,
      s.slug          AS state_slug,
      c.name          AS city_name,
      c.slug          AS city_slug,
      y.id            AS yard_id,
      y.accepted      AS accepted,
      y.services      AS services,
      y.hours         AS hours,
      y.phone         AS phone,
      y.website       AS website
    FROM cities c
    JOIN states s ON s.code = c.state_code
    LEFT JOIN yards y ON y.city_id = c.id AND y.status = 'active'
    ORDER BY c.id
  `;
  const { rows } = await pool.query<{
    city_id: number; state_code: string; state_slug: string;
    city_name: string; city_slug: string;
    yard_id: number | null; accepted: string[] | null; services: string[] | null;
    hours: unknown; phone: string | null; website: string | null;
  }>(sql);

  // Group by city_id.
  const byCity = new Map<number, typeof rows>();
  for (const r of rows) {
    if (!byCity.has(r.city_id)) byCity.set(r.city_id, []);
    byCity.get(r.city_id)!.push(r);
  }

  const out: CityRow[] = [];
  for (const [, group] of byCity) {
    const head = group[0]!;
    const yards = group.filter((r) => r.yard_id != null);
    const total = yards.length;
    const acceptedFreq = new Map<string, number>();
    let emptyAccepted = 0;
    let auto = 0, industrial = 0, general = 0;
    let withHours = 0, withPhone = 0, withWebsite = 0;
    for (const y of yards) {
      const acc = y.accepted ?? [];
      if (acc.length === 0) emptyAccepted++;
      for (const a of acc) acceptedFreq.set(a, (acceptedFreq.get(a) ?? 0) + 1);
      const c = classify(y.services);
      if (c.auto) auto++;
      if (c.industrial) industrial++;
      if (c.general) general++;
      if (y.hours && typeof y.hours === "object" && Object.keys(y.hours).length > 0) withHours++;
      if (y.phone) withPhone++;
      if (y.website) withWebsite++;
    }
    const top3 = [...acceptedFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    out.push({
      city_id: head.city_id,
      state_code: head.state_code,
      state_slug: head.state_slug,
      city_name: head.city_name,
      city_slug: head.city_slug,
      yard_count: total,
      accepted_top_3: top3,
      accepted_total_unique: acceptedFreq.size,
      empty_accepted_pct: total === 0 ? 0 : Math.round((emptyAccepted / total) * 1000) / 10,
      auto_count: auto,
      industrial_count: industrial,
      general_count: general,
      service_focus_majority: focusMajority(auto, industrial, general, total),
      has_industrial_yards: industrial > 0,
      has_auto_specialists: auto > 0,
      yards_with_hours: withHours,
      yards_with_phone: withPhone,
      yards_with_website: withWebsite,
    });
  }

  out.sort((a, b) => a.city_id - b.city_id);

  const lines = out.map((r) => JSON.stringify(r)).join("\n") + "\n";
  if (outPath) {
    fs.writeFileSync(outPath, lines);
    process.stderr.write(`Wrote ${out.length} city rows to ${outPath}\n`);
  } else {
    process.stdout.write(lines);
  }

  // Summary to stderr.
  const buckets = { "0": 0, "1-3": 0, "4-15": 0, "16-30": 0, "30+": 0 };
  const focuses = { "auto-salvage": 0, "industrial-steel": 0, "general-scrap": 0, "mixed": 0 };
  for (const r of out) {
    const n = r.yard_count;
    if (n === 0) buckets["0"]++;
    else if (n <= 3) buckets["1-3"]++;
    else if (n <= 15) buckets["4-15"]++;
    else if (n <= 30) buckets["16-30"]++;
    else buckets["30+"]++;
    focuses[r.service_focus_majority]++;
  }
  process.stderr.write(`Summary: ${out.length} cities; buckets ${JSON.stringify(buckets)}; focus ${JSON.stringify(focuses)}\n`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export type { CityRow };
