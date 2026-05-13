# Content Templating (Yards, Cities, Categories)

All long-form content on Scrapyards.io is generated via deterministic
slot-filling templates — no LLM, $0 API cost, identical output on every
re-run (md5(key) → xorshift32 PRNG). Same v3 stop-list validator
(`scripts/src/yard-desc-validator.ts`) is reused everywhere.

## Yard descriptions

**Status (2026-05-10): Bulk complete.** See `docs/migration-history.md` for
the LLM-pilot decision log that led to this architecture.

### Pipeline (`scripts/src/generate-yard-descriptions-templated.ts` + `scripts/src/yard-desc-templates.ts`)

- **Architecture:** pre-screened sentence templates × deterministic
  slot-filling. No LLM, no inference, no creative latitude.
- **Template library:** 30 openings × 35 materials (15 with-data + 20 no-data) ×
  15 operations × 16 closers (8 general + 4 auto + 4 industrial). Closer
  pool is filtered by `service_focus` so auto yards get auto-flavored
  closers, etc. Combinations: ~30 × 35 × 15 × 16 = 252,000 unique
  permutations across ~7,700 yards. The no-data pool was expanded 5→20 in
  pilot v2 to drop top-share at sparse-yard production scale (~89% of yards
  have empty `accepted[]`).
- **Slot variables:** `{yard_name}` (used 1× total — opening only),
  `{city}`, `{state_name}` (50-state lookup), `{primary_category}` (mapped
  from `service_focus`: auto-salvage / industrial steel and scrap /
  scrap metal recycling / etc.), `{accepted_list}` (Oxford-comma format,
  capped at 8, slug→human label via 38-entry MATERIAL_LABELS map),
  `{county_phrase}` (only when `county_known=true`, else expands to ""),
  `{hours_phrase}` and `{contact_phrase}` (derived from
  hours_structured/has_phone/has_website/has_email; lowercased so they read
  cleanly mid-sentence — renderer auto-capitalizes sentence-starts in
  post-process), `{pronoun_subject}` ("the yard" / "the business" /
  "the operation" / "the team" / "this site" — varies by yard seed).
