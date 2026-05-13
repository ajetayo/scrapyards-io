/**
 * Generation script for metal price page content.
 *
 *   - Phase A: 23 metals × 3 content blocks → upsert to metals table
 *   - Phase B: ~1,000 (metal, state) pairs → upsert to metal_state_content
 *
 * Coverage gate for state pages: skip if state has < MIN_YARDS_PER_STATE
 * yards accepting that metal.
 *
 * Run:
 *   pnpm --filter @workspace/scripts run generate-metal-content [--dry-run] [--limit-metals=N]
 */
import pg from "pg";
import {
  buildMetalProfile,
  renderNational,
  renderMarketContext,
  regionalDemandFactor,
  type StateContextInput,
} from "./metal-content-templates.js";
import {
  validateMetalContent,
  validateFaq,
  type MetalContentFacts,
} from "./metal-content-validator.js";
import { STATE_INDUSTRIES, FALLBACK_INDUSTRIES } from "./state-industries-seed.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(=(.+))?$/);
  if (!m) continue;
  args.set(m[1]!, m[3] ?? "true");
}
const DRY_RUN = args.has("dry-run");
const LIMIT_METALS = args.get("limit-metals") ? Number(args.get("limit-metals")) : null;
const MIN_YARDS_PER_STATE = 3;

type MetalRow = { slug: string; name: string; category: string; unit: string };
type StateRow = { code: string; slug: string; name: string; industries_text: string | null };
type CategoryRow = { slug: string; name: string };

