/**
 * Slot-filling template library for yard descriptions.
 *
 * No LLM, no inference, no creative latitude. Every slot value is derived
 * from columns on `public.yards` (+ a ZIP→county lookup, when present).
 *
 * Hard discipline:
 *   - Each opening template uses `{yard_name}` exactly once. Materials,
 *     operations, and closer templates never use the yard name (so the
 *     concatenated description has the name 1× — well under the v3
 *     validator's ≤2 cap).
 *   - No digits anywhere in template text or slot values.
 *   - No subjective / comparative / time-tenure language. The phrasings
 *     here are pre-screened against the v3 stop-list in
 *     `yard-desc-validator.ts`.
 *   - County is only ever inserted when `county_known=true`. The
 *     `{county_phrase}` slot expands to "" when the county isn't known.
 *
 * Determinism:
 *   - `pickTemplates(yard)` seeds a PRNG from `md5(slug)` so the same yard
 *     gets the same template selection on every run.
 */

import crypto from "node:crypto";

// ---------- Types ----------

export type YardSlotInput = {
  yard_id: number;
  slug: string;
  name: string;
  city: string;
  state: string; // 2-letter code
  county: string | null;
  county_known: boolean;
  has_phone: boolean;
  has_website: boolean;
  has_email: boolean;
  hours_structured: boolean;
  accepted_categories: string[]; // raw slugs, e.g. "bare-bright-copper"
  accepted_on_file: boolean;
  service_focus:
    | "general-scrap"
    | "auto-salvage"
    | "industrial"
    | "demolition"
    | "mixed";
};

export type Template = {
  id: string;
  text: string;
  required_facts: ReadonlyArray<keyof DerivedSlots | "always">;
  forbidden_conditions?: ReadonlyArray<(y: YardSlotInput) => boolean>;
  weight?: number;
  // True if this template begins with a transition phrase ("On the practical
  // side,", "Looking at posted details,", "Per the directory,", etc.).
  // Renderer post-process strips the transition from the SECOND of two
  // adjacent transition-led sections so the prose doesn't stack rhetorical
  // leads.
  transition_lead?: boolean;
};

type Section = "opening" | "materials" | "operations" | "closer";

// ---------- State-name map ----------

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

// ---------- Material slug → human label map ----------
//
// Slugs come from the yards.accepted text[] column. Unknown slugs fall back
// to a humanized version of the slug ("ferrous-metals" → "ferrous metals").

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
  // Defensive: the v3 validator rejects any digit run not present in source
  // facts. MATERIAL_LABELS is hand-curated to be digit-free; the fallback
  // (unknown slug) also strips digits so a future slug like "copper-3" or
  // "metal-foo-2" can never inject an unsourced digit into the rendered text.
  // Trailing digit suffixes get spelled-out (1→one, 2→two, 3→three, …),
  // anything else is just stripped.
  const labeled = MATERIAL_LABELS[slug];
  if (labeled) return labeled;
  const SPELL: Record<string, string> = {
    "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
    "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
  };
  let s = slug.replace(/-/g, " ");
  // Spell out a trailing single-digit suffix ("foo bar 2" → "foo bar two").
  s = s.replace(/\s(\d)$/g, (_m, d) => " " + (SPELL[d] || ""));
  // Strip any remaining digits (multi-digit or embedded).
  s = s.replace(/\d+/g, "").replace(/\s+/g, " ").trim();
  return s || "scrap material";
}

// ---------- Oxford-comma list formatter ----------

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const head = items.slice(0, -1).join(", ");
  return `${head}, and ${items[items.length - 1]}`;
}

// ---------- Derived slot computation ----------

export type DerivedSlots = {
  yard_name: string;
  city: string;
  state: string; // 2-letter
  state_name: string;
  primary_category: string;
  accepted_list: string;        // formatted, "" when not on file
  accepted_short: string;       // up to 3 categories, "" when not on file
  county_phrase: string;        // " in {x} County" or "" when unknown
  hours_phrase: string;
  contact_phrase: string;
  pronoun_subject: string;      // "the yard" / "the business" / "the operation"
  pronoun_object: string;
};

function pickPronoun(seed: SeededRng): { subject: string; object: string } {
  const choices = [
    { subject: "the yard", object: "the yard" },
    { subject: "the business", object: "the business" },
    { subject: "the operation", object: "the operation" },
    { subject: "the team", object: "the team" },
    { subject: "this site", object: "this site" },
  ];
  return choices[seed.intBelow(choices.length)]!;
}

function categoryLabel(focus: YardSlotInput["service_focus"]): string {
  switch (focus) {
    case "auto-salvage":
      return "auto salvage and parts";
    case "industrial":
      return "industrial steel and scrap";
    case "demolition":
      return "demolition and salvage";
    case "mixed":
      return "scrap and salvage";
    case "general-scrap":
    default:
      return "scrap metal recycling";
  }
}

