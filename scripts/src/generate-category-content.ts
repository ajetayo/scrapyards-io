/**
 * Generation script for metal-CATEGORY page content.
 *
 *   9 categories × 4 content blocks → upsert to metal_categories table.
 *
 * Validation: hard checks via the v3 stop-list block any write. Soft warnings
 * (no grade-name mention in market_drivers/grade_comparison) are logged but
 * do not block.
 *
 * Run:
 *   pnpm --filter @workspace/scripts run generate-category-content [-- --dry-run]
 */
import pg from "pg";
import {
  buildCategoryProfile,
  renderCategoryContent,
  CATEGORY_PROFILES,
} from "./category-content-templates.js";
import {
  validateCategoryContent,
  validateCategoryFaq,
  checkGradeMention,
  type CategoryContentFacts,
} from "./category-content-validator.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run") || args.has("--dry-run=true");

type CategoryRow = { slug: string; name: string };

async function main() {
  const t0 = Date.now();
  console.log(`Category content generation ${DRY_RUN ? "(DRY RUN)" : ""}`);

  const catsRes = await pool.query<CategoryRow>(`SELECT slug, name FROM metal_categories ORDER BY display_order, slug`);
  const cats = catsRes.rows;

  let written = 0;
  let flagged = 0;
  let softWarn = 0;

  for (const c of cats) {
    if (!CATEGORY_PROFILES[c.slug]) {
      console.warn(`  ⚠ ${c.slug}: no CATEGORY_PROFILES entry — skipping`);
      flagged++;
      continue;
    }
    const profile = buildCategoryProfile(c);
    const rendered = renderCategoryContent(profile);
    const facts: CategoryContentFacts = {
      category_name: c.name,
      category_slug: c.slug,
      family: profile.family,
      grade_names: profile.grade_names,
      purity_marks: profile.purity_marks,
    };

    const v1 = validateCategoryContent(rendered.about_md, "about", facts);
    const v2 = validateCategoryContent(rendered.market_drivers_md, "market_drivers", facts);
    const v3 = validateCategoryContent(rendered.grade_comparison_md, "grade_comparison", facts);
    const v4 = validateCategoryFaq(rendered.faq_json, facts);

    if (!v1.ok || !v2.ok || !v3.ok || !v4.ok) {
      flagged++;
      console.warn(`  ✗ ${c.slug} flagged:`);
      if (!v1.ok) console.warn(`      about: ${v1.reasons.join(", ")}`);
      if (!v2.ok) console.warn(`      market_drivers: ${v2.reasons.join(", ")}`);
      if (!v3.ok) console.warn(`      grade_comparison: ${v3.reasons.join(", ")}`);
      if (!v4.ok) console.warn(`      faq: ${v4.reasons.join(", ")}`);
      continue;
    }

    // Soft warning (does not block)
    const combined = `${rendered.market_drivers_md}\n${rendered.grade_comparison_md}`;
    if (!checkGradeMention(combined, profile.grade_names)) {
      softWarn++;
      console.warn(`  ⚠ ${c.slug}: soft warning — no grade name in market_drivers/grade_comparison`);
    }

    if (DRY_RUN) {
      console.log(
        `  ✓ ${c.slug} (about ${v1.word_count}w, drivers ${v2.word_count}w, grades ${v3.word_count}w, faq ${rendered.faq_json.length} Q&As ${v4.word_count}w)`,
      );
    } else {
      await pool.query(
        `UPDATE metal_categories
           SET about_md = $1,
               market_drivers_md = $2,
               grade_comparison_md = $3,
               faq_json = $4,
               content_generated_at = NOW()
         WHERE slug = $5`,
        [
          rendered.about_md,
          rendered.market_drivers_md,
          rendered.grade_comparison_md,
          JSON.stringify(rendered.faq_json),
          c.slug,
        ],
      );
      written++;
      console.log(`  ✓ ${c.slug} written`);
    }
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${DRY_RUN ? "Would write" : "Wrote"} ${DRY_RUN ? cats.length - flagged : written}/${cats.length}; ${flagged} flagged, ${softWarn} soft warnings. Done in ${dt}s.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
