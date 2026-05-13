/**
 * Pre-bulk coverage gate for city descriptions.
 *
 * Renders every (opening × materials × closer) combination against a small
 * set of representative city facts and asserts 100% v3-validator pass.
 *
 * If anything fails, that's a template-library bug — fix before bulk run.
 */

import {
  TEMPLATE_POOLS,
  deriveSlots,
  type CitySlotInput,
} from "./city-desc-templates";
import { validateCityDescription } from "./city-desc-validator";

const SHAPES: { name: string; input: CitySlotInput }[] = [
  {
    name: "singleton_general_no_accepted",
    input: {
      state_code: "OH", state_slug: "ohio", city_name: "Smallville", city_slug: "smallville",
      yard_count: 1, accepted_top_3: [], accepted_total_unique: 0, empty_accepted_pct: 100,
      auto_count: 0, industrial_count: 0, general_count: 1,
      service_focus_majority: "general-scrap", has_industrial_yards: false, has_auto_specialists: false,
    },
  },
  {
    name: "singleton_auto_focus",
    input: {
      state_code: "AL", state_slug: "alabama", city_name: "Alexandria", city_slug: "alexandria",
      yard_count: 1, accepted_top_3: [], accepted_total_unique: 0, empty_accepted_pct: 100,
      auto_count: 1, industrial_count: 0, general_count: 0,
      service_focus_majority: "auto-salvage", has_industrial_yards: false, has_auto_specialists: true,
    },
  },
  {
    name: "singleton_industrial_focus",
    input: {
      state_code: "WV", state_slug: "west-virginia", city_name: "Beckley", city_slug: "beckley",
      yard_count: 1, accepted_top_3: [], accepted_total_unique: 0, empty_accepted_pct: 100,
      auto_count: 0, industrial_count: 1, general_count: 0,
      service_focus_majority: "industrial-steel", has_industrial_yards: true, has_auto_specialists: false,
    },
  },
  {
    name: "sparse_3yards_mixed_thin_accepted",
    input: {
      state_code: "PA", state_slug: "pennsylvania", city_name: "Sligo", city_slug: "sligo",
      yard_count: 3, accepted_top_3: ["copper", "aluminum"], accepted_total_unique: 2, empty_accepted_pct: 67,
      auto_count: 1, industrial_count: 0, general_count: 2,
      service_focus_majority: "mixed", has_industrial_yards: false, has_auto_specialists: true,
    },
  },
  {
    name: "mid_8yards_rich_accepted",
    input: {
      state_code: "IL", state_slug: "illinois", city_name: "Romeoville", city_slug: "romeoville",
      yard_count: 8, accepted_top_3: ["copper", "aluminum", "brass"], accepted_total_unique: 6, empty_accepted_pct: 30,
      auto_count: 2, industrial_count: 2, general_count: 6,
      service_focus_majority: "general-scrap", has_industrial_yards: true, has_auto_specialists: true,
    },
  },
  {
    name: "mid_12yards_auto_majority",
    input: {
      state_code: "TX", state_slug: "texas", city_name: "Eagle Pass", city_slug: "eagle-pass",
      yard_count: 12, accepted_top_3: ["aluminum", "copper", "lead"], accepted_total_unique: 5, empty_accepted_pct: 40,
      auto_count: 8, industrial_count: 1, general_count: 6,
      service_focus_majority: "auto-salvage", has_industrial_yards: true, has_auto_specialists: true,
    },
  },
  {
    name: "dense_47yards_industrial_majority",
    input: {
      state_code: "TX", state_slug: "texas", city_name: "Houston", city_slug: "houston",
      yard_count: 47, accepted_top_3: ["steel", "copper", "aluminum"], accepted_total_unique: 8, empty_accepted_pct: 20,
      auto_count: 12, industrial_count: 28, general_count: 35,
      service_focus_majority: "industrial-steel", has_industrial_yards: true, has_auto_specialists: true,
    },
  },
  {
    name: "dense_25yards_mixed",
    input: {
      state_code: "CA", state_slug: "california", city_name: "Los Angeles", city_slug: "los-angeles",
      yard_count: 25, accepted_top_3: ["aluminum", "brass", "copper"], accepted_total_unique: 7, empty_accepted_pct: 25,
      auto_count: 8, industrial_count: 6, general_count: 18,
      service_focus_majority: "mixed", has_industrial_yards: true, has_auto_specialists: true,
    },
  },
];