function hoursPhrase(y: YardSlotInput, seed: SeededRng): string {
  // All phrases START LOWERCASE. The renderer auto-capitalizes sentence-starts
  // in a post-process pass so that templates which put the phrase mid-sentence
  // (e.g. "On a practical level, {hours_phrase}") read correctly.
  //
  // INVARIANT: this generator must NEVER emit "on file" or "in the listing".
  // - "on file" is owned exclusively by contactPhrase. If hoursPhrase also
  //   said "on file", the two slots could collide in a single ops sentence
  //   producing the opposing-mirror bug ("hours...are not on file and a
  //   phone line is on file") seen in pilot v2.
  // - "in the listing" is referenced by contactPhrase ("appear in the
  //   listing") and by ops template prefixes ("Per the listing,"). If
  //   hoursPhrase also said "in the listing", the rendered sentence could
  //   stack the word three times (the ops-007 stutter bug).
  if (y.hours_structured) {
    const opts = [
      "operating hours are posted in the directory entry",
      "day-to-day hours are recorded",
      "posted hours are available for visitors to check",
    ];
    return opts[seed.intBelow(opts.length)]!;
  }
  const opts = [
    "the hours of operation aren't published in the directory",
    "hours of operation aren't recorded",
    "day-to-day hours aren't posted in the directory",
  ];
  return opts[seed.intBelow(opts.length)]!;
}

function contactPhrase(y: YardSlotInput, seed: SeededRng): string {
  const channels: string[] = [];
  if (y.has_phone) channels.push("a phone line");
  if (y.has_website) channels.push("a website");
  if (y.has_email) channels.push("an email contact");
  if (channels.length === 0) {
    const opts = [
      "no contact channels are listed in the directory",
      "no phone, website, or email is on file in the listing",
    ];
    return opts[seed.intBelow(opts.length)]!;
  }
  const list = formatList(channels);
  const opts = [
    `${list} ${channels.length > 1 ? "are" : "is"} on file`,
    `${list} ${channels.length > 1 ? "appear" : "appears"} in the listing`,
  ];
  return opts[seed.intBelow(opts.length)]!;
}

function shortAcceptedList(y: YardSlotInput): string {
  if (!y.accepted_on_file) return "";
  const labels = y.accepted_categories.slice(0, 3).map(humanizeMaterial);
  return formatList(labels);
}

function fullAcceptedList(y: YardSlotInput): string {
  if (!y.accepted_on_file) return "";
  // Cap at 8 to keep prose readable.
  const labels = y.accepted_categories.slice(0, 8).map(humanizeMaterial);
  return formatList(labels);
}

function countyPhrase(y: YardSlotInput, seed: SeededRng): string {
  if (!y.county_known || !y.county) return "";
  // Strip a trailing " County" if present so we can reattach uniformly.
  const bare = y.county.replace(/\s+county\s*$/i, "").trim();
  if (!bare) return "";
  const opts = [
    ` in ${bare} County`,
    ` within ${bare} County`,
  ];
  return opts[seed.intBelow(opts.length)]!;
}

export function deriveSlots(y: YardSlotInput, seed: SeededRng): DerivedSlots {
  const pn = pickPronoun(seed);
  return {
    yard_name: y.name,
    city: y.city,
    state: y.state,
    state_name: STATE_NAMES[y.state] ?? y.state,
    primary_category: categoryLabel(y.service_focus),
    accepted_list: fullAcceptedList(y),
    accepted_short: shortAcceptedList(y),
    county_phrase: countyPhrase(y, seed),
    hours_phrase: hoursPhrase(y, seed),
    contact_phrase: contactPhrase(y, seed),
    pronoun_subject: pn.subject,
    pronoun_object: pn.object,
  };
}

// ---------- Seeded RNG (deterministic per yard slug) ----------

