import { renderDescription, type YardSlotInput } from "./yard-desc-templates.js";
import { validateDescription, type ValidatorFacts } from "./yard-desc-validator.js";

const STATE_NAMES: Record<string, string> = { IL: "Illinois" };

const DB_SLUGS = ["aluminum", "brass", "copper", "lead", "precious-metals", "steel"];
const SYNTHETIC = [
  "copper-1",
  "copper-2",
  "copper-3",
  "aluminum-cans",
  "catalytic-converters",
  "foo-2",
  "metal-foo-bar",
  "ten-99-test",
];
const ALL = [...DB_SLUGS, ...SYNTHETIC];

type Shape = { accepted: string[]; county_known: boolean; accepted_on_file: boolean };

function buildShapes(): Shape[] {
  const shapes: Shape[] = [];
  for (const slug of ALL) {
    for (const county_known of [true, false]) {
      for (const accepted_on_file of [true, false]) {
        shapes.push({
          accepted: accepted_on_file ? [slug] : [],
          county_known,
          accepted_on_file,
        });
      }
    }
  }
  shapes.push({ accepted: ALL, county_known: true, accepted_on_file: true });
  shapes.push({ accepted: ALL, county_known: false, accepted_on_file: true });
  return shapes;
}

const SEEDS = 30;

function main() {
  const shapes = buildShapes();
  let total = 0;
  let fails = 0;
  const failSamples: Array<{ slug: string; reasons: string[]; desc: string }> = [];

  for (let yard_id = 1; yard_id <= SEEDS; yard_id++) {
    for (const shape of shapes) {
      const slug = `cov-yard-${yard_id}-${shape.accepted.join("_") || "none"}`;
      const yard: YardSlotInput = {
        yard_id,
        slug,
        name: "Coverage Test Yard",
        city: "Springfield",
        state: "IL",
        county: shape.county_known ? "Sangamon" : null,
        county_known: shape.county_known,
        service_focus: "general-scrap",
        accepted_on_file: shape.accepted_on_file,
        accepted_categories: shape.accepted,
        hours_structured: false,
        has_phone: true,
        has_website: false,
        has_email: false,
      };
      const r = renderDescription(yard);
      const facts: ValidatorFacts = {
        yard_id: yard.yard_id,
        name: yard.name,
        city: yard.city,
        state: yard.state,
        zip: null,
        county: yard.county,
        county_known: yard.county_known,
      };
      const result = validateDescription(r.description, facts);
      total++;
      if (!result.ok) {
        fails++;
        if (failSamples.length < 5) {
          failSamples.push({
            slug,
            reasons: result.reasons,
            desc: r.description.slice(0, 200),
          });
        }
      }
    }
  }

  console.log(
    `[coverage] seeds=${SEEDS} shapes=${shapes.length} total=${total} fails=${fails} state_names=${Object.keys(STATE_NAMES).length}`,
  );
  if (fails > 0) {
    console.log("--- fail samples ---");
    for (const s of failSamples) console.log(JSON.stringify(s, null, 2));
    process.exit(1);
  }
  console.log("[coverage] OK — template library is bulk-safe across DB + synthetic shapes.");
}

main();
