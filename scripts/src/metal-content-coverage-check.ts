/**
 * Coverage gate for metal content templates.
 *
 *   - Renders all 23 metals × national content (3 blocks each) and validates.
 *   - Renders 23 metals × every U.S. state × market_context with synthetic
 *     yard_count / top_city values for full template surface coverage,
 *     and validates each.
 *
 * Required to pass before any bulk generation run.
 */
import {
  buildMetalProfile,
  renderNational,
  renderMarketContext,
  regionalDemandFactor,
  METAL_PROFILES,
} from "./metal-content-templates.js";
import { validateMetalContent, validateFaq } from "./metal-content-validator.js";
import { STATE_INDUSTRIES } from "./state-industries-seed.js";

// Synthetic metals from the profile registry. We don't need a DB connection
// for the coverage check — every slug, name, category and unit is hardcoded
// here to mirror what's in the metals table.
const METAL_NAMES: Record<string, { name: string; category: string; unit: string }> = {
  "bare-bright-copper": { name: "Bare Bright Copper", category: "copper", unit: "lb" },
  "copper-1": { name: "#1 Copper", category: "copper", unit: "lb" },
  "copper-2": { name: "#2 Copper", category: "copper", unit: "lb" },
  "insulated-copper-wire": { name: "Insulated Copper Wire", category: "copper", unit: "lb" },
  "copper-pipe": { name: "Copper Pipe (Clean)", category: "copper", unit: "lb" },
  "aluminum-mixed": { name: "Aluminum (Mixed)", category: "aluminum", unit: "lb" },
  "aluminum-cans": { name: "Aluminum Cans", category: "aluminum", unit: "lb" },
  "aluminum-extrusion": { name: "Aluminum Extrusion", category: "aluminum", unit: "lb" },
  "steel-heavy-melt": { name: "Steel (Heavy Melt)", category: "steel", unit: "ton" },
  "light-iron": { name: "Light Iron / Sheet", category: "steel", unit: "ton" },
  "cast-iron": { name: "Cast Iron", category: "steel", unit: "lb" },
  "stainless-steel": { name: "Stainless Steel (304)", category: "steel", unit: "lb" },
  "brass-yellow": { name: "Yellow Brass", category: "brass", unit: "lb" },
  "brass-red": { name: "Red Brass", category: "brass", unit: "lb" },
  "lead-soft": { name: "Lead (Soft)", category: "lead", unit: "lb" },
  "lead-wheel-weights": { name: "Lead Wheel Weights", category: "lead", unit: "lb" },
  "zinc-die-cast": { name: "Zinc Die Cast", category: "zinc", unit: "lb" },
  "low-grade-board": { name: "Low-Grade Circuit Board", category: "electronics", unit: "lb" },
  "high-grade-board": { name: "High-Grade Circuit Board", category: "electronics", unit: "lb" },
  "silver": { name: "Silver (.999)", category: "precious-metals", unit: "oz" },
  "gold": { name: "Gold (.999)", category: "precious-metals", unit: "oz" },
  "car-battery": { name: "Car Battery", category: "auto-parts", unit: "each" },
  "catalytic-converter": { name: "Catalytic Converter", category: "auto-parts", unit: "each" },
};

const CATEGORY_NAMES: Record<string, string> = {
  copper: "Copper",
  aluminum: "Aluminum",
  steel: "Steel",
  brass: "Brass",
  lead: "Lead",
  zinc: "Zinc",
  electronics: "Electronics",
  "precious-metals": "Precious Metals",
  "auto-parts": "Auto Parts",
};

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

let total = 0;
let failed = 0;
const failures: string[] = [];

console.log("Phase A: National content (23 metals × 3 blocks)");
for (const slug of Object.keys(METAL_PROFILES)) {
  const meta = METAL_NAMES[slug];
  if (!meta) {
    console.warn(`  ⚠ no METAL_NAMES entry for ${slug}, skipping`);
    continue;
  }
  const profile = buildMetalProfile({ slug, ...meta });
  const categoryName = CATEGORY_NAMES[meta.category] ?? meta.category;
  const rendered = renderNational(profile, categoryName);
  const facts = { metal_name: meta.name, category_name: categoryName, unit: meta.unit };

  for (const [type, text] of [
    ["market_drivers", rendered.market_drivers_md] as const,
    ["grade_differences", rendered.grade_differences_md] as const,
  ]) {
    total++;
    const v = validateMetalContent(text, type, facts);
    if (!v.ok) {
      failed++;
      failures.push(`${slug}/${type}: ${v.reasons.join(", ")}`);
    }
  }
  total++;
  const fv = validateFaq(rendered.faq_json, facts);
  if (!fv.ok) {
    failed++;
    failures.push(`${slug}/faq: ${fv.reasons.join(", ")}`);
  }
}

console.log(`Phase B: State content (${Object.keys(METAL_PROFILES).length} metals × ${Object.keys(STATE_NAMES).length} states × 2 top_city shapes)`);
for (const slug of Object.keys(METAL_PROFILES)) {
  const meta = METAL_NAMES[slug];
  if (!meta) continue;
  const profile = buildMetalProfile({ slug, ...meta });
  const categoryName = CATEGORY_NAMES[meta.category] ?? meta.category;
  for (const [code, name] of Object.entries(STATE_NAMES)) {
    for (const topCityShape of [true, false]) {
      total++;
      const text = renderMarketContext({
        metal: profile,
        state_name: name,
        state_code: code,
        state_industries: STATE_INDUSTRIES[code] ?? "manufacturing and construction",
        top_city: topCityShape ? "Springfield" : null,
        yard_count: 5,
        regional_demand_factor: regionalDemandFactor(code, profile),
      });
      const v = validateMetalContent(text, "market_context", {
        metal_name: meta.name,
        category_name: categoryName,
        unit: meta.unit,
        state_name: name,
        state_code: code,
      });
      if (!v.ok) {
        failed++;
        failures.push(`${slug}/${code}(top=${topCityShape}): ${v.reasons.join(", ")}`);
      }
    }
  }
}

console.log(`\n${total - failed}/${total} pass`);
if (failed > 0) {
  console.error(`\n${failed} FAILURES:`);
  for (const f of failures.slice(0, 40)) console.error(`  ${f}`);
  if (failures.length > 40) console.error(`  ... and ${failures.length - 40} more`);
  process.exit(1);
}
console.log("✓ Coverage gate passed.");