export class SeededRng {
  private state: number;
  constructor(seedHex: string) {
    // Take 8 hex chars (32 bits). Avoid 0.
    this.state = parseInt(seedHex.slice(0, 8), 16) || 1;
  }
  // xorshift32
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

export function seedFor(slug: string, salt = ""): SeededRng {
  const hash = crypto.createHash("md5").update(slug + "|" + salt).digest("hex");
  return new SeededRng(hash);
}

// ---------- Templates ----------

// All templates are written as 2-sentence blocks (~45-60 words each) so the
// rendered description lands in the v3 validator's 150-250 word target after
// concatenating opening + materials + operations + closer.

const OPENING_TEMPLATES: Template[] = [
  { id: "open-001", text: "{yard_name} operates as a {primary_category} site in {city}, {state_name}{county_phrase}. It is one of the local intake points for individual sellers, contractors, and small haulers who need to move scrap material rather than send it to a landfill.", required_facts: ["primary_category"] },
  { id: "open-002", text: "Scrap and salvage activity in {city}, {state_name} runs through a handful of intake points, and {yard_name} is one of them. The site works in the {primary_category} space and takes inbound material from local sellers, contractors, and people clearing out a property.", required_facts: ["primary_category"] },
  { id: "open-003", text: "{yard_name} is a {primary_category} operator working out of {city}, {state_name}{county_phrase}. The site serves walk-in sellers, small contractors, and anyone in the surrounding county who needs to turn scrap material into cash rather than haul it to landfill.", required_facts: ["primary_category"] },
  { id: "open-004", text: "Among the scrap and recycling outfits in {city}, {state_name} is {yard_name}, which handles {primary_category} work. The site processes inbound material from individual sellers and small contractors, and acts as a turn-around point for local salvage volume.", required_facts: ["primary_category"] },
  { id: "open-005", text: "{yard_name} runs a {primary_category} operation in {city}, {state_name}{county_phrase}. The site takes in scrap material from local sellers and contractors, providing a paid outlet for metal that would otherwise end up in landfill or sit in a garage.", required_facts: ["primary_category"] },
  { id: "open-006", text: "Our directory lists {yard_name} as a {primary_category} business working out of {city}, {state_name}. Listings like this exist so sellers in the surrounding county can find a paid drop-off point for scrap material rather than guessing which yard will take what.", required_facts: ["primary_category"] },
  { id: "open-007", text: "Working out of {city}, {state_name}, {yard_name} handles {primary_category} for sellers across the surrounding county. The site processes inbound scrap material from walk-in sellers, contractors, and salvage haulers who need a paid outlet for metal.", required_facts: ["primary_category"] },
  { id: "open-008", text: "{yard_name} sits in {city}, {state_name}, with a focus on {primary_category} work. The site takes inbound scrap from local sellers and small contractors, and acts as a paid outlet for material that would otherwise sit unused or head to landfill.", required_facts: ["primary_category"] },
  { id: "open-009", text: "In {city}, {state_name}, {yard_name} is a {primary_category} business that takes inbound material from sellers and contractors. The site offers a paid intake channel for scrap metal that would otherwise sit in garages, sheds, or the back lots of small construction outfits.", required_facts: ["primary_category"] },
  { id: "open-010", text: "{yard_name} is a {primary_category} site set up in {city}, {state_name}{county_phrase}. The business takes inbound scrap material from local sellers, contractors, and salvage haulers, and acts as one of the paid drop-off options in the surrounding county.", required_facts: ["primary_category"] },
  { id: "open-011", text: "Scrap sellers in and around {city}, {state_name} can take material to {yard_name}, a {primary_category} business{county_phrase}. The site works with walk-in sellers and small contractors, and provides a paid intake channel for scrap metal across the surrounding county.", required_facts: ["primary_category"] },
  { id: "open-012", text: "{yard_name} works in the {primary_category} space out of {city}, {state_name}. The site takes inbound material from local sellers and small contractors, and operates as a paid outlet for scrap metal across the surrounding county and nearby towns.", required_facts: ["primary_category"] },
  { id: "open-013", text: "{city}, {state_name} hosts {yard_name}, a {primary_category} site that serves walk-in sellers and small contractors. Listings like this exist to help sellers find a paid drop-off point for scrap material rather than burning a Saturday calling around to find one.", required_facts: ["primary_category"] },
  { id: "open-014", text: "{yard_name} is one of the {primary_category} sites listed in {city}, {state_name}. The business takes inbound scrap material from individual sellers and contractors, and acts as a paid outlet for metal that would otherwise sit unused or be sent to landfill.", required_facts: ["primary_category"] },
  { id: "open-015", text: "Operating in {city}, {state_name}, {yard_name} works as a {primary_category} business{county_phrase}. The site processes inbound scrap from local sellers and small contractors, providing a paid intake channel for material that would otherwise stay in garages or sheds.", required_facts: ["primary_category"] },
  { id: "open-016", text: "{yard_name} provides {primary_category} services in {city}, {state_name}. The business takes inbound material from walk-in sellers, small contractors, and salvage haulers across the surrounding county, and operates as a paid outlet for inbound scrap metal volume.", required_facts: ["primary_category"] },
  { id: "open-017", text: "{yard_name}, a {primary_category} business in {city}, {state_name}, takes inbound scrap from individual sellers and small contractors. The site provides a paid intake point for metal that would otherwise sit unused, and is one of the salvage options in the surrounding county.", required_facts: ["primary_category"] },
  { id: "open-018", text: "Scrap intake in {city}, {state_name} runs through outfits like {yard_name}, which handles {primary_category} work. The business takes in material from individual sellers and small contractors, and acts as a paid drop-off point for inbound scrap metal volume.", required_facts: ["primary_category"] },
  { id: "open-019", text: "{yard_name} handles {primary_category} out of {city}, {state_name}, drawing material from sellers across the surrounding county. The site processes inbound scrap from walk-in sellers, contractors, and salvage haulers who need to turn metal into cash rather than haul it home.", required_facts: ["primary_category"] },
  { id: "open-020", text: "Among the {primary_category} sites in {city}, {state_name} is {yard_name}, which takes inbound material from local sellers. The business provides a paid intake channel for scrap metal that would otherwise sit unused, and serves walk-in sellers along with small contractors.", required_facts: ["primary_category"] },
  { id: "open-021", text: "The {primary_category} business {yard_name} works out of {city}, {state_name}{county_phrase}. The site takes inbound scrap from individual sellers and small contractors, and acts as one of the paid drop-off options for salvage volume in the surrounding county.", required_facts: ["primary_category"] },
  { id: "open-022", text: "{yard_name} is set up as a {primary_category} operation in {city}, {state_name}. The site processes inbound scrap material from walk-in sellers and contractors, and provides a paid intake channel for metal that would otherwise sit in a garage or shed.", required_facts: ["primary_category"] },
  { id: "open-023", text: "Working in {city}, {state_name}, {yard_name} is a {primary_category} site listed in our directory. Listings like this help sellers find a paid drop-off point for scrap material rather than ringing around half a dozen places to find one that takes their volume.", required_facts: ["primary_category"] },
  { id: "open-024", text: "{yard_name} runs in {city}, {state_name}, taking on {primary_category} work for individual sellers and contractors. The site processes inbound scrap material from walk-in sellers and small contractors, and acts as a paid outlet for metal across the surrounding county.", required_facts: ["primary_category"] },
  { id: "open-025", text: "Scrap activity in {city}, {state_name} includes {yard_name}, which handles {primary_category} for inbound sellers. The site takes material from walk-in sellers and contractors across the surrounding county, providing a paid intake channel for inbound scrap metal volume.", required_facts: ["primary_category"] },
  { id: "open-026", text: "{yard_name} is a {primary_category} site working out of {city}, {state_name}{county_phrase}. The business takes inbound scrap from individual sellers and small contractors, and acts as one of the paid drop-off options in the surrounding county and nearby towns.", required_facts: ["primary_category"] },
  { id: "open-027", text: "Inbound scrap in {city}, {state_name} goes through sites like {yard_name}, which handles {primary_category} work. The business takes material from walk-in sellers and small contractors, providing a paid intake channel for scrap metal volume across the surrounding county.", required_facts: ["primary_category"] },
  { id: "open-028", text: "{yard_name} is a {primary_category} business that sets up shop in {city}, {state_name}. The site takes inbound scrap from walk-in sellers and small contractors, and acts as a paid outlet for material that would otherwise sit in garages or salvage piles.", required_facts: ["primary_category"] },
  { id: "open-029", text: "The {primary_category} site {yard_name} runs in {city}, {state_name}, taking inbound material from sellers and contractors. The business provides a paid drop-off point for scrap metal that would otherwise sit unused, and acts as a turn-around point for local salvage volume.", required_facts: ["primary_category"] },
  { id: "open-030", text: "Sellers in {city}, {state_name} can take scrap to {yard_name}, a {primary_category} business{county_phrase}. The site processes inbound material from walk-in sellers and small contractors, providing a paid intake channel for scrap metal across the surrounding county and nearby towns.", required_facts: ["primary_category"] },
];

// MATERIALS_WITH_DATA — purpose: state which categories the yard accepts, and
// nothing else. No "call ahead for pricing/grade" advice — that's the closer's
// job per the redundancy spec.
const MATERIALS_WITH_DATA: Template[] = [
  { id: "mat-001", text: "{pronoun_subject} buys {accepted_list}, per the categories filed in the directory. The list runs the standard intake mix the yard reported as part of its public-facing entry, and gives sellers a working baseline for what fits inbound flow on a typical day at the gate.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-002", text: "Material types accepted on the inbound side include {accepted_list}. The categories on file represent what the yard told our directory it routinely takes in from walk-in sellers and small contractors, which gives a working sense of how a load might fit the standard intake mix.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-003", text: "Sellers can bring in {accepted_list} for processing at the site, per the categories the yard filed with our directory. The list runs the typical inbound mix and serves as a working baseline when planning a load, though the printed categories are inevitably less granular than day-to-day reality.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-004", text: "Inbound categories on file are {accepted_list}. The directory shows what the yard reported as its standard intake mix — a working starting point for sellers when sorting a load before driving over, and a quick way to gauge whether a given pile is worth the trip.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-005", text: "Posted material types include {accepted_list}. The list reflects what the yard told the directory it accepts, which serves as a working baseline for what fits the standard inbound at the gate, and gives sellers something concrete to plan a load around at home.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-006", text: "On the inbound side, the listing shows {accepted_list}. Each category here is what the yard self-reported to the directory as part of its standard intake mix, which gives sellers a clean working baseline for what fits inbound flow on a typical day at the gate.", required_facts: ["accepted_list"], transition_lead: true },
  { id: "mat-007", text: "{pronoun_subject} accepts {accepted_list} on the inbound side, per directory records. The categories listed run the standard intake mix the yard reported as part of its public-facing snapshot, which gives a working sense of how a load might fit before any drive over.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-008", text: "Posted material categories cover {accepted_list}. The list is the yard's own self-reported intake mix as filed with the directory, which serves as a working baseline for what fits standard inbound flow at the gate on a typical inbound day.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-009", text: "Inventory the operation takes in includes {accepted_list}, per the listing. These categories are the standard intake mix the yard self-reported to the directory as part of its public-facing entry, and serve as a working baseline for sellers planning a load.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-010", text: "Material handled at the site, per public records, includes {accepted_list}. The list reflects the yard's own self-reported intake mix as filed with our directory, and gives sellers a clean working baseline for what fits inbound flow on a typical day at the gate.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-011", text: "Per the directory, the yard lists {accepted_list} as accepted intake. These categories were filed by the yard itself and represent the standard inbound mix at the gate on a typical day, which sellers can use as a baseline when sorting a load at home.", required_facts: ["accepted_list"], transition_lead: true },
  { id: "mat-012", text: "Sellers will find {accepted_list} on the posted list of accepted categories. The yard self-reported these to the directory, which makes the list a working baseline for the standard intake mix on a given inbound day at the gate.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-013", text: "Posted intake categories include {accepted_list}. The list is what the yard filed with the directory as its standard inbound mix, which sellers can plan a load around when sorting at home before any drive over to the gate.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-014", text: "{pronoun_subject} works with {accepted_list} on its inbound side, per the directory. The categories shown are the yard's own self-reported take — a working baseline of what fits standard inbound flow at the gate on a typical day, and a starting point for planning a load.", required_facts: ["accepted_list"], transition_lead: false },
  { id: "mat-015", text: "On the published intake list, {pronoun_subject} accepts {accepted_list}. The directory entry reflects what the yard told us it routinely takes in, which gives sellers a clean working baseline for sorting a load and gauging whether a given pile is worth the drive.", required_facts: ["accepted_list"], transition_lead: true },
];

// MATERIALS_NO_DATA — purpose: state that the accepted-materials list is
// missing. Single fact-statement only. The closer owns ALL calling advice
// across the description, so this section deliberately does not include a
// "call to confirm" sentence (which would duplicate closer guidance).
// 20 templates so the most-used at production scale (~89% of yards have
// empty accepted[]) drops to ~5%.
const MATERIALS_NO_DATA: Template[] = [
  { id: "mat-nd-001", text: "Public records do not list which material types {pronoun_subject} accepts on the inbound side as of the current directory snapshot.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-002", text: "Accepted-material categories are not on file in our directory for this yard, and the listing field remains open at present.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-003", text: "The site's accepted-material list is not posted in the directory entry for this yard at the time of the current snapshot.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-004", text: "Inbound material categories are not on file for this listing in our directory, and no specific intake set has been recorded.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-005", text: "Specific accepted-material categories are not posted in the directory for this site, leaving the inbound list open in the entry.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-006", text: "The directory does not carry an accepted-materials list for this yard at present, and no intake set has been filed.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-007", text: "Which materials this yard takes on a given day is not published in our directory under the current entry.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-008", text: "We do not have a current accepted-materials list on file for {pronoun_subject}'s inbound intake at the time of this snapshot.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-009", text: "Accepted material categories are not recorded for this yard in the current directory entry, with the field left open.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-010", text: "The yard has not filed an accepted-materials list with the directory at this time, leaving the intake set unspecified.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-011", text: "No accepted-materials list appears under this yard's directory entry at present, and no inbound categories are recorded.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-012", text: "Information on which material types this site takes on a given day is not on file in the current directory snapshot.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-013", text: "{pronoun_subject} has no posted material-acceptance list in the directory at this time, and the intake field remains blank.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-014", text: "The accepted-categories field on this listing is currently empty in our directory, with no inbound types specified.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-015", text: "Material acceptance details are not published for this yard in our directory entry at the time of the latest snapshot.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-016", text: "Posted intake categories are currently blank on this listing in our directory, with no specific materials recorded.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-017", text: "There is no accepted-materials list on file for this site in our directory at present, and the field remains open.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-018", text: "The directory entry omits a specific list of accepted materials for this yard, leaving the intake set unrecorded.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-019", text: "Inbound category data is not recorded for {pronoun_subject} in the current directory listing, with the entry left open.", required_facts: ["always"], transition_lead: false },
  { id: "mat-nd-020", text: "The site's posted intake list is currently empty in our directory entry, and no specific materials are filed.", required_facts: ["always"], transition_lead: false },
];

// OPERATIONS_TEMPLATES — purpose: report hours/contact data points only. No
// "use a pre-visit call" advice — that's the closer's job per the redundancy
// spec. Stacked transition phrases ("On X side, on Y side") removed.
const OPERATIONS_TEMPLATES: Template[] = [
  { id: "ops-001", text: "On the practical side, {hours_phrase}, and {contact_phrase}. The directory captures what the yard publishes about its day-to-day schedule and contact channels, both as filed by the operator and surfaced to sellers planning an inbound visit to the gate.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-002", text: "On the operations side, {hours_phrase}, while {contact_phrase}. These details come straight from what the yard filed with the directory and reflect the channels open to inbound sellers, which gives a working sense of how to reach the site before any drive over.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-003", text: "For practical details, {hours_phrase} and {contact_phrase}. The directory entry is the yard's own self-reported snapshot of how it handles inbound contact and posted schedule, surfaced here as a working baseline for sellers planning a visit to the gate.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-004", text: "On the contact front, {contact_phrase}. {hours_phrase}, which together form the yard's published-facing schedule and channel mix as filed with the directory, and give sellers a working sense of how to reach the site before driving over.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-005", text: "Per the directory, {hours_phrase} and {contact_phrase}. Both data points come from the yard's own filing and represent what the site has published about its inbound schedule and contact options, which gives sellers a working baseline for planning a visit.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-006", text: "Public-facing details show that {contact_phrase}, and {hours_phrase}. These two data points are what the yard has published through the directory about its day-to-day inbound flow, and give sellers a working sense of how to reach the site before any drive over.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-007", text: "On the contact and schedule side, {contact_phrase} and {hours_phrase}. The directory captures these two data points from the yard's own filing as part of its public-facing snapshot, and surfaces them as a working baseline for sellers planning an inbound visit to the gate.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-008", text: "On the directory side, {contact_phrase}. {hours_phrase}, which together represent the yard's published-facing contact and schedule mix as filed with us, and give sellers a working sense of how to reach the site before driving over with a load.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-009", text: "{hours_phrase}. {contact_phrase}, which together capture what the yard has filed with the directory about its inbound contact and posted schedule, and give sellers a working baseline for planning a visit before any drive over to the gate.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: false },
  { id: "ops-010", text: "Looking at posted details, {contact_phrase} and {hours_phrase}. These come from the yard's own filing with the directory and represent the public-facing snapshot of the inbound flow, surfaced here as a working baseline for sellers planning a visit.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-011", text: "The directory entry shows {contact_phrase}, and {hours_phrase}. Both data points reflect what the yard has filed about its inbound contact and posted schedule, and give sellers a working baseline for how to reach the site before any drive over with a load.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-012", text: "On a practical level, {hours_phrase} and {contact_phrase}. The directory carries what the yard chose to publish about its day-to-day inbound flow and contact channels, surfaced here as a working baseline for sellers planning a visit to the gate.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-013", text: "{hours_phrase}, and {contact_phrase}. These come straight from the yard's filing with the directory and represent the inbound-facing snapshot of how the site handles contact and posted hours, surfaced as a working baseline for planning a visit.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: false },
  { id: "ops-014", text: "Practical details: {hours_phrase}, and {contact_phrase}. Both data points are pulled from the yard's filing with the directory and reflect the public-facing snapshot of the inbound flow, surfaced here as a working baseline for sellers planning a visit to the gate.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
  { id: "ops-015", text: "Per public records, {hours_phrase} and {contact_phrase}. The directory carries these as the yard's own self-reported snapshot of its inbound schedule and contact mix, and surfaces them as a working baseline for sellers planning a visit to the gate.", required_facts: ["hours_phrase", "contact_phrase"], transition_lead: true },
];

// CLOSER_GENERAL — purpose: this is where pricing/grade/practical advice
// lives. Each closer adds NEW info beyond what materials and operations
// already covered (price-moves, weight, sorting, prep, gate paperwork, etc.)
// so the closer doesn't restate earlier sentences.
const CLOSER_GENERAL: Template[] = [
  { id: "cl-001", text: "Posted scrap prices move with the daily commodity market, so the intake quoted on a given day can differ from prices listed online or quoted earlier in the week. A short phone call before a drop-off pins down the day's number, and sellers can also use the same call to ask about minimum-load expectations, since some yards quote different rates depending on the inbound size.", required_facts: ["always"], transition_lead: false },
  { id: "cl-002", text: "On heavier ferrous loads, a rough weight in pounds or tons matters for the quote — sellers should bring a working estimate so the yard can price the inbound and book gate timing accordingly. A short call ahead of the drive sorts both items out before any wheels turn.", required_facts: ["always"], transition_lead: false },
  { id: "cl-003", text: "Sorting at the gate moves faster when materials are pre-separated at home — ferrous in one bin, copper in another, aluminum kept clean. The yard can post the load through faster, and sellers tend to land a cleaner intake price on each category. Pre-sorted loads also avoid the wait that comes when staff have to break a mixed bin apart on site before grading and weighing the material.", required_facts: ["always"], transition_lead: false },
  { id: "cl-004", text: "Clean material posts faster and prices better — copper free of insulation, aluminum without steel attached, iron sorted from cast. Sellers spending a few minutes on prep at home tend to land a working price quote at the gate without much back-and-forth at intake on the day.", required_facts: ["always"], transition_lead: false },
  { id: "cl-005", text: "Larger inbound volumes benefit from a phone-ahead so the yard can plan gate space and any handling equipment needed at intake. The same call lets sellers confirm whether the site can accommodate the planned load on the planned day of the drive over.", required_facts: ["always"], transition_lead: false },
  { id: "cl-006", text: "Sellers running a series of small drop-offs over a few weeks may want to ask the yard about its routine handling for repeat inbound. Some sites coordinate around recurring volume in a way that smooths both pricing and gate timing on a routine basis.", required_facts: ["always"], transition_lead: false },
  { id: "cl-007", text: "Some yards require ID at intake, and a few keep separate records for ferrous versus non-ferrous drop-offs. Sellers planning a first visit should confirm what the gate needs on a phone call so the paperwork side is sorted before driving over with a load.", required_facts: ["always"], transition_lead: false },
  { id: "cl-008", text: "Phone quotes give a working number, but the final intake price is what the yard pays at the gate after material is weighed and graded. A pre-visit call still gets sellers in the right ballpark and confirms the day's posted scrap rates. Posted online rates tend to be a guide to recent activity rather than a firm commitment for the day, and the gate price is the one that lands on the receipt.", required_facts: ["always"], transition_lead: false },
];

// CLOSER_AUTO — pre-screened so each adds NEW info specific to vehicle scrap
// (titles, fluids, towing logistics, year/make pricing). Filtered to yards
// whose service_focus resolves to "auto-salvage" or "mixed".
const CLOSER_AUTO: Template[] = [
  { id: "cl-auto-001", text: "On a complete vehicle, a clear title or proper transfer documentation is the standard requirement at the gate. Sellers planning a tow should phone the yard to confirm what paperwork is needed and the day's posted scrap rate before the truck rolls, since title rules and intake procedures vary from yard to yard at the local level.", required_facts: ["always"], transition_lead: false, forbidden_conditions: [(y) => y.service_focus !== "auto-salvage" && y.service_focus !== "mixed"] },
  { id: "cl-auto-002", text: "Sellers hauling a junk vehicle should call ahead with year, make, and condition so the yard can quote a working price before any tow is booked. The same call confirms whether the site offers pickup or expects the vehicle delivered to the gate under its own power or behind a flatbed on the day of intake.", required_facts: ["always"], transition_lead: false, forbidden_conditions: [(y) => y.service_focus !== "auto-salvage" && y.service_focus !== "mixed"] },
  { id: "cl-auto-003", text: "Auto sellers should expect the site to ask about drained fluids before intake — oil, coolant, fuel — and about whether batteries and catalytic converters need to come out separately. A phone call to the yard confirms what prep is needed and whether the operator handles that work in-house or expects the seller to arrive with the vehicle prepped.", required_facts: ["always"], transition_lead: false, forbidden_conditions: [(y) => y.service_focus !== "auto-salvage" && y.service_focus !== "mixed"] },
  { id: "cl-auto-004", text: "On a vehicle that no longer runs, a phone-ahead clarifies whether the yard offers towing as part of intake or expects the seller to arrange transport. The same call sorts paperwork and confirms a quoted scrap rate before any wheels turn, which keeps the day of the drop-off straightforward and on a known timeline.", required_facts: ["always"], transition_lead: false, forbidden_conditions: [(y) => y.service_focus !== "auto-salvage" && y.service_focus !== "mixed"] },
];

// CLOSER_INDUSTRIAL — each adds NEW info specific to heavier loads (per-ton,
// gate scheduling, capacity planning). Filtered to industrial / demolition /
// mixed focus.
const CLOSER_INDUSTRIAL: Template[] = [
  { id: "cl-ind-001", text: "Contractors with structural steel or larger industrial loads should phone the yard to confirm intake conditions and per-ton scrap pricing. The same call sorts a delivery slot at the gate and any equipment the site needs to handle the inbound, which keeps the drop-off on a known timeline rather than waiting at the scale on arrival.", required_facts: ["always"], transition_lead: false, forbidden_conditions: [(y) => y.service_focus !== "industrial" && y.service_focus !== "demolition" && y.service_focus !== "mixed"] },
  { id: "cl-ind-002", text: "On larger loads, calling ahead with approximate tonnage and material spec lets the yard quote a working per-ton price and book gate timing. The site can plan inbound capacity, and the contractor walks in with a number rather than waiting at the scale on the day of the drop-off and the drive over.", required_facts: ["always"], transition_lead: false, forbidden_conditions: [(y) => y.service_focus !== "industrial" && y.service_focus !== "demolition" && y.service_focus !== "mixed"] },
  { id: "cl-ind-003", text: "Industrial sellers should phone the yard with material spec and approximate tonnage so the site can quote per-ton intake and confirm gate handling. Heavier loads often need scheduling around the yard's own equipment, which the call sorts in advance and pins down a working price for the inbound at the same time.", required_facts: ["always"], transition_lead: false, forbidden_conditions: [(y) => y.service_focus !== "industrial" && y.service_focus !== "demolition" && y.service_focus !== "mixed"] },
  { id: "cl-ind-004", text: "Demolition crews and contractors with structural steel should phone the yard to schedule drop-off and confirm the day's per-ton scrap rate. Walking through approximate tonnage and material spec on the call books gate timing and a quoted intake price together, which keeps the drop-off on a known timeline at the gate.", required_facts: ["always"], transition_lead: false, forbidden_conditions: [(y) => y.service_focus !== "industrial" && y.service_focus !== "demolition" && y.service_focus !== "mixed"] },
];

const CLOSER_TEMPLATES: Template[] = [...CLOSER_GENERAL, ...CLOSER_AUTO, ...CLOSER_INDUSTRIAL];

// ---------- Picker ----------

function eligibleTemplates(
  pool: Template[],
  y: YardSlotInput,
  slots: DerivedSlots,
): Template[] {
  return pool.filter((t) => {
    // required_facts: each one (other than "always") must resolve to a non-empty string.
    for (const k of t.required_facts) {
      if (k === "always") continue;
      const v = (slots as Record<string, string>)[k];
      if (typeof v !== "string" || v.trim() === "") return false;
    }
    // forbidden_conditions: skip if any matches.
    if (t.forbidden_conditions) {
      for (const fn of t.forbidden_conditions) {
        if (fn(y)) return false;
      }
    }
    return true;
  });
}

function weightedPick(pool: Template[], seed: SeededRng): Template {
  if (pool.length === 0) {
    throw new Error("[picker] empty pool — template-library coverage bug");
  }
  const totalWeight = pool.reduce((s, t) => s + (t.weight ?? 1), 0);
  let roll = seed.next() * totalWeight;
  for (const t of pool) {
    roll -= t.weight ?? 1;
    if (roll <= 0) return t;
  }
  return pool[pool.length - 1]!;
}

export type PickedTemplates = Record<Section, Template>;

export function pickTemplates(y: YardSlotInput): {
  templates: PickedTemplates;
  slots: DerivedSlots;
  seed: SeededRng;
} {
  const seed = seedFor(y.slug);
  const slots = deriveSlots(y, seed);

  const opening = weightedPick(eligibleTemplates(OPENING_TEMPLATES, y, slots), seed);
  const matsPool = y.accepted_on_file
    ? eligibleTemplates(MATERIALS_WITH_DATA, y, slots)
    : eligibleTemplates(MATERIALS_NO_DATA, y, slots);
  const materials = weightedPick(matsPool, seed);
  const operations = weightedPick(eligibleTemplates(OPERATIONS_TEMPLATES, y, slots), seed);
  const closer = weightedPick(eligibleTemplates(CLOSER_TEMPLATES, y, slots), seed);

  return { templates: { opening, materials, operations, closer }, slots, seed };
}

// ---------- Slot filler ----------

export function fillSlots(template: Template, slots: DerivedSlots): string {
  return template.text.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = (slots as Record<string, string>)[key];
    if (v == null) {
      throw new Error(`[slot-filler] template ${template.id} references unknown slot {${key}}`);
    }
    return v;
  });
}

// ---------- Renderer ----------

export type RenderResult = {
  description: string;
  word_count: number;
  template_ids: Record<Section, string>;
};

// Section connectors are now just a space. Each template owns its own
// transition phrase (or lack of one) — the post-process pass dedups any
// pair of adjacent transition-leading sentences. This avoids the old bug
// where the connector "On the materials side, " was prepended to a template
// that ALSO started with "On the materials side," producing duplication.
const SECTION_CONNECTORS: Record<Section, string[]> = {
  opening: [""],
  materials: [" "],
  operations: [" "],
  closer: [" "],
};

// Transition leads we recognize. Used by the dedup pass to strip the SECOND
// of two adjacent transition-led sections. Limited to rhetorical/prepositional
// leads — sentence subjects like "The directory shows" and "The listing carries"
// are deliberately NOT counted as transitions, since they read as natural
// explanatory follow-ups rather than stacked rhetorical jumps.
const TRANSITION_LEAD_RE =
  /^(On (?:the|a) (?:practical (?:side|level|front)|operations side|contact side|contact front|schedule side|materials side|inbound side|published intake list)|For practical details|Looking at posted details|Per (?:the directory|the listing|public records)|Public-facing details show that|Practical details:)\s*[,:]?\s*/i;

// Words spelled with a vowel letter but pronounced with a consonant sound
// (yoo / w / silent-vowel) — these keep "a", not "an".
const A_BEFORE_VOWEL_EXCEPTIONS = [
  "usable", "useful", "user", "use", "using", "used", "useless",
  "university", "unique", "unit", "union", "united", "utility",
  "unicorn", "utopia", "uniform", "utilize", "ubiquitous",
  "one", "once", "U-turn",
].join("|");

function fixAAn(text: string): string {
  // "a auto" → "an auto", "a aluminum" → "an aluminum", "A apple" → "An apple",
  // EXCEPT when the next word is in the yoo-sound exceptions ("a usable", "a one-day").
  return text.replace(
    new RegExp(`\\b(a|A) (?!(?:${A_BEFORE_VOWEL_EXCEPTIONS})\\b)([aeiouAEIOU][a-zA-Z]*)`, "g"),
    (_m, art, word) => `${art}n ${word}`,
  );
}

function dedupAdjacentTransitions(
  sectionTexts: Array<{ text: string; transition_lead: boolean }>,
): string[] {
  // Walk the sections in order. If section i and section i+1 are BOTH
  // transition-leading, strip the lead from section i+1 (and capitalize the
  // next word).
  const out: string[] = [];
  for (let i = 0; i < sectionTexts.length; i++) {
    const cur = sectionTexts[i]!;
    const prev = i > 0 ? sectionTexts[i - 1]! : null;
    if (prev && prev.transition_lead && cur.transition_lead) {
      const stripped = cur.text.replace(TRANSITION_LEAD_RE, "").trim();
      const recapped = stripped.length > 0
        ? stripped[0]!.toUpperCase() + stripped.slice(1)
        : stripped;
      out.push(recapped);
    } else {
      out.push(cur.text);
    }
  }
  return out;
}

function pickConnector(section: Section, seed: SeededRng): string {
  const opts = SECTION_CONNECTORS[section];
  return opts[seed.intBelow(opts.length)]!;
}

export function renderDescription(y: YardSlotInput): RenderResult {
  const { templates, slots, seed } = pickTemplates(y);
  const sections: Section[] = ["opening", "materials", "operations", "closer"];

  // First pass: fill slots for each section, capture transition-lead flag.
  const filled = sections.map((sec) => ({
    sec,
    text: fillSlots(templates[sec], slots),
    transition_lead: !!templates[sec].transition_lead,
  }));

  // Second pass: dedup adjacent transition leads.
  const deduped = dedupAdjacentTransitions(filled);

  // Third pass: stitch with section connectors (currently single space).
  let out = deduped[0]!;
  for (let i = 1; i < deduped.length; i++) {
    const conn = pickConnector(filled[i]!.sec, seed).trim() === "" ? " " : " ";
    const prev = out.endsWith(".") ? out : out + ".";
    out = `${prev}${conn}${deduped[i]}`;
  }

  // Normalize whitespace and stray double-punctuation, ensure final period.
  out = out.replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
  if (!/[.!?]$/.test(out)) out = out + ".";

  // Auto-capitalize sentence-starts (handles lowercase derived phrases at
  // sentence boundaries, e.g. "{hours_phrase}, and ...").
  out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_m, lead, ch) => lead + ch.toUpperCase());

