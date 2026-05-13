/**
 * Bulk-generate city directory-page descriptions using the slot-filling
 * template library. Mirrors the architecture of
 * generate-yard-descriptions-templated.ts.
 *
 * Modes:
 *   --mode=pilot  Stratified 30-city sample (10 sparse + 10 mid + 10 dense)
 *   --mode=bulk   All cities with yard_count >= 1 (default)
 *
 * Flags:
 *   --dry-run     Don't write to DB; print to stdout
 *   --limit=N     Cap the row count (post-stratification for pilot mode)
 *   --slugs=a,b   Force-include these state/city slugs (comma-separated, formatted "{state}/{city}")
 *
 * Validation: every generated description goes through the city validator
 * (re-uses yard v3 stop-list). A failure is treated as a TEMPLATE-LIBRARY BUG,
 * not a per-city retry — the offending row is logged and skipped (description
 * left NULL).
 */

import { Pool } from "pg";
import { renderCityDescription, type CitySlotInput } from "./city-desc-templates";
import { validateCityDescription } from "./city-desc-validator";

type Args = {
  mode: "pilot" | "bulk";
  dryRun: boolean;
  limit: number | null;
  forceSlugs: Set<string>;
};

function parseArgs(argv: string[]): Args {
  const a: Args = { mode: "bulk", dryRun: false, limit: null, forceSlugs: new Set() };
  for (const x of argv) {
    if (x === "--dry-run") a.dryRun = true;
    else if (x.startsWith("--mode=")) {
      const v = x.slice("--mode=".length);
      if (v === "pilot" || v === "bulk") a.mode = v;
      else throw new Error(`bad --mode: ${v}`);
    } else if (x.startsWith("--limit=")) {
      a.limit = parseInt(x.slice("--limit=".length), 10);
    } else if (x.startsWith("--slugs=")) {
      for (const s of x.slice("--slugs=".length).split(",")) {
        if (s.trim()) a.forceSlugs.add(s.trim());
      }
    }
  }
  return a;
}

const AUTO_KEYWORDS = [
  "automobile-salvage", "automobile-parts-supplies", "used-rebuilt-auto-parts",
  "automobile-parts-supplies-used-rebuilt-wholesale-manufacturers",
  "automobile-accessories", "truck-wrecking",
];
const INDUSTRIAL_KEYWORDS = [
  "steel-distributors-warehouses", "steel-processing", "steel-erectors",
  "steel-fabricators", "steel-used", "demolition-contractors",
  "smelters-refiners-precious-metals", "metal-tubing", "metal-tanks",
  "metal-wholesale-manufacturers", "metal-specialties", "scrap-metals-wholesale",
  "recycling-equipment-services",
];

// Exclusive priority classification — see city-enrichment-report.ts for rationale.
function classifyServices(services: string[] | null): { auto: boolean; industrial: boolean; general: boolean } {
  const s = new Set(services ?? []);
  if (AUTO_KEYWORDS.some((k) => s.has(k))) return { auto: true, industrial: false, general: false };
  if (INDUSTRIAL_KEYWORDS.some((k) => s.has(k))) return { auto: false, industrial: true, general: false };
  return { auto: false, industrial: false, general: true };
}

function focusMajority(auto: number, industrial: number, general: number, total: number): CitySlotInput["service_focus_majority"] {
  if (total === 0) return "general-scrap";
  if (auto / total > 0.5) return "auto-salvage";
  if (industrial / total > 0.5) return "industrial-steel";
  if (general / total >= 0.7) return "general-scrap";
  return "mixed";
}

async function loadCityInputs(pool: Pool): Promise<CitySlotInput[]> {
  const sql = `
    SELECT
      c.id            AS city_id,
      c.state_code    AS state_code,
      s.slug          AS state_slug,
      c.name          AS city_name,
      c.slug          AS city_slug,
      y.id            AS yard_id,
      y.accepted      AS accepted,
      y.services      AS services
    FROM cities c
    JOIN states s ON s.code = c.state_code
    LEFT JOIN yards y ON y.city_id = c.id AND y.status = 'active'
    ORDER BY c.id
  `;
  const { rows } = await pool.query<{
    city_id: number; state_code: string; state_slug: string;
    city_name: string; city_slug: string;
    yard_id: number | null; accepted: string[] | null; services: string[] | null;
  }>(sql);

  const byCity = new Map<number, typeof rows>();
  for (const r of rows) {
    if (!byCity.has(r.city_id)) byCity.set(r.city_id, []);
    byCity.get(r.city_id)!.push(r);
  }

  const out: CitySlotInput[] = [];
  for (const group of byCity.values()) {
    const head = group[0]!;
    const yards = group.filter((r) => r.yard_id != null);
    const total = yards.length;
    const acc = new Map<string, number>();
    let empty = 0, auto = 0, industrial = 0, general = 0;
    for (const y of yards) {
      const a = y.accepted ?? [];
      if (a.length === 0) empty++;
      for (const x of a) acc.set(x, (acc.get(x) ?? 0) + 1);
      const c = classifyServices(y.services);
      if (c.auto) auto++;
      if (c.industrial) industrial++;
      if (c.general) general++;
    }
    const top3 = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    out.push({
      state_code: head.state_code,
      state_slug: head.state_slug,
      city_name: head.city_name,
      city_slug: head.city_slug,
      yard_count: total,
      accepted_top_3: top3,
      accepted_total_unique: acc.size,
      empty_accepted_pct: total === 0 ? 0 : Math.round((empty / total) * 1000) / 10,
      auto_count: auto,
      industrial_count: industrial,
      general_count: general,
      service_focus_majority: focusMajority(auto, industrial, general, total),
      has_industrial_yards: industrial > 0,
      has_auto_specialists: auto > 0,
    });
    // city_id is needed for the UPDATE; smuggle via a side table.
    cityIdBySlug.set(`${head.state_code}/${head.city_slug}`, head.city_id);
  }
  return out;
}

