/**
 * Coverage gate for metal-category content templates.
 *
 *   - Renders all 9 categories × 4 content blocks (about, market_drivers,
 *     grade_comparison, faq) and validates each.
 *   - Soft-warns when the category's grade names don't appear in
 *     market_drivers_md or grade_comparison_md (does not fail the gate).
 *
 * Required to pass before any bulk generation run.
 *
 * Run: pnpm --filter @workspace/scripts run category-content-coverage-check
 */
import {
  CATEGORY_PROFILES,
  buildCategoryProfile,
  renderCategoryContent,
} from "./category-content-templates.js";
import {
  validateCategoryContent,
  validateCategoryFaq,
  checkGradeMention,
  type CategoryContentFacts,
} from "./category-content-validator.js";

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  aluminum: "Aluminum",
  brass: "Brass",
  copper: "Copper",
  lead: "Lead",
  steel: "Steel & Iron",
  zinc: "Zinc",
  "auto-parts": "Auto Parts",
  electronics: "Electronics (E-Scrap)",
  "precious-metals": "Precious Metals",
};

let total = 0;
let failed = 0;
let softWarnings = 0;
const failures: string[] = [];
const warnings: string[] = [];

console.log(`Phase A: 9 categories × 4 content blocks (about, market_drivers, grade_comparison, faq)`);

for (const slug of Object.keys(CATEGORY_PROFILES)) {
  const name = CATEGORY_DISPLAY_NAMES[slug] ?? slug;
  const profile = buildCategoryProfile({ slug, name });
  const rendered = renderCategoryContent(profile);
  const facts: CategoryContentFacts = {
    category_name: name,
    category_slug: slug,
    family: profile.family,
    grade_names: profile.grade_names,
    purity_marks: profile.purity_marks,
  };

  for (const [type, text] of [
    ["about", rendered.about_md] as const,
    ["market_drivers", rendered.market_drivers_md] as const,
    ["grade_comparison", rendered.grade_comparison_md] as const,
  ]) {
    total++;
    const v = validateCategoryContent(text, type, facts);
    if (!v.ok) {
      failed++;
      failures.push(`${slug}/${type} (${v.word_count}w): ${v.reasons.join(", ")}`);
    }
  }

  total++;
  const fv = validateCategoryFaq(rendered.faq_json, facts);
  if (!fv.ok) {
    failed++;
    failures.push(`${slug}/faq (${fv.word_count}w, n=${rendered.faq_json.length}): ${fv.reasons.join(", ")}`);
  }

  // Soft-warning: at least one grade name should appear in market_drivers OR grade_comparison
  const combined = `${rendered.market_drivers_md}\n${rendered.grade_comparison_md}`;
  if (!checkGradeMention(combined, profile.grade_names)) {
    softWarnings++;
    warnings.push(`${slug}: no grade name appears in market_drivers/grade_comparison (grades: ${profile.grade_names.join(", ")})`);
  }
}

console.log(`\n${total - failed}/${total} pass`);
if (softWarnings > 0) {
  console.log(`\nSoft warnings (do not fail the gate):`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}
if (failed > 0) {
  console.error(`\n${failed} FAILURES:`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("✓ Coverage gate passed.");