  // Undo false-positive sentence-start caps that follow a yard-name abbreviation
  // like ", Inc.", ", Co.", ", Bros.", ", LLC.", ", Ltd.", ", Corp." — these
  // periods belong to the company name (preceded by a comma), not a sentence
  // boundary, so the next word should stay lowercase.
  out = out.replace(
    /,\s+(Inc|Co|Bros|Ltd|LLC|Corp|Mfg|Ent|Mtl|Salv)\.\s+([A-Z])/g,
    (_m, abv, ch) => `, ${abv}. ${ch.toLowerCase()}`
  );

  // a/an indefinite-article correction. Run AFTER capitalization so the
  // exception list compares against canonical lowercase words.
  out = fixAAn(out);

  // Sanity: orphan slot markers must never survive.
  if (/\{[a-z_]+\}/.test(out)) {
    throw new Error(`[render] orphan slot in output for yard ${y.yard_id}: ${out}`);
  }

  // Sanity: no double spaces, no leading/trailing whitespace.
  if (/\s\s/.test(out)) throw new Error(`[render] double space for yard ${y.yard_id}`);
  if (/^\s|\s$/.test(out)) throw new Error(`[render] leading/trailing space for yard ${y.yard_id}`);

  const word_count = out.trim().split(/\s+/).filter(Boolean).length;

  return {
    description: out,
    word_count,
    template_ids: {
      opening: templates.opening.id,
      materials: templates.materials.id,
      operations: templates.operations.id,
      closer: templates.closer.id,
    },
  };
}

// ---------- Diagnostics export ----------

export const TEMPLATE_POOLS = {
  opening: OPENING_TEMPLATES,
  materials_with_data: MATERIALS_WITH_DATA,
  materials_no_data: MATERIALS_NO_DATA,
  operations: OPERATIONS_TEMPLATES,
  closer_general: CLOSER_GENERAL,
  closer_auto: CLOSER_AUTO,
  closer_industrial: CLOSER_INDUSTRIAL,
};