const cityIdBySlug = new Map<string, number>();

function pilotSample(all: CitySlotInput[], forceSlugs: Set<string>): CitySlotInput[] {
  // Stratify: 10 sparse (yard_count 1-3, mostly empty accepted), 10 mid (4-15),
  // 10 dense (20+). Deterministic order via slug.
  const sparse = all
    .filter((c) => c.yard_count >= 1 && c.yard_count <= 3 && c.empty_accepted_pct >= 50)
    .sort((a, b) => a.city_slug.localeCompare(b.city_slug))
    .slice(0, 10);
  const mid = all
    .filter((c) => c.yard_count >= 4 && c.yard_count <= 15)
    .sort((a, b) => a.city_slug.localeCompare(b.city_slug))
    .slice(0, 10);
  const dense = all
    .filter((c) => c.yard_count >= 20)
    .sort((a, b) => a.city_slug.localeCompare(b.city_slug))
    .slice(0, 10);
  const sample = [...sparse, ...mid, ...dense];
  const have = new Set(sample.map((c) => `${c.state_code}/${c.city_slug}`));
  // Append any forced slugs not already in the sample.
  for (const c of all) {
    const k = `${c.state_slug}/${c.city_slug}`;
    if (forceSlugs.has(k) && !have.has(`${c.state_code}/${c.city_slug}`)) {
      sample.push(c);
    }
  }
  return sample;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const pool = new Pool({ connectionString: url });

  process.stderr.write(`Loading city inputs from DB…\n`);
  const all = await loadCityInputs(pool);
  process.stderr.write(`Loaded ${all.length} cities.\n`);

  let targets = all.filter((c) => c.yard_count >= 1);
  if (args.mode === "pilot") {
    targets = pilotSample(all, args.forceSlugs);
  }
  if (args.limit != null) {
    targets = targets.slice(0, args.limit);
  }

  process.stderr.write(`Target: ${targets.length} cities (mode=${args.mode}, dry-run=${args.dryRun}).\n`);

  let ok = 0, failed = 0, written = 0;
  const failures: { slug: string; reasons: string[] }[] = [];
  const samples: { slug: string; text: string; templates: unknown; words: number }[] = [];

  for (const c of targets) {
    const r = renderCityDescription(c);
    const v = validateCityDescription(r.text, {
      city: c.city_name,
      state: c.state_code,
      yard_count: c.yard_count,
      auto_count: c.auto_count,
      industrial_count: c.industrial_count,
      general_count: c.general_count,
      accepted_top_3: c.accepted_top_3,
    });
    const slugK = `${c.state_slug}/${c.city_slug}`;
    if (!v.ok) {
      failed++;
      failures.push({ slug: slugK, reasons: v.reasons });
      continue;
    }
    ok++;
    samples.push({ slug: slugK, text: r.text, templates: r.template_ids, words: r.text.split(/\s+/).length });

    if (!args.dryRun) {
      const cityId = cityIdBySlug.get(`${c.state_code}/${c.city_slug}`);
      if (cityId == null) {
        process.stderr.write(`  WARN: no city_id for ${slugK}\n`);
        continue;
      }
      await pool.query(
        `UPDATE cities SET description_md = $1, description_generated_at = NOW() WHERE id = $2`,
        [r.text, cityId],
      );
      written++;
    }
  }

  process.stderr.write(`\nResults: ${ok} ok, ${failed} failed, ${written} written.\n`);
  if (failed > 0) {
    process.stderr.write(`Failures (template-library bugs to fix):\n`);
    for (const f of failures.slice(0, 20)) {
      process.stderr.write(`  ${f.slug}: ${f.reasons.join("; ")}\n`);
    }
  }

  if (args.mode === "pilot") {
    // Print 6 random samples (2 sparse, 2 mid, 2 dense) + word-count distribution.
    const pickSample = (sl: typeof samples) =>
      sl.length === 0 ? [] : [sl[0]!, sl[Math.floor(sl.length / 2)]!];
    const sparseS = samples.filter((s) => /sparse|1-3/.test("")).slice(0, 0); // collapse: just print first 6
    void sparseS;
    process.stderr.write(`\nFirst 6 samples:\n`);
    for (const s of samples.slice(0, 6)) {
      process.stderr.write(`\n  --- ${s.slug} (${s.words} words) ---\n`);
      process.stderr.write(`  templates: ${JSON.stringify(s.templates)}\n`);
      process.stderr.write(`  text: ${s.text}\n`);
    }
    const wcs = samples.map((s) => s.words).sort((a, b) => a - b);
    if (wcs.length) {
      process.stderr.write(`\n  Word count: min=${wcs[0]} p25=${wcs[Math.floor(wcs.length / 4)]} median=${wcs[Math.floor(wcs.length / 2)]} p75=${wcs[Math.floor((wcs.length * 3) / 4)]} max=${wcs[wcs.length - 1]}\n`);
    }
  }

  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
