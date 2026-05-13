/**
 * Slot-filling template library for CITY directory-page descriptions.
 *
 * Same architecture as yard-desc-templates.ts:
 *   - Pre-screened sentence templates × deterministic slot-filling
 *   - md5(state_slug + "/" + city_slug) → xorshift32 PRNG for picks
 *   - No LLM, no inference, no creative latitude
 *
 * Hard discipline (vs yard-desc):
 *   - No yard-name slot (city pages list yards via cards; never name yards in prose)
 *   - No "X County" claims (no county data on cities table; validator would reject)
 *   - No population claims (0/3493 rows have population)
 *   - No relative quality between cities ("better than", "best in state", etc.)
 *   - Numeric yard_count rendered as digit-or-spelled-word; included in facts
 *     blob for the validator's unsourced-digits check
 *
 * Composition: 1 opening + 1 materials sentence + 1 closer = ~80-150 words.
 */

import crypto from "node:crypto";

// ---------- State-name map (mirrors yard-desc-templates.ts) ----------

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

// ---------- Material slug → human label (mirror of yard-desc) ----------

const MATERIAL_LABELS: Record<string, string> = {
  "aluminum": "aluminum",
  "aluminum-cans": "aluminum cans",
  "aluminum-cast": "cast aluminum",
  "aluminum-clean": "clean aluminum",
  "aluminum-extrusion": "aluminum extrusion",
  "aluminum-radiators": "aluminum radiators",
  "aluminum-siding": "aluminum siding",
  "aluminum-wheels": "aluminum wheels",
  "bare-bright-copper": "bare bright copper",
  "brass": "brass",
  "brass-yellow": "yellow brass",
  "brass-red": "red brass",
  "car-batteries": "car batteries",
  "catalytic-converters": "catalytic converters",
  "cast-iron": "cast iron",
  "copper": "copper",
  "copper-1": "number one copper",
  "copper-2": "number two copper",
  "copper-tubing": "copper tubing",
  "copper-wire": "copper wire",
  "electric-motors": "electric motors",
  "ferrous": "ferrous metals",
  "ferrous-metals": "ferrous metals",
  "insulated-wire": "insulated wire",
  "iron": "iron",
  "lead": "lead",
  "light-iron": "light iron",
  "non-ferrous": "non-ferrous metals",
  "non-ferrous-metals": "non-ferrous metals",
  "precious-metals": "precious metals",
  "radiators": "radiators",
  "stainless-steel": "stainless steel",
  "steel": "steel",
  "steel-heavy-melt": "heavy-melt steel",
  "steel-shred": "shred steel",
  "tin": "tin",
  "transformers": "transformers",
  "wire": "wire",
  "zinc": "zinc",
};

function humanizeMaterial(slug: string): string {
  const labeled = MATERIAL_LABELS[slug];
  if (labeled) return labeled;
  const SPELL: Record<string, string> = {
    "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
    "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
  };
  let s = slug.replace(/-/g, " ");
  s = s.replace(/\s(\d)$/g, (_m, d) => " " + (SPELL[d] || ""));
  s = s.replace(/\d+/g, "").replace(/\s+/g, " ").trim();
  return s || "scrap material";
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const head = items.slice(0, -1).join(", ");
  return `${head}, and ${items[items.length - 1]}`;
}

// Spell out small counts; use digits for 11+. Both forms are included in
// facts so the validator's unsourced-digits check passes either way.
const NUM_WORDS: Record<number, string> = {
  1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
  6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
};
function fmtCount(n: number): string {
  return NUM_WORDS[n] ?? String(n);
}

// ---------- Seeded PRNG (xorshift32) ----------

export class SeededRng {
  private state: number;
  constructor(seedHex: string) {
    this.state = parseInt(seedHex.slice(0, 8), 16) || 1;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0xffffffff;
  }
  intBelow(n: number): number {
    return Math.floor(this.next() * n);
  }
}