- **Why no website URL or phone in text?** The v3 validator rejects
  any digit-run not present in source facts, and URLs/numbers would
  trip it. Text refers to channels by name only ("a phone line is on
  file") with no actual values; the data appears in structured page
  components, not the description prose.
- **Cost:** $0. Bulk run on ~7,672 remaining yards is single-process,
  one Postgres connection, deterministic per-yard render. Wall-clock
  estimate <2 min.
- **Validator:** uses the same `yard-desc-validator.ts` v3 rules.
  Templates were pre-screened against the v3 stop-list
  (STOP_COMPARATIVE/REGION/TIME, BANNED_PHRASES/OPENERS, no digits, name
  ≤2). Validation is a sanity net, not a retry loop — if a template ever
  fails validation, that's a template-library bug to fix loudly, not
  a per-yard retry.
- **Run:** `pnpm --filter @workspace/scripts run generate-yard-descriptions-templated [-- --mode=pilot|bulk] [--dry-run] [--limit=N]`.
- **Pre-bulk coverage gate** (`scripts/src/yard-desc-templated-coverage-check.ts`,
  registered as `pnpm --filter @workspace/scripts run yard-desc-templated-coverage-check`):
  renders + v3-validates 30 seeds × 58 data shapes = 1,740 combos covering every
  DB-present accepted slug + 8 synthetic at-risk slugs (`copper-1/2/3`,
  `foo-2`, `metal-foo-bar`, `ten-99-test`, etc.), both `county_known` states, both
  `accepted_on_file` states. Required to pass before any bulk run or template-library
  change. Current status: 1,740/1,740 pass.
- **Hardening note (post-pilot):** `MATERIAL_LABELS["copper-1"]/["copper-2"]`
  originally mapped to text with literal digits ("no. 1 copper"); replaced with
  "number one copper" / "number two copper". `humanizeMaterial` fallback for
  unknown slugs now spells out trailing single-digit suffixes and strips embedded
  digits, so any future digit-bearing slug cannot leak digits into rendered text
  (which would fail the v3 unsourced-digits check). Production DB currently has
  only 6 generic accepted slugs (none digit-bearing) so this is future-proofing,
  not an active bug.

## City descriptions (`scripts/src/city-desc-templates.ts` + `generate-city-descriptions.ts`)

**Status (2026-05-10): Bulk complete.** 3,493/3,493 city directory pages have
templated descriptions (60–180 words; observed 64–97).

- **Pools:** 15 openings × (8 rich-materials | 7 sparse-materials) ×
  (5 general | 4 auto | 4 industrial | 4 mixed | 4 singleton) closers.
  Rich-materials fire when `accepted_total_unique ≥ 3 AND empty_accepted_pct ≤ 80`,
  else sparse. Closer pool is selected by `service_focus_majority` + presence
  flags, with a special **singleton pool** for 1-yard cities (62% of all cities).
- **Verb agreement:** `{verb_s}` ("" / "s") and `{verb_be}` ("are" / "is") slots
  conjugate any sentence whose verb directly follows `{yard_noun}`. Required because
  yard counts span 1 (2,181 cities) to 114 (Houston). Same convention for
  `{auto_verb_s}` and `{industrial_verb_s}`.
- **Service-focus classification is exclusive priority** (auto > industrial >
  general). Each yard gets exactly one bucket so city-level
  auto+industrial+general counts sum to yard_count and the >0.5 / ≥0.7 ratio
  math is well-defined. **Pre-fix bug**: yards were counted in multiple buckets
  simultaneously, producing impossible aggregates like
  `{yard_count:1, auto:1, industrial:1, general:1}` and biased majority labels.
- **Singleton closer pool** exists because every multi-yard closer
  ("alongside the general-scrap yards", "{city}'s yards include {auto_count_word}
  {auto_noun}") presupposes ≥2 yards; with 2,181 1-yard cities this would
  collapse into "{city}'s yards include one auto-salvage specialist" prose.
  Three focus variants (general/auto/industrial), 4 templates each (2
  focus-specific + 2 generic shared). Pick by `yard_count <= 1` short-circuit.
- **No county/population data** on cities → all county and population template
  variants dropped; validator rejects any "X County" claim as unsourced.
- **Validator** wraps the same v3 stop-list with city-appropriate facts blob
  and 60–180 word range. Skips name-repetition check (city names appear
  naturally several times).
- **Coverage gate** (`pnpm --filter @workspace/scripts run city-desc-templated-coverage-check`):
  6 representative shapes × all template combos = 3,720 renders, all v3-validated
  + grammar-regex-checked. Required to pass before bulk. Current: 3,720/3,720.
- **Run:** `pnpm --filter @workspace/scripts run generate-city-descriptions [-- --mode=pilot|bulk] [--dry-run] [--limit=N] [--slugs=state/city,...]`.

### City page integration

`artifacts/scrapyards/app/scrap-yards/[state]/[city]/page.tsx` renders
`ct.descriptionMd` between the yard-count line and CityMap, splitting on
blank lines into `<p>` tags. Schema field `descriptionMd` (`description_md
TEXT`) added to `cities`; pure addition, no migration breakage.

## Singleton-city indexability (AdSense thin-content guard)

- **2,181 of 3,493 cities have exactly 1 active yard.** Even with the 80-word
  city description, those pages render at ~138–144 words total (Eagle Pass at
  2 yards is 175; Houston etc. clear comfortably). The lone yard's own
  detail page (~300+ words) already ranks for "scrap yards in {city}",
  so the city directory page is not competing for the same query.
- **Decision: `noindex, follow` for `yard_count === 1` cities; sitemap
  excludes them entirely.** Pages still exist, breadcrumbs work, internal
  link equity flows, legacy redirects resolve — only Google's index drops
  the thin pages.
- **Implementation:**
  - `app/scrap-yards/[state]/[city]/page.tsx::generateMetadata` runs a
    `count(*)::int` aggregate against active yards in the city and sets
    `robots: { index: false, follow: true }` when count === 1, else
    `index: true, follow: true`. Computed per-render (ISR `revalidate=3600s`)
    so a city that gains a 2nd yard auto-becomes indexable on next revalidate.
  - `app/sitemap.ts` builds a `cityId → activeYardCount` map from the same
    yards query and skips cities with count ≤ 1. Sitemap count drops from
    12,984 → 10,803 (verified).
- **Strict threshold:** `=== 1`. The 1→2 cliff is sharp because the second
  yard card adds ~30 rendered words plus the multi-yard prose framing
  (vs singleton-pool prose), putting 2-yard cities comfortably above the
  thin threshold.
- **Verified:** singleton pages emit `<meta name="robots" content="noindex,
  follow">`; multi-yard pages emit `index, follow`; lone yards on singleton
  cities still serve HTTP 200 with default-indexable robots.

## Metal category content (in-progress, 2026-05-13)

Extending the same template architecture to the 9 metal_categories
(aluminum, brass, copper, lead, steel, zinc, auto-parts, electronics,
precious-metals). 4 content blocks per category: about_md,
market_drivers_md, grade_comparison_md, faq_json. Three template families:
PURE-METAL, COMPOSITE, PRECIOUS. Single-grade zinc uses the
"What X looks like in scrap stream" variant.

- Templates: `scripts/src/category-content-templates.ts`
- Validator: `scripts/src/category-content-validator.ts`
- Coverage gate: `pnpm --filter @workspace/scripts run category-content-coverage-check`
- Generator: `pnpm --filter @workspace/scripts run generate-category-content`
- See **Active TODOs** in `replit.md` for current status.