async function seedStateIndustries(): Promise<void> {
  console.log("→ Seeding states.industries_text where NULL …");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let updated = 0;
    for (const [code, text] of Object.entries(STATE_INDUSTRIES)) {
      const r = await client.query(
        "UPDATE states SET industries_text = $1 WHERE code = $2 AND industries_text IS NULL",
        [text, code],
      );
      updated += r.rowCount ?? 0;
    }
    await client.query("COMMIT");
    console.log(`  ✓ Updated ${updated} state(s).`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function generateNational(metals: MetalRow[], categories: Map<string, string>): Promise<{ ok: number; flagged: number }> {
  let ok = 0;
  let flagged = 0;
  for (const m of metals) {
    const profile = buildMetalProfile(m);
    const categoryName = categories.get(m.category) ?? m.category;
    const rendered = renderNational(profile, categoryName);
    const facts: MetalContentFacts = {
      metal_name: m.name,
      category_name: categoryName,
      unit: m.unit,
    };
    const v1 = validateMetalContent(rendered.market_drivers_md, "market_drivers", facts);
    const v2 = validateMetalContent(rendered.grade_differences_md, "grade_differences", facts);
    const v3 = validateFaq(rendered.faq_json, facts);
    if (!v1.ok || !v2.ok || !v3.ok) {
      flagged++;
      console.warn(`  ⚠ ${m.slug} flagged:`);
      if (!v1.ok) console.warn(`    market_drivers: ${v1.reasons.join(", ")}`);
      if (!v2.ok) console.warn(`    grade_differences: ${v2.reasons.join(", ")}`);
      if (!v3.ok) console.warn(`    faq: ${v3.reasons.join(", ")}`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  ✓ ${m.slug} (${v1.word_count}w drivers, ${v2.word_count}w grades, ${rendered.faq_json.length} Q&As)`);
    } else {
      await pool.query(
        `UPDATE metals SET market_drivers_md=$1, grade_differences_md=$2, faq_json=$3, content_generated_at=NOW() WHERE slug=$4`,
        [rendered.market_drivers_md, rendered.grade_differences_md, JSON.stringify(rendered.faq_json), m.slug],
      );
      ok++;
    }
  }
  return { ok: DRY_RUN ? metals.length - flagged : ok, flagged };
}

async function generateState(metals: MetalRow[], states: StateRow[], categories: Map<string, string>) {
  let written = 0;
  let skipped = 0;
  let flagged = 0;
  for (const m of metals) {
    const profile = buildMetalProfile(m);
    const categoryName = categories.get(m.category) ?? m.category;
    for (const s of states) {
      // Coverage gate: yards in this state accepting this metal's category
      // (yards.accepted holds category-level slugs; empty = "accepts all"
      // per the calculator/find-yards convention in replit.md).
      const cnt = await pool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM yards
         WHERE state_code = $1 AND status = 'active'
         AND (accepted IS NULL OR array_length(accepted,1) IS NULL OR $2 = ANY(accepted))`,
        [s.code, m.category],
      );
      const yardCount = cnt.rows[0]?.c ?? 0;
      if (yardCount < MIN_YARDS_PER_STATE) {
        skipped++;
        continue;
      }
      // Top city = city in state with the most active yards (the category
      // filter would mostly tag empty-accepted yards anyway, so use raw count).
      const top = await pool.query<{ name: string }>(
        `SELECT c.name FROM cities c
         JOIN yards y ON y.city_id = c.id
         WHERE y.state_code = $1 AND y.status='active'
         GROUP BY c.id, c.name ORDER BY COUNT(*) DESC, c.name ASC LIMIT 1`,
        [s.code],
      );
      const topCity = top.rows[0]?.name ?? null;

      const input: StateContextInput = {
        metal: profile,
        state_name: s.name,
        state_code: s.code,
        state_industries: s.industries_text ?? STATE_INDUSTRIES[s.code] ?? FALLBACK_INDUSTRIES,
        top_city: topCity,
        yard_count: yardCount,
        regional_demand_factor: regionalDemandFactor(s.code, profile),
      };
      const text = renderMarketContext(input);
      const facts: MetalContentFacts = {
        metal_name: m.name,
        category_name: categoryName,
        unit: m.unit,
        state_name: s.name,
        state_code: s.code,
      };
      const v = validateMetalContent(text, "market_context", facts);
      if (!v.ok) {
        flagged++;
        console.warn(`  ⚠ ${m.slug}/${s.slug}: ${v.reasons.join(", ")}`);
        continue;
      }
      if (DRY_RUN) {
        written++;
      } else {
        await pool.query(
          `INSERT INTO metal_state_content (metal_slug, state_slug, market_context_md, content_generated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (metal_slug, state_slug) DO UPDATE SET market_context_md = EXCLUDED.market_context_md, content_generated_at = NOW()`,
          [m.slug, s.slug, text],
        );
        written++;
      }
    }
  }
  return { written, skipped, flagged };
}

async function main() {
  const t0 = Date.now();
  console.log(`Metal content generation ${DRY_RUN ? "(DRY RUN)" : ""}`);

  if (!DRY_RUN) await seedStateIndustries();

  // Load all metals, states, categories
  const metalsRes = await pool.query<MetalRow>(`SELECT slug, name, category, unit FROM metals ORDER BY display_order, slug`);
  const statesRes = await pool.query<StateRow>(`SELECT code, slug, name, industries_text FROM states ORDER BY name`);
  const catsRes = await pool.query<CategoryRow>(`SELECT slug, name FROM metal_categories`);
  const categories = new Map(catsRes.rows.map((c) => [c.slug, c.name]));

  const metalsAll = metalsRes.rows;
  const metals = LIMIT_METALS ? metalsAll.slice(0, LIMIT_METALS) : metalsAll;
  const states = statesRes.rows;

  console.log(`\nPhase A: National content for ${metals.length} metals`);
  const a = await generateNational(metals, categories);
  console.log(`  ✓ ${a.ok} written, ${a.flagged} flagged`);

  console.log(`\nPhase B: State content for ${metals.length} metals × ${states.length} states (gate: ≥${MIN_YARDS_PER_STATE} yards)`);
  const b = await generateState(metals, states, categories);
  console.log(`  ✓ ${b.written} written, ${b.skipped} skipped (under coverage gate), ${b.flagged} flagged`);

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDone in ${dt}s`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