export function seedFor(stateSlug: string, citySlug: string): SeededRng {
  const hash = crypto.createHash("md5").update(`${stateSlug}/${citySlug}`).digest("hex");
  return new SeededRng(hash);
}

// ---------- Input + slot types ----------

export type CitySlotInput = {
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
};

export type DerivedSlots = {
  city: string;
  state: string;          // 2-letter
  state_name: string;     // full name
  yard_count: number;     // raw int
  yard_count_word: string; // "one" / "two" / ... / "47"
  yard_noun: string;      // "yard" or "yards"
  // Verb agreement for {yard_noun} subject. {verb_s}="s" when singular,
  // ""(empty) when plural — works for any regular -s verb ("operate{verb_s}",
  // "take{verb_s}", "provide{verb_s}", "appear{verb_s}", etc.). {verb_be} is
  // the irregular "is"/"are" pair.
  verb_s: string;
  verb_be: string;
  accepted_top_3: string;        // formatted oxford-comma list
  accepted_top_3_first: string;
  accepted_top_3_second: string;
  accepted_top_3_third: string;
  auto_count_word: string;
  auto_noun: string;
  auto_verb_s: string;
  industrial_count_word: string;
  industrial_noun: string;
  industrial_verb_s: string;
};

export function deriveSlots(c: CitySlotInput): DerivedSlots {
  const labeled = c.accepted_top_3.map(humanizeMaterial);
  return {
    city: c.city_name,
    state: c.state_code,
    state_name: STATE_NAMES[c.state_code] ?? c.state_code,
    yard_count: c.yard_count,
    yard_count_word: fmtCount(c.yard_count),
    yard_noun: c.yard_count === 1 ? "yard" : "yards",
    verb_s: c.yard_count === 1 ? "s" : "",
    verb_be: c.yard_count === 1 ? "is" : "are",
    accepted_top_3: formatList(labeled),
    accepted_top_3_first: labeled[0] ?? "",
    accepted_top_3_second: labeled[1] ?? "",
    accepted_top_3_third: labeled[2] ?? "",
    auto_count_word: fmtCount(c.auto_count),
    auto_noun: c.auto_count === 1 ? "auto-salvage specialist" : "auto-salvage specialists",
    auto_verb_s: c.auto_count === 1 ? "s" : "",
    industrial_count_word: fmtCount(c.industrial_count),
    industrial_noun: c.industrial_count === 1 ? "industrial-steel yard" : "industrial-steel yards",
    industrial_verb_s: c.industrial_count === 1 ? "s" : "",
  };
}

// ---------- Templates ----------

export type Template = {
  id: string;
  text: string;
};

