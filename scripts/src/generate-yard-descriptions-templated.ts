/**
 * Templated yard description pipeline (slot-filling, no LLM).
 *
 * Pivot from v1/v2/v3 free-form generation. Pre-screened sentence templates
 * + deterministic slot filling means the validator's stop-list is satisfied
 * by construction, the output is auditable, and the bulk run costs $0 in
 * API spend.
 *
 * Run:
 *   pnpm --filter @workspace/scripts run generate-yard-descriptions-templated [--mode=pilot|bulk]
 *                                                                              [--dry-run]
 *                                                                              [--limit=N]
 *
 * Pilot cohort (50 yards, no overlap with v1/v2/v3 pilot files):
 *   - 30 sparse-data (exercises the expanded 20-template no-data pool)
 *   -  5 auto-salvage focus  (verifies "an auto salvage" a/an fix)
 *   -  5 with-data (full website + hours + accepted)
 *   -  5 multi-yard cities
 *   -  5 random
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  validateDescription,
  countWords,
  TARGET_WORDS_MIN,
  TARGET_WORDS_MAX,
} from "./yard-desc-validator.js";
import {
  renderDescription,
  TEMPLATE_POOLS,
  type YardSlotInput,
} from "./yard-desc-templates.js";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const OUTPUT_DIR = path.join(REPO_ROOT, "migration", "output");
const ZIP_COUNTIES_FILE = path.join(REPO_ROOT, "migration", "data", "zip-counties.json");

const V1_PILOT_FILE = path.join(OUTPUT_DIR, "pilot-yard-ids.json");
const V2_PILOT_FILE = path.join(OUTPUT_DIR, "pilot-v2-yard-ids.json");
const V3_PILOT_FILE = path.join(OUTPUT_DIR, "pilot-v3-yard-ids.json");
const TEMPLATED_PILOT_FILE = path.join(OUTPUT_DIR, "pilot-templated-yard-ids.json");
const TEMPLATED_LOG_FILE = path.join(OUTPUT_DIR, "yard-desc-templated-pilot-log.jsonl");
const TEMPLATED_FLAGGED_FILE = path.join(OUTPUT_DIR, "yard-desc-templated-pilot-flagged.csv");
const TEMPLATED_REPORT_FILE = path.join(OUTPUT_DIR, "yard-desc-templated-pilot-report.md");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ZIP_COUNTIES: Record<string, string> = (() => {
  if (!fs.existsSync(ZIP_COUNTIES_FILE)) return {};
  return JSON.parse(fs.readFileSync(ZIP_COUNTIES_FILE, "utf8")) as Record<string, string>;
})();

// ---- CLI ----

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(=(.+))?$/);
  if (!m) continue;
  args.set(m[1]!, m[3] ?? "true");
}
const MODE = (args.get("mode") ?? "pilot") as "pilot" | "bulk";
const DRY_RUN = args.has("dry-run");
const LIMIT = args.get("limit") ? Number(args.get("limit")) : null;

// ---- Types ----

type YardRow = {
  id: number;
  slug: string;
  name: string;
  state_code: string;
  city_name: string;
  zip: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  hours: unknown;
  accepted: string[] | null;
  services: string[] | null;
};

function buildSlotInput(y: YardRow): YardSlotInput {
  const accepted = (y.accepted ?? []).filter(Boolean);
  const services = (y.services ?? []).filter(Boolean);
  const hoursObj = y.hours as Record<string, unknown> | null;
  const hoursStructured =
    hoursObj != null && typeof hoursObj === "object" && Object.keys(hoursObj).length > 0;

  const sset = new Set(services.map((s) => s.toLowerCase()));
  const auto = ["automobile-salvage", "automobile-parts-supplies", "used-rebuilt-auto-parts", "truck-wrecking", "automobile-accessories"];
  const ind = ["steel-distributors-warehouses", "steel-processing", "steel-fabricators", "steel-erectors", "metal-tubing", "metal-tanks", "smelters-refiners-precious-metals"];
  const dem = ["demolition-contractors", "garbage-collection", "rubbish-removal", "trash-hauling"];
  const autoHits = auto.filter((s) => sset.has(s)).length;
  const indHits = ind.filter((s) => sset.has(s)).length;
  const demHits = dem.filter((s) => sset.has(s)).length;
  const top = Math.max(autoHits, indHits, demHits);
  let focus: YardSlotInput["service_focus"] = "general-scrap";
  if (top === 0) focus = "general-scrap";
  else if (autoHits === top && autoHits > 0) focus = "auto-salvage";
  else if (indHits === top) focus = "industrial";
  else if (demHits === top) focus = "demolition";
  if (autoHits > 0 && indHits > 0) focus = "mixed";

  const county = y.zip ? ZIP_COUNTIES[y.zip] ?? null : null;

  return {
    yard_id: y.id,
    slug: y.slug,
    name: y.name,
    city: y.city_name,
    state: y.state_code,
    county,
    county_known: county != null,
    has_phone: !!y.phone,
    has_website: !!y.website,
    has_email: !!y.email,
    hours_structured: hoursStructured,
    accepted_categories: accepted,
    accepted_on_file: accepted.length > 0,
    service_focus: focus,
  };
}

// ---- Cohort selection ----

async function pickPilotIds(): Promise<Map<number, string>> {
  const exclude: number[] = [];
  for (const f of [V1_PILOT_FILE, V2_PILOT_FILE, V3_PILOT_FILE]) {
    if (fs.existsSync(f)) {
      const arr = JSON.parse(fs.readFileSync(f, "utf8")) as Array<{ yard_id: number }>;
      exclude.push(...arr.map((r) => r.yard_id));
    }
  }
  const chosen = new Map<number, string>();
  const add = (id: number, cohort: string) => {
    if (!chosen.has(id)) chosen.set(id, cohort);
  };

  const exParam = (extra: number[]) => {
    const all = [...exclude, ...extra];
    return all.length > 0 ? all : [0];
  };

  // v2.1 mini-pilot cohort: 12 sparse / 5 with-data / 3 random = 20 yards.
  // 1. 12 sparse-data (exercises the 20-template no-data pool + closer floor)
  const sparse = await pool.query<{ id: number }>(
    `SELECT id FROM public.yards
       WHERE status='active'
         AND COALESCE(array_length(accepted,1),0)=0
         AND website IS NULL AND hours IS NULL
         AND NOT (id = ANY($1::int[]))
       ORDER BY md5(id::text) LIMIT 12`,
    [exParam([])],
  );
  for (const r of sparse.rows) add(r.id, "sparse-data");

  // 2. 5 with-data (full website + hours + accepted)
  const withData = await pool.query<{ id: number }>(
    `SELECT id FROM public.yards
       WHERE status='active'
         AND COALESCE(array_length(accepted,1),0) > 0
         AND hours IS NOT NULL AND website IS NOT NULL
         AND NOT (id = ANY($1::int[]))
       ORDER BY md5(id::text) LIMIT 5`,
    [exParam([...chosen.keys()])],
  );
  for (const r of withData.rows) add(r.id, "with-data");

  // 3. 3 random
  const rnd = await pool.query<{ id: number }>(
    `SELECT id FROM public.yards
       WHERE status='active'
         AND NOT (id = ANY($1::int[]))
       ORDER BY md5(id::text) LIMIT 3`,
    [exParam([...chosen.keys()])],
  );
  for (const r of rnd.rows) add(r.id, "random");

  return chosen;
}

// ---- Persistence ----

async function loadYard(id: number): Promise<YardRow | null> {
  const r = await pool.query<YardRow>(
    `SELECT y.id, y.slug, y.name, y.state_code, c.name AS city_name,
            y.zip, y.phone, y.website, y.email, y.hours, y.accepted, y.services
       FROM public.yards y JOIN public.cities c ON c.id = y.city_id
       WHERE y.id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

async function writeBack(yardId: number, description: string): Promise<void> {
  await pool.query(
    `UPDATE public.yards
       SET description = $2,
           description_generated_at = NOW(),
           description_flagged_at = NULL,
           description_flag_reason = NULL,
           updated_at = NOW()
     WHERE id = $1`,
    [yardId, description],
  );
}

async function writeFlag(yardId: number, reason: string): Promise<void> {
  await pool.query(
    `UPDATE public.yards
       SET description_flagged_at = NOW(),
           description_flag_reason = $2,
           updated_at = NOW()
     WHERE id = $1`,
    [yardId, reason.slice(0, 1000)],
  );
}

// ---- Main ----

type LogEntry = {
  yard_id: number;
  slug: string;
  cohort: string;
  facts: YardSlotInput;
  description: string;
  word_count: number;
  template_ids: { opening: string; materials: string; operations: string; closer: string };
  attempts: number;
  validator_ok: boolean;
  validator_reasons: string[];
  generated_at: string;
};

async function main() {
  console.log(`[start] mode=${MODE} dry-run=${DRY_RUN} limit=${LIMIT ?? "none"}`);

  let pilotIds: Map<number, string>;
  if (MODE === "pilot") {
    if (fs.existsSync(TEMPLATED_PILOT_FILE)) {
      const arr = JSON.parse(fs.readFileSync(TEMPLATED_PILOT_FILE, "utf8")) as Array<{ yard_id: number; cohort: string }>;
      pilotIds = new Map(arr.map((r) => [r.yard_id, r.cohort]));
      console.log(`[load] reusing ${TEMPLATED_PILOT_FILE} (${pilotIds.size} ids)`);
    } else {
      pilotIds = await pickPilotIds();
      const arr = [...pilotIds.entries()].map(([yard_id, cohort]) => ({ yard_id, cohort }));
      fs.writeFileSync(TEMPLATED_PILOT_FILE, JSON.stringify(arr, null, 2));
      console.log(`[select] wrote ${TEMPLATED_PILOT_FILE} (${arr.length} ids)`);
    }
  } else {
    // bulk: every active yard with no description AND no flag
    const r = await pool.query<{ id: number }>(
      `SELECT id FROM public.yards
         WHERE status='active'
           AND description IS NULL
           AND description_flagged_at IS NULL
         ORDER BY id`,
    );
    pilotIds = new Map(r.rows.map((row) => [row.id, "bulk"]));
    console.log(`[bulk] queue size ${pilotIds.size}`);
  }

  const ids = [...pilotIds.keys()];
  const targetIds = LIMIT ? ids.slice(0, LIMIT) : ids;
  console.log(`[generate] processing ${targetIds.length} yards`);

  // Truncate log file at start of pilot run for a clean slate.
  if (MODE === "pilot" && !fs.existsSync(TEMPLATED_LOG_FILE.replace(".jsonl", ".lock"))) {
    fs.writeFileSync(TEMPLATED_LOG_FILE, "");
    fs.writeFileSync(TEMPLATED_FLAGGED_FILE, "yard_id,slug,reason\n");
  }

  let success = 0;
  let dropped = 0;

  for (const yid of targetIds) {
    const row = await loadYard(yid);
    if (!row) {
      console.warn(`[skip] yard ${yid} not found`);
      continue;
    }
    const facts = buildSlotInput(row);
    let result;
    try {
      result = renderDescription(facts);
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`[render-fail] yard ${yid}: ${msg}`);
      if (!DRY_RUN) await writeFlag(yid, `render_error: ${msg}`);
      fs.appendFileSync(TEMPLATED_FLAGGED_FILE, `${yid},${row.slug},"render: ${msg}"\n`);
      dropped++;
      continue;
    }

    const validation = validateDescription(result.description, {
      yard_id: facts.yard_id,
      name: facts.name,
      city: facts.city,
      state: facts.state,
      zip: row.zip,
      county: facts.county,
      county_known: facts.county_known,
    });

    const entry: LogEntry = {
      yard_id: facts.yard_id,
      slug: facts.slug,
      cohort: pilotIds.get(yid) ?? "unknown",
      facts,
      description: result.description,
      word_count: result.word_count,
      template_ids: result.template_ids,
      attempts: 1,
      validator_ok: validation.ok,
      validator_reasons: validation.reasons,
      generated_at: new Date().toISOString(),
    };
    fs.appendFileSync(TEMPLATED_LOG_FILE, JSON.stringify(entry) + "\n");

    if (!validation.ok) {
      console.warn(`[validate-fail] yard ${yid}: ${validation.reasons.slice(0, 3).join("; ")}`);
      if (!DRY_RUN) await writeFlag(yid, validation.reasons.join("; "));
      fs.appendFileSync(TEMPLATED_FLAGGED_FILE, `${yid},${row.slug},"${validation.reasons.join("; ")}"\n`);
      dropped++;
      continue;
    }

    if (!DRY_RUN) await writeBack(yid, result.description);
    success++;
    if (success % 25 === 0) console.log(`[progress] ${success} ok / ${dropped} dropped of ${targetIds.length}`);
  }

  console.log(`[done] success=${success} dropped=${dropped} of ${targetIds.length}`);
  console.log(`[pools] opening=${TEMPLATE_POOLS.opening.length} materials_with_data=${TEMPLATE_POOLS.materials_with_data.length} materials_no_data=${TEMPLATE_POOLS.materials_no_data.length} operations=${TEMPLATE_POOLS.operations.length} closer_general=${TEMPLATE_POOLS.closer_general.length} closer_auto=${TEMPLATE_POOLS.closer_auto.length} closer_industrial=${TEMPLATE_POOLS.closer_industrial.length}`);
  console.log(`[targets] word range ${TARGET_WORDS_MIN}-${TARGET_WORDS_MAX}`);

  await pool.end();
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