function fillSlots(template: string, slots: Record<string, string | number>): string {
  return template.replace(/\{([a-z_]+)\}/g, (_m, key: string) => {
    const v = slots[key];
    return v === undefined ? "" : String(v);
  });
}

function pickPools(input: CitySlotInput) {
  const sparse = input.accepted_total_unique < 3 || input.empty_accepted_pct > 80;
  const materials = sparse ? TEMPLATE_POOLS.MATERIALS_SPARSE : TEMPLATE_POOLS.MATERIALS_RICH;
  let closers;
  if (input.yard_count <= 1) {
    if (input.service_focus_majority === "auto-salvage" && input.has_auto_specialists) closers = TEMPLATE_POOLS.SINGLETON_AUTO;
    else if (input.service_focus_majority === "industrial-steel" && input.has_industrial_yards) closers = TEMPLATE_POOLS.SINGLETON_INDUSTRIAL;
    else closers = TEMPLATE_POOLS.SINGLETON_GENERAL;
  } else if (input.service_focus_majority === "auto-salvage" && input.has_auto_specialists) closers = TEMPLATE_POOLS.CLOSER_AUTO;
  else if (input.service_focus_majority === "industrial-steel" && input.has_industrial_yards) closers = TEMPLATE_POOLS.CLOSER_INDUSTRIAL;
  else if (input.service_focus_majority === "general-scrap") closers = TEMPLATE_POOLS.CLOSER_GENERAL;
  else closers = TEMPLATE_POOLS.CLOSER_MIXED;
  return { materials, closers };
}

// Targeted grammar regex: catches the specific bug class where a singular-
// determiner subject ("one yard", "the single yard") is followed by an
// uninflected plural-form verb. Every template that puts a verb directly
// after {yard_noun} already uses {verb_s}/{verb_be} for agreement, so this
// is purely a regression guard.
//
// We deliberately do NOT try to catch generic "scrap yard <verb>" patterns
// because the verb's actual subject is often a different (plural) noun
// elsewhere in the sentence — e.g. "Posted accepted-material lists for
// {city}'s scrap yard are thin" where the "are" subject is "lists", not
// "yard". A local-window regex can't disambiguate without parsing.
const BAD_GRAMMAR: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(?:one|the single)\s+(?:scrap\s+|metal\s+|listed\s+)*yard\s+(?:are|do|operate|take|provide|appear|cover|handle|act|pull|include|run)\b/i, label: "singular_subj_plural_verb" },
];

async function main() {
  let total = 0, pass = 0;
  const fails: { shape: string; combo: string; reasons: string[]; text: string }[] = [];

  for (const shape of SHAPES) {
    const slots = deriveSlots(shape.input) as unknown as Record<string, string | number>;
    const { materials, closers } = pickPools(shape.input);

    for (const o of TEMPLATE_POOLS.OPENING_TEMPLATES) {
      for (const m of materials) {
        for (const cl of closers) {
          total++;
          const text = [o.text, m.text, cl.text]
            .map((t) => fillSlots(t, slots))
            .join(" ")
            .replace(/\s{2,}/g, " ")
            .trim();
          const v = validateCityDescription(text, {
            city: shape.input.city_name,
            state: shape.input.state_code,
            yard_count: shape.input.yard_count,
            auto_count: shape.input.auto_count,
            industrial_count: shape.input.industrial_count,
            general_count: shape.input.general_count,
            accepted_top_3: shape.input.accepted_top_3,
          });
          // Augment validator findings with grammar regex hits.
          const grammarHits = BAD_GRAMMAR.filter((g) => g.pattern.test(text)).map((g) => g.label);
          const allReasons = [...v.reasons, ...grammarHits.map((l) => `grammar:${l}`)];
          if (allReasons.length === 0) pass++;
          else fails.push({ shape: shape.name, combo: `${o.id}+${m.id}+${cl.id}`, reasons: allReasons, text });
        }
      }
    }
  }

  process.stdout.write(`Coverage: ${pass}/${total} pass\n`);
  if (fails.length > 0) {
    process.stdout.write(`\nFailures (${fails.length}):\n`);
    for (const f of fails.slice(0, 30)) {
      process.stdout.write(`  ${f.shape} | ${f.combo}\n    reasons: ${f.reasons.join("; ")}\n    text: ${f.text}\n`);
    }
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