// All openings reference yard_count + city + state; no county, no population.
// Templates that put a verb directly after {yard_noun} use {verb_s} for
// regular -s conjugation ("operate{verb_s}") and {verb_be} for is/are. This
// is required because cities range from yard_count=1 (1,500+ cities) to
// yard_count=47+ (a few metros).
const OPENING_TEMPLATES: Template[] = [
  { id: "open-001", text: "{yard_count_word} scrap {yard_noun} operate{verb_s} in {city}, {state_name}, serving sellers across the surrounding region with a paid intake channel for ferrous and non-ferrous material." },
  { id: "open-002", text: "Sellers in {city}, {state_name} have access to {yard_count_word} active scrap metal {yard_noun} listed in our directory, ranging from walk-in intake points to outfits that handle contractor-volume loads." },
  { id: "open-003", text: "{city}, {state_name}'s scrap metal market includes {yard_count_word} {yard_noun} taking inbound material from individual sellers, salvage haulers, and small construction outfits." },
  { id: "open-004", text: "Our directory lists {yard_count_word} active scrap {yard_noun} in {city}, {state_name}, providing paid drop-off points for metal that would otherwise sit in garages or head to landfill." },
  { id: "open-005", text: "Scrap intake in {city}, {state_name} runs through {yard_count_word} listed {yard_noun}, each acting as a paid outlet for sellers turning copper, aluminum, steel, and other recoverables into cash." },
  { id: "open-006", text: "{yard_count_word} scrap metal {yard_noun} {verb_be} listed in {city}, {state_name}, covering walk-in seller intake, contractor loads, and salvage haulers across the local catchment." },
  { id: "open-007", text: "{city}, {state_name} hosts {yard_count_word} active scrap {yard_noun} in our directory, giving sellers a paid drop-off path for ferrous and non-ferrous material that would otherwise sit unused." },
  { id: "open-008", text: "Inbound scrap in {city}, {state_name} is handled by {yard_count_word} listed {yard_noun}, ranging across general-scrap intake, auto-parts salvage, and industrial steel volume." },
  { id: "open-009", text: "Across {city}, {state_name}, {yard_count_word} scrap metal {yard_noun} provide{verb_s} paid intake channels for sellers turning recoverable material into cash rather than hauling it to landfill." },
  { id: "open-010", text: "Scrap sellers in and around {city}, {state_name} can route material through {yard_count_word} listed {yard_noun}, each offering a paid drop-off point for inbound copper, aluminum, steel, and related categories." },
  { id: "open-011", text: "{yard_count_word} scrap {yard_noun} appear{verb_s} in our directory for {city}, {state_name}, taking inbound material from walk-in sellers, contractors, and salvage haulers across the local catchment." },
  { id: "open-012", text: "The scrap intake market in {city}, {state_name} runs through {yard_count_word} listed {yard_noun}, each acting as a paid outlet for inbound metal volume from local sellers." },
  { id: "open-013", text: "{city}, {state_name} has {yard_count_word} active scrap {yard_noun} in our directory, providing sellers with paid drop-off options for ferrous and non-ferrous material across a range of load sizes." },
  { id: "open-014", text: "Working out of {city}, {state_name}, {yard_count_word} scrap metal {yard_noun} take{verb_s} inbound material from individual sellers, contractors, and salvage outfits across the surrounding catchment." },
  { id: "open-015", text: "Our listings for {city}, {state_name} include {yard_count_word} scrap {yard_noun}, covering general-scrap intake, auto salvage, and industrial steel for sellers across the local market." },
];

// Materials sentences come in two pools: rich-data (>=3 unique categories on
// file across the city) vs sparse (data thin, mostly empty accepted[] arrays).
const MATERIALS_RICH: Template[] = [
  { id: "mat-r-001", text: "The metals most commonly accepted across {city}'s {yard_noun} include {accepted_top_3}, though specific intake at each yard varies and call-ahead is the cleanest way to confirm a load." },
  { id: "mat-r-002", text: "Yards in {city} accept a range of materials, with {accepted_top_3_first}, {accepted_top_3_second}, and {accepted_top_3_third} being the categories that show up most often in the local listings." },
  { id: "mat-r-003", text: "Inbound categories in {city} skew toward {accepted_top_3} based on what local yards report to the directory, with each individual site filing its own intake mix on top of those staples." },
  { id: "mat-r-004", text: "{accepted_top_3_first}, {accepted_top_3_second}, and {accepted_top_3_third} are the categories most often filed by {city}'s scrap {yard_noun}, with the full per-yard intake detail on each yard's listing page." },
  { id: "mat-r-005", text: "Across {city}'s scrap intake market, {accepted_top_3} appear most frequently in the directory's accepted-material lists, though individual yard intake mixes vary from one site to the next." },
  { id: "mat-r-006", text: "Material types filed in the directory for {city} run heaviest on {accepted_top_3_first}, {accepted_top_3_second}, and {accepted_top_3_third}, which gives sellers a working baseline for what fits the local intake mix." },
  { id: "mat-r-007", text: "The accepted-material lists in {city} highlight {accepted_top_3} as the most common categories, alongside per-yard variation that shows up in each individual listing." },
  { id: "mat-r-008", text: "Across listed {city} {yard_noun}, the categories that come up most often are {accepted_top_3_first}, {accepted_top_3_second}, and {accepted_top_3_third}, with each yard reporting its own intake mix on top of those." },
];

// Sparse-pool templates avoid quantifier+peer-noun constructs ("most yards…",
// "many dealers…") which the v3 validator flags as hallucinated peer-set
// claims. "Several" and "a number of" are not in the stop-list; quantifying
// by frequency-word is fine, but "most" / "many" / "few" are not.
const MATERIALS_SPARSE: Template[] = [
  { id: "mat-s-001", text: "Specific accepted-material categories vary by yard in {city}. Several yards do not publish their full intake list in the directory — calling ahead is the cleanest way to confirm a load before driving over." },
  { id: "mat-s-002", text: "Posted accepted-material lists for {city}'s scrap {yard_noun} are thin in the directory, so the per-yard listing pages are the working starting point for figuring out which site takes a given load." },
  { id: "mat-s-003", text: "Across {city}, full accepted-material lists generally aren't published in the directory, so a call-ahead to a specific yard is the cleanest way to confirm intake on a load before driving over." },
  { id: "mat-s-004", text: "Accepted-material categories aren't broadly filed across the {city} listings; sellers should expect to ring a yard directly to confirm intake on a load before making the trip." },
  { id: "mat-s-005", text: "Intake categories per yard aren't broadly published in the {city} listings, which means a quick call to each yard is the working path to confirm a load fits before driving over." },
  { id: "mat-s-006", text: "The accepted-material data in {city}'s directory is sparse — yards in the listings generally do not file a formal intake list, so each yard's individual page and a phone call are the working tools for sellers." },
  { id: "mat-s-007", text: "Per-yard intake lists in {city} aren't fully filed in the directory, so sellers should plan on a quick call to a specific yard to confirm a load fits before making the drive." },
];

// Closer / service-focus pool, filtered by service_focus_majority + presence flags.
const CLOSER_GENERAL: Template[] = [
  { id: "close-g-001", text: "The local market in {city} skews toward general-scrap intake, with yards taking household, contractor, and small-business loads through walk-in and drop-off paths." },
  { id: "close-g-002", text: "The listed {yard_noun} in {city} cover{verb_s} both household-scrap and contractor-volume intake, with options for sellers across a range of load sizes from a back-of-truck pile to a contractor pull." },
  { id: "close-g-003", text: "{city}'s scrap intake mix runs general-purpose, with yards taking inbound material from walk-in sellers, contractors clearing job sites, and small businesses moving accumulated metal." },
  { id: "close-g-004", text: "Across {city}, the scrap market is set up around general-purpose intake, with yards taking household, contractor, and small-business loads through standard drop-off paths." },
  { id: "close-g-005", text: "The scrap intake setup in {city} works for both household sellers clearing a garage and contractors moving accumulated job-site material through the same drop-off path." },
];

const CLOSER_AUTO: Template[] = [
  { id: "close-a-001", text: "{city}'s yards include {auto_count_word} {auto_noun}, making the local market a fit for vehicle-parts sellers and end-of-life vehicle drop-offs alongside standard scrap intake." },
  { id: "close-a-002", text: "Auto-salvage capacity in {city} is anchored by {auto_count_word} {auto_noun} alongside the general-scrap yards, giving vehicle-parts sellers a dedicated drop-off path." },
  { id: "close-a-003", text: "With {auto_count_word} {auto_noun} listed, {city}'s scrap market handles end-of-life vehicles and parts pulls in addition to standard household and contractor scrap intake." },
  { id: "close-a-004", text: "{city}'s mix of {auto_count_word} {auto_noun} sits alongside general-scrap intake, giving sellers with vehicle parts or end-of-life vehicles a dedicated drop-off route." },
];

const CLOSER_INDUSTRIAL: Template[] = [
  { id: "close-i-001", text: "{industrial_count_word} {industrial_noun} operate{industrial_verb_s} in {city}, handling larger contractor loads, structural steel, and demolition material in addition to standard scrap intake." },
  { id: "close-i-002", text: "Industrial-steel capacity in {city} runs through {industrial_count_word} {industrial_noun}, giving demolition contractors and structural-steel sellers a dedicated path alongside the general-scrap yards." },
  { id: "close-i-003", text: "With {industrial_count_word} {industrial_noun} listed, {city}'s scrap market is set up for contractor-volume steel and demolition loads in addition to walk-in seller intake." },
  { id: "close-i-004", text: "{city}'s {industrial_count_word} {industrial_noun} handle{industrial_verb_s} structural steel, demolition pulls, and contractor-volume loads, sitting alongside the general-scrap intake yards in the local market." },
];

const CLOSER_MIXED: Template[] = [
  { id: "close-m-001", text: "The listed {yard_noun} in {city} cover{verb_s} both household-scrap and contractor-volume intake, with options for sellers across the load-size spectrum and a working mix of general, auto, and industrial routes." },
  { id: "close-m-002", text: "{city}'s scrap market is mixed across general-scrap, auto-salvage, and industrial-steel intake, giving sellers a working set of options for whatever load they're moving." },
  { id: "close-m-003", text: "The intake mix in {city} runs across general, auto, and industrial-steel categories, with each yard's individual listing showing the categories it accepts and the load sizes it works with." },
  { id: "close-m-004", text: "Across {city}, the scrap intake setup spans general-scrap, auto-salvage, and industrial-steel routes, giving sellers paid drop-off paths for whatever mix of material they're moving." },
];

// Singleton-yard pools: used when yard_count == 1. The auto/industrial/mixed
// closers above all assume 2+ yards (their "alongside the general-scrap yards"
// or "{city}'s yards include {auto_count_word} {auto_noun}" framing collapses
// or implies plurality that isn't there). For 1-yard cities, swap to one of
// these focus-aware singletons. Each pool has 2 focus-specific + 2 generic
// variants (4 total) so any single-yard city has 60 unique combinations
// (15 openings × ≥1 materials × 4 closers).
const SINGLETON_GENERAL: Template[] = [
  { id: "single-g-001", text: "The single listed yard in {city} works general-scrap intake, taking household, contractor, and small-business loads through a standard drop-off path." },
  { id: "single-g-002", text: "{city}'s lone scrap operator takes general-purpose inbound from walk-in sellers and contractors, providing the local paid drop-off route for recoverable metal." },
  { id: "single-x-001", text: "With one scrap yard in the listings, {city}'s intake is concentrated through a single drop-off point for sellers across the local catchment." },
  { id: "single-x-002", text: "Sellers in {city} have a single listed drop-off option for inbound scrap material, with that yard handling the local intake flow on its own." },
];

const SINGLETON_AUTO: Template[] = [
  { id: "single-a-001", text: "The single listed yard in {city} works the auto-salvage side, taking end-of-life vehicles and parts pulls in addition to standard inbound scrap." },
  { id: "single-a-002", text: "{city}'s lone scrap operator runs as an auto-salvage site, taking vehicle parts and end-of-life vehicles alongside standard inbound metal." },
  { id: "single-x-001", text: "With one scrap yard in the listings, {city}'s intake is concentrated through a single drop-off point for sellers across the local catchment." },
  { id: "single-x-002", text: "Sellers in {city} have a single listed drop-off option for inbound scrap material, with that yard handling the local intake flow on its own." },
];

const SINGLETON_INDUSTRIAL: Template[] = [
  { id: "single-i-001", text: "The single listed yard in {city} sits on the industrial-steel side, handling structural steel and contractor-volume loads alongside standard inbound scrap." },
  { id: "single-i-002", text: "{city}'s lone scrap operator runs as an industrial-steel site, taking demolition pulls and contractor-volume loads in addition to standard inbound material." },
  { id: "single-x-001", text: "With one scrap yard in the listings, {city}'s intake is concentrated through a single drop-off point for sellers across the local catchment." },
  { id: "single-x-002", text: "Sellers in {city} have a single listed drop-off option for inbound scrap material, with that yard handling the local intake flow on its own." },
];

// ---------- Picker ----------

export type RenderResult = {
  text: string;
  template_ids: { opening: string; materials: string; closer: string };
  facts_blob: Record<string, unknown>;
};

function pick<T>(arr: T[], rng: SeededRng): T {
  return arr[rng.intBelow(arr.length)]!;
}

function pickClosers(input: CitySlotInput): Template[] {
  // 1-yard cities: every multi-yard closer ("alongside the general-scrap
  // yards", "{city}'s yards include …") collapses awkwardly. Use the
  // focus-aware singleton pool instead.
  if (input.yard_count <= 1) {
    if (input.service_focus_majority === "auto-salvage" && input.has_auto_specialists) return SINGLETON_AUTO;
    if (input.service_focus_majority === "industrial-steel" && input.has_industrial_yards) return SINGLETON_INDUSTRIAL;
    return SINGLETON_GENERAL;
  }
  // 2+ yards: filter by service-focus majority + presence flags.
  const f = input.service_focus_majority;
  if (f === "auto-salvage" && input.has_auto_specialists) return CLOSER_AUTO;
  if (f === "industrial-steel" && input.has_industrial_yards) return CLOSER_INDUSTRIAL;
  if (f === "general-scrap") return CLOSER_GENERAL;
  // Mixed (or majority but missing presence flag — fall back to mixed pool).
  return CLOSER_MIXED;
}

function pickMaterials(input: CitySlotInput): Template[] {
  const sparse = input.accepted_total_unique < 3 || input.empty_accepted_pct > 80;
  return sparse ? MATERIALS_SPARSE : MATERIALS_RICH;
}

function fillSlots(template: string, slots: DerivedSlots): string {
  return template.replace(/\{([a-z_]+)\}/g, (_m, key: string) => {
    const v = (slots as unknown as Record<string, string | number>)[key];
    if (v === undefined) return "";
    return String(v);
  });
}

export function renderCityDescription(input: CitySlotInput): RenderResult {
  if (input.yard_count <= 0) {
    // Cities with zero active yards never reach this path (page would 404 or
    // show "no yards"); guard anyway.
    return {
      text: "",
      template_ids: { opening: "", materials: "", closer: "" },
      facts_blob: {},
    };
  }
  const rng = seedFor(input.state_slug, input.city_slug);
  const slots = deriveSlots(input);

  const opening = pick(OPENING_TEMPLATES, rng);
  const materials = pick(pickMaterials(input), rng);
  const closer = pick(pickClosers(input), rng);

  const sentences = [opening, materials, closer].map((t) => fillSlots(t.text, slots));
  // Squash any double-spaces from empty slot expansions, then capitalize the
  // first letter of every sentence (templates whose first slot is
  // {yard_count_word} render as "one scrap yard operates…" without this pass).
  let text = sentences.join(" ").replace(/\s{2,}/g, " ").trim();
  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase());

  return {
    text,
    template_ids: { opening: opening.id, materials: materials.id, closer: closer.id },
    facts_blob: {
      city: slots.city,
      state: slots.state,
      state_name: slots.state_name,
      yard_count: input.yard_count,
      yard_count_word: slots.yard_count_word,
      auto_count: input.auto_count,
      industrial_count: input.industrial_count,
      general_count: input.general_count,
      accepted_top_3: input.accepted_top_3,
      service_focus_majority: input.service_focus_majority,
    },
  };
}

// Exported for the coverage-check script.
export const TEMPLATE_POOLS = {
  OPENING_TEMPLATES,
  MATERIALS_RICH,
  MATERIALS_SPARSE,
  CLOSER_GENERAL,
  CLOSER_AUTO,
  CLOSER_INDUSTRIAL,
  CLOSER_MIXED,
  SINGLETON_GENERAL,
  SINGLETON_AUTO,
  SINGLETON_INDUSTRIAL,
};
