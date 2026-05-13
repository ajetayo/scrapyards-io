/**
 * Slot-filling content templates for metal CATEGORY pages.
 *
 * Same architecture as `metal-content-templates.ts` (which targets per-grade
 * pages) and `yard-desc-templates.ts`:
 *   - Pre-screened sentence templates × deterministic per-category slot fill.
 *   - md5(category_slug) → xorshift32 PRNG → identical output on re-run.
 *   - All templates pre-screened against the v3 stop-list.
 *   - No digits in template text; digits inside grade names (#1, .999, 304)
 *     pass validation because grade_names is in the facts blob.
 *
 * Three template families dispatched by category profile:
 *
 *   PURE-METAL (aluminum, brass, copper, lead, steel, zinc)
 *     - About frames around the metal itself: scrap stream, supply, demand.
 *     - Market drivers: commodity benchmarks, supply/demand, end markets.
 *     - Grade comparison (multi): top vs lowest grade differential.
 *     - Grade comparison (single, zinc): "What X looks like in scrap stream"
 *       — describes common forms (die-cast trim, galvanized shavings).
 *
 *   COMPOSITE (auto-parts, electronics)
 *     - Frames around what's INSIDE the items: lead in batteries, PGMs in
 *       catalytic converters, gold on circuit boards.
 *     - Market drivers tied to recovered-content value, not weight.
 *     - Grade comparison contrasts the two main items in the category.
 *
 *   PRECIOUS (precious-metals)
 *     - Different audience: jewelry, coins, broken chains, estate items.
 *     - Distinguishes scrap/melt value from bullion/spot price.
 *     - Addresses purity (karats, sterling marks).
 *     - Cautious educational tone, no overpromising.
 *
 * Four content blocks per category:
 *   1. about_md             (80-220 words)
 *   2. market_drivers_md    (80-220 words)
 *   3. grade_comparison_md  (60-180 words)
 *   4. faq_json             (5-7 Q&A pairs)
 */
import crypto from "node:crypto";

// ---------- Types ----------

export type CategoryFamily = "pure-metal" | "composite" | "precious";

export type CategoryProfile = {
  slug: string;
  name: string;
  family: CategoryFamily;
  grade_count: number;
  grade_names: string[];

  // Pure-metal slots
  primary_use?: string;
  supply_factor?: string;
  end_market?: string;
  contamination?: string;
  top_grade?: string;
  lowest_grade?: string;
  scrap_form_examples?: string;   // single-grade variant (zinc)
  single_grade_name?: string;     // single-grade variant (zinc)

  // Composite slots
  item_examples?: string;
  inside_value?: string;
  recovery_target?: string;
  composite_check?: string;
  item_a_name?: string;
  item_a_value_basis?: string;
  item_b_name?: string;
  item_b_value_basis?: string;

  // Precious slots
  scrap_forms?: string;
  purity_marks?: string;
  precious_end_market?: string;
};

export type RenderedCategory = {
  about_md: string;
  market_drivers_md: string;
  grade_comparison_md: string;
  faq_json: Array<{ q: string; a: string }>;
};

// ---------- PRNG ----------

class SeededRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0xffffffff;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }
}

function seedFor(...parts: string[]): number {
  const h = crypto.createHash("md5").update(parts.join("|")).digest();
  return h.readUInt32BE(0);
}

function fill(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = slots[key];
    if (v == null) throw new Error(`Missing slot: ${key} in template "${template.slice(0, 60)}..."`);
    return v;
  });
}

function joinSentences(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .map((p) => (p.endsWith(".") ? p : p + "."))
    .join(" ");
}

const COUNT_WORDS: Record<number, string> = {
  1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight",
};
function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

// ---------- Per-category profiles (9 categories) ----------

export const CATEGORY_PROFILES: Record<string, Omit<CategoryProfile, "slug" | "name">> = {
  aluminum: {
    family: "pure-metal",
    grade_count: 3,
    grade_names: ["Aluminum Cans", "Aluminum Extrusion", "Aluminum (Mixed)"],
    primary_use: "beverage cans, building products, and automotive parts",
    supply_factor: "household recycling, demolition siding, and end-of-life vehicles",
    end_market: "rolling mills, can sheet producers, and extrusion billet plants",
    contamination: "attached steel screws, plastic trim, and paint",
    top_grade: "Aluminum Extrusion",
    lowest_grade: "Aluminum (Mixed)",
  },
  brass: {
    family: "pure-metal",
    grade_count: 2,
    grade_names: ["Yellow Brass", "Red Brass"],
    primary_use: "plumbing fittings, valves, and decorative hardware",
    supply_factor: "plumbing remodels and industrial valve replacement",
    end_market: "fittings foundries and pump manufacturers",
    contamination: "steel screws, rubber gaskets, and chrome plating",
    top_grade: "Red Brass",
    lowest_grade: "Yellow Brass",
  },
  copper: {
    family: "pure-metal",
    grade_count: 5,
    grade_names: ["Bare Bright Copper", "#1 Copper", "#2 Copper", "Copper Pipe (Clean)", "Insulated Copper Wire"],
    primary_use: "electrical wiring, plumbing tubing, and HVAC coils",
    supply_factor: "home rewiring, plumbing renovation, and HVAC service work",
    end_market: "copper rod mills, tube mills, and refineries",
    contamination: "insulation jackets, solder joints, and attached brass fittings",
    top_grade: "Bare Bright Copper",
    lowest_grade: "#2 Copper",
  },
  lead: {
    family: "pure-metal",
    grade_count: 2,
    grade_names: ["Lead (Soft)", "Lead Wheel Weights"],
    primary_use: "battery plates, sheet roofing, and ammunition",
    supply_factor: "battery breaking, roofing tear-off, and tire shop turnover",
    end_market: "secondary lead smelters and battery plate makers",
    contamination: "steel clips, zinc alloy substitutes, and dirt",
    top_grade: "Lead (Soft)",
    lowest_grade: "Lead Wheel Weights",
  },
  steel: {
    family: "pure-metal",
    grade_count: 4,
    grade_names: ["Steel (Heavy Melt)", "Light Iron / Sheet", "Cast Iron", "Stainless Steel (304)"],
    primary_use: "structural steel, rebar, and cast machine parts",
    supply_factor: "demolition jobs, end-of-life equipment, and appliance turnover",
    end_market: "electric arc furnaces and foundries",
    contamination: "attached copper wiring, oil residue, and sealed containers",
    top_grade: "Steel (Heavy Melt)",
    lowest_grade: "Light Iron / Sheet",
  },
  zinc: {
    family: "pure-metal",
    grade_count: 1,
    grade_names: ["Zinc Die Cast"],
    primary_use: "die-cast hardware, automotive trim, and small castings",
    supply_factor: "old hardware turnover and automotive trim recycling",
    end_market: "die-cast remelters and zinc alloy producers",
    contamination: "chrome plating, steel inserts, and rubber bushings",
    scrap_form_examples: "automotive trim pieces, door handles, carburetor housings, and old hardware",
    single_grade_name: "Zinc Die Cast",
  },
  "auto-parts": {
    family: "composite",
    grade_count: 2,
    grade_names: ["Car Battery", "Catalytic Converter"],
    item_examples: "spent car batteries and removed catalytic converters",
    inside_value: "lead in battery plates and platinum-group metals in converter cores",
    recovery_target: "secondary lead smelters and platinum-group metal refiners",
    composite_check: "an intact case for batteries and an undamaged honeycomb core for converters",
    item_a_name: "car batteries",
    item_a_value_basis: "recovered lead content per unit",
    item_b_name: "catalytic converters",
    item_b_value_basis: "platinum-group metal content in the honeycomb core",
  },
  electronics: {
    family: "composite",
    grade_count: 2,
    grade_names: ["Low-Grade Circuit Board", "High-Grade Circuit Board", "low-grade boards", "high-grade boards"],
    item_examples: "computer power supply boards, server motherboards, and memory cards",
    inside_value: "gold and palladium on contact fingers, copper traces in the substrate, and small amounts of silver in solder",
    recovery_target: "specialty electronics refiners and downstream copper smelters",
    composite_check: "intact contact fingers and minimal attached steel cages",
    item_a_name: "high-grade boards",
    item_a_value_basis: "gold and palladium content on contact fingers",
    item_b_name: "low-grade boards",
    item_b_value_basis: "copper traces and recovered solder content",
  },
  "precious-metals": {
    family: "precious",
    grade_count: 2,
    grade_names: ["Gold", "Silver", "Gold (.999)", "Silver (.999)", "Sterling Silver"],
    scrap_forms: "broken jewelry, sterling flatware, dental gold, and worn coins",
    purity_marks: "karat stamps for gold and sterling marks for silver",
    precious_end_market: "precious-metal refiners and bullion producers",
  },
};

export function buildCategoryProfile(c: { slug: string; name: string }): CategoryProfile {
  const extra = CATEGORY_PROFILES[c.slug];
  if (!extra) {
    throw new Error(`No CATEGORY_PROFILES entry for ${c.slug} — add one to category-content-templates.ts`);
  }
  return { slug: c.slug, name: c.name, ...extra };
}

// =====================================================================
// PURE-METAL family
// =====================================================================

const PM_ABOUT_OPENERS = [
  "{category_name} is one of the staple categories at scrap yards across the country.",
  "Yards keep a posted rate for {category_name} alongside the other commodity metals on the price board.",
  "{category_name} sits in the steady-demand part of the scrap market.",
];
const PM_ABOUT_USES = [
  "End demand centers on {primary_use}, which keeps the category active in nearly every region.",
  "Downstream demand for {primary_use} is what sets the floor on yard prices.",
  "Buyers downstream consume sorted material for {primary_use}, supporting steady recycling activity.",
];
const PM_ABOUT_SUPPLY = [
  "Inbound flow comes from {supply_factor}.",
  "Yards see the material arrive from {supply_factor}.",
  "Supply that reaches yards is paced by {supply_factor}.",
];
const PM_ABOUT_FLOW = [
  "Sorted loads ship on to {end_market}, which closes the recycling loop.",
  "After sorting and weighing, material moves on to {end_market}.",
  "{end_market} are the typical downstream buyers for sorted loads.",
];
const PM_ABOUT_SELLER = [
  "For sellers, calling a couple of nearby yards before driving over confirms the day's posted rate and which grades are being accepted at the scale that morning.",
  "Sellers tracking {category_name} typically check posted rates at two or three yards on the same morning, since rates can shift with the daily commodity benchmark and yard-to-yard spreads come down to volume and downstream relationships.",
  "Sellers bringing in {category_name} should plan on calling ahead — posted rates shift with the underlying commodity benchmark, and the spread between yards in any one area usually comes down to volume and shipping logistics.",
];

const PM_MD_OPENERS = [
  "Pricing for the {category_name} category tracks underlying commodity benchmarks set on metals exchanges.",
  "What sets {category_name} prices is the daily commodity benchmark plus a yard-specific margin.",
  "{category_name} yard rates follow the broader commodity market for {primary_use}-grade material.",
];
const PM_MD_DEMAND = [
  "Demand from buyers serving {primary_use} pulls material through the yards.",
  "End-use demand from {primary_use} is a primary driver of where prices land.",
  "Activity in industries that consume {primary_use} feeds directly into posted yard rates.",
];
const PM_MD_SUPPLY = [
  "On the supply side, the steady flow from {supply_factor} sets the volume that hits the scale each week.",
  "Supply is paced by {supply_factor}, which can shift with construction and renovation cycles.",
  "{supply_factor} controls how much material reaches yards in a given week.",
];
const PM_MD_GRADES_MULTI = [
  "Across the {grade_count_word} grades in the category, the spread between {top_grade} and {lowest_grade} reflects how much sorting work the yard or downstream buyer needs to do.",
  "The price gap between grades — {top_grade} at the high end and {lowest_grade} at the low end — comes down to cleanliness and how much downstream processing is needed.",
  "Yards split the category into {grade_count_word} grades, with {top_grade} paying highest and {lowest_grade} carrying the discount tied to {contamination}.",
];
const PM_MD_GRADES_SINGLE = [
  "Posted yard rates for {single_grade_name} apply across the category, with deductions for loads carrying {contamination}.",
  "{single_grade_name} carries one posted rate, with the yard adjusting for {contamination} on a load-by-load basis.",
  "The category posts a single rate for {single_grade_name}; deductions reflect {contamination} when present.",
];
const PM_MD_OUTLOOK = [
  "Sellers tracking {category_name} get the cleanest read by checking posted rates at a couple of yards in the same window, since both the daily benchmark and local downstream demand feed in.",
  "The practical takeaway for sellers is that posted rates for {category_name} reflect both the commodity benchmark and the local pull from {end_market}.",
  "Calling two or three nearby yards on the same morning gives a useful read on where {category_name} rates are sitting that week.",
];

const PM_GC_MULTI_OPENER = [
  "Pricing across {category_name} grades depends mainly on how clean the material is and how much sorting the yard or downstream buyer has to do.",
  "Yards split {category_name} into {grade_count_word} grades, and the spread between them reflects contamination, attached parts, and recovery yield.",
  "The price gap between {category_name} grades comes from cleanliness, attached parts, and the cost of downstream processing.",
];
const PM_GC_MULTI_TOP = [
  "{top_grade} sits at the top of the scale because it goes straight into {end_market} with minimal further sorting.",
  "{top_grade} pays the highest of the family — it can move directly into {end_market}.",
  "The cleanest grade, {top_grade}, pays the highest because downstream buyers can use it as-is.",
];
const PM_GC_MULTI_LOW = [
  "{lowest_grade} pays a discount that reflects {contamination} mixed in with the load.",
  "{lowest_grade} carries the lowest rate of the family because of {contamination}.",
  "On the other end, {lowest_grade} pays a smaller per-pound rate, mostly due to {contamination}.",
];
const PM_GC_MULTI_PREP = [
  "Sellers who remove {contamination} ahead of time often clear into a cleaner grade on the scale.",
  "Trimming off {contamination} at home is the simplest way to land in a higher grade.",
  "A good portion of the spread can be closed by removing {contamination} before the trip to the yard.",
];

const PM_GC_SINGLE_OPENER = [
  "Yards typically buy {category_name} as a single grade, posted on the price board as {single_grade_name}.",
  "The {category_name} category is normally posted as one grade — {single_grade_name} — with deductions for damage or contamination.",
  "Yards post a single rate for {category_name}, listed as {single_grade_name}.",
];
const PM_GC_SINGLE_FORMS = [
  "Material arrives at yards as {scrap_form_examples}.",
  "What yards see in the load is {scrap_form_examples}.",
  "Common shapes in the inbound stream include {scrap_form_examples}.",
];
const PM_GC_SINGLE_DEDUCTIONS = [
  "Deductions show up when the load includes {contamination}.",
  "Yards apply deductions for {contamination} on a case-by-case basis.",
  "What lowers the posted price is {contamination} mixed into the load.",
];
const PM_GC_SINGLE_PREP = [
  "Sorting out {contamination} before bringing the load in helps the ticket clear at the full posted rate.",
  "Removing {contamination} at home is the simplest way to avoid a deduction at the scale.",
  "Cleaning off {contamination} ahead of time keeps the ticket at the posted price.",
];

type FaqTemplate = { q: string; a: string; condition?: (p: CategoryProfile) => boolean };

const PM_FAQ_POOL: FaqTemplate[] = [
  {
    q: "Where can I find {category_name} to scrap?",
    a: "{category_name} shows up in {supply_factor}. Common sources include parts tied to {primary_use} — old wiring, removed plumbing, salvaged appliances, and trade scraps from contractors and remodelers.",
  },
  {
    q: "Which grade of {category_name} pays the highest?",
    a: "On a per-pound basis, {top_grade} pays the highest of the family because downstream buyers can move it straight into {end_market} without further sorting.",
    condition: (p) => p.grade_count > 1,
  },
  {
    q: "Why does {single_grade_name} sometimes pay below the posted rate?",
    a: "Yards apply deductions when the load includes {contamination}. Cleaning the material at home before the trip in is the simplest way to clear at the full posted rate.",
    condition: (p) => p.grade_count === 1,
  },
  {
    q: "How can I get a higher price for my {category_name}?",
    a: "Removing {contamination} before bringing the load in is the simplest way to land in a cleaner grade on the scale. Sorting by grade ahead of time also helps the yard process your material faster.",
  },
  {
    q: "Do all scrap yards buy {category_name}?",
    a: "{category_name} is one of the staple categories, so the typical yard handles it. Some yards focus on auto salvage, demolition, or industrial accounts and may not post rates for every grade.",
  },
  {
    q: "How are {category_name} prices set?",
    a: "Posted yard prices track the daily commodity benchmark, with each yard adding or subtracting based on volume, sorting cost, and shipping distance to {end_market}.",
  },
  {
    q: "Why does {category_name} pricing change from week to week?",
    a: "Posted yard rates follow the underlying commodity market, which responds to industrial demand and inventory cycles. When the benchmark moves, yard rates usually catch up within a couple of business days.",
  },
  {
    q: "Is it worth driving farther for a higher {category_name} price?",
    a: "Calling a couple of yards in your area on the same morning gives a useful read on local rates. The price spread between yards is usually small enough that fuel cost eats most of the gain unless you're hauling a heavy load.",
  },
];

function pmSlots(p: CategoryProfile): Record<string, string> {
  return {
    category_name: p.name,
    primary_use: p.primary_use ?? "",
    supply_factor: p.supply_factor ?? "",
    end_market: p.end_market ?? "",
    contamination: p.contamination ?? "",
    top_grade: p.top_grade ?? p.grade_names[0] ?? p.name,
    lowest_grade: p.lowest_grade ?? p.grade_names[p.grade_names.length - 1] ?? p.name,
    grade_count_word: countWord(p.grade_count),
    single_grade_name: p.single_grade_name ?? p.grade_names[0] ?? p.name,
    scrap_form_examples: p.scrap_form_examples ?? "",
  };
}

function renderPureMetal(p: CategoryProfile): RenderedCategory {
  const slots = pmSlots(p);
  const isSingle = p.grade_count === 1;

  const aboutRng = new SeededRng(seedFor("about", p.slug));
  const about_md = joinSentences([
    fill(aboutRng.pick(PM_ABOUT_OPENERS), slots),
    fill(aboutRng.pick(PM_ABOUT_USES), slots),
    fill(aboutRng.pick(PM_ABOUT_SUPPLY), slots),
    fill(aboutRng.pick(PM_ABOUT_FLOW), slots),
    fill(aboutRng.pick(PM_ABOUT_SELLER), slots),
  ]);

  const mdRng = new SeededRng(seedFor("market_drivers", p.slug));
  const gradesPool = isSingle ? PM_MD_GRADES_SINGLE : PM_MD_GRADES_MULTI;
  const market_drivers_md = joinSentences([
    fill(mdRng.pick(PM_MD_OPENERS), slots),
    fill(mdRng.pick(PM_MD_DEMAND), slots),
    fill(mdRng.pick(PM_MD_SUPPLY), slots),
    fill(mdRng.pick(gradesPool), slots),
    fill(mdRng.pick(PM_MD_OUTLOOK), slots),
  ]);

  const gcRng = new SeededRng(seedFor("grade_comparison", p.slug));
  const grade_comparison_md = isSingle
    ? joinSentences([
        fill(gcRng.pick(PM_GC_SINGLE_OPENER), slots),
        fill(gcRng.pick(PM_GC_SINGLE_FORMS), slots),
        fill(gcRng.pick(PM_GC_SINGLE_DEDUCTIONS), slots),
        fill(gcRng.pick(PM_GC_SINGLE_PREP), slots),
      ])
    : joinSentences([
        fill(gcRng.pick(PM_GC_MULTI_OPENER), slots),
        fill(gcRng.pick(PM_GC_MULTI_TOP), slots),
        fill(gcRng.pick(PM_GC_MULTI_LOW), slots),
        fill(gcRng.pick(PM_GC_MULTI_PREP), slots),
      ]);

  const faq_json = renderFaq(p, PM_FAQ_POOL, slots);

  return { about_md, market_drivers_md, grade_comparison_md, faq_json };
}

// =====================================================================
// COMPOSITE family (auto-parts, electronics)
// =====================================================================

const CO_ABOUT_OPENERS = [
  "The {category_name} category covers {item_examples}. Yards buy these as whole units rather than for raw metal weight, since the value sits in {inside_value}.",
  "{category_name} pricing centers on {item_examples}, which yards purchase whole. The actual value comes from {inside_value} that downstream specialists recover after the yard.",
  "What goes into the {category_name} category is {item_examples}. Yards pay per unit because the underlying value sits in {inside_value} rather than the casing or shell.",
];
const CO_ABOUT_FLOW = [
  "Sorted material moves on from the yard to {recovery_target}, which closes the recycling loop.",
  "After the yard, the units ship on to {recovery_target}.",
  "{recovery_target} are the downstream buyers that turn the units back into usable feedstock.",
];
const CO_ABOUT_CHECK = [
  "Yards generally inspect for {composite_check} before quoting a rate, since damaged units bring less.",
  "Before quoting, yards check for {composite_check}, since condition affects what the downstream buyer will pay.",
  "Yards look for {composite_check} on inbound units; condition is the main driver of the per-unit rate.",
];
const CO_ABOUT_SELLER = [
  "For sellers, calling ahead with the item type and approximate count is the standard approach — yards quote per unit, and rates can shift with refiner schedules and downstream contracts week to week.",
  "Sellers planning to bring in {item_examples} should call ahead with item type and approximate count, since per-unit quotes change with refiner contracts and the condition of the units being dropped off.",
  "Yards quote on a call-ahead basis in this category, so sellers planning a drop-off do well to confirm the per-unit rate and any condition requirements over the phone before driving over with a load.",
];

const CO_MD_OPENER = [
  "Pricing in the {category_name} category sits on top of the commodity value of {inside_value}, plus refining cost and risk.",
  "What drives {category_name} rates is the underlying value of {inside_value} — not the weight of the casing or shell.",
  "{category_name} yard rates track the recoverable value of {inside_value} that downstream specialists pull out.",
];
const CO_MD_DEMAND = [
  "Demand from {recovery_target} is what pulls inbound units through the yards.",
  "The downstream pull from {recovery_target} sets the floor on per-unit rates.",
  "End-use demand from {recovery_target} feeds back into what each yard posts at the scale.",
];
const CO_MD_GRADES = [
  "Within the category, {item_a_name} are priced on {item_a_value_basis}, while {item_b_name} are priced on {item_b_value_basis}.",
  "The two main items in the category — {item_a_name} and {item_b_name} — price on different bases: {item_a_value_basis} for one and {item_b_value_basis} for the other.",
  "{item_a_name} pricing reflects {item_a_value_basis}; {item_b_name} pricing reflects {item_b_value_basis}.",
];
const CO_MD_OUTLOOK = [
  "Sellers should call ahead — per-unit rates in this category move week to week as refiner schedules, recovered yield, and downstream contracts shift, which makes a quick phone call worth the minute it takes.",
  "Calling two or three yards before driving over is the safest read, since per-unit rates in this category move with refiner schedules and downstream contracts rather than tracking a single daily benchmark.",
  "A quick call ahead is worth the minute it takes — per-unit rates in {category_name} can move based on refiner schedules and downstream contracts.",
];

const CO_GC_OPENER = [
  "The {category_name} category covers {item_examples}, which price on different bases at the scale.",
  "Yards split the {category_name} category by item rather than by grade. Each item carries its own per-unit pricing logic.",
  "Within {category_name}, the two main items price separately at the scale.",
];
const CO_GC_ITEM_A = [
  "Pricing for {item_a_name} reflects {item_a_value_basis}.",
  "Yards price {item_a_name} based on {item_a_value_basis}.",
  "Per-unit rates for {item_a_name} reflect {item_a_value_basis}.",
];
const CO_GC_ITEM_B = [
  "Pricing for {item_b_name} reflects {item_b_value_basis}.",
  "Yards price {item_b_name} based on {item_b_value_basis}.",
  "Per-unit rates for {item_b_name} reflect {item_b_value_basis}.",
];
const CO_GC_PREP = [
  "Across both items, condition matters: yards check for {composite_check} before quoting a rate, and damaged units take a haircut at the scale.",
  "Yards quote per unit, but the condition of {composite_check} can move the rate up or down at the scale, so sellers do well to inspect before bringing the load in.",
  "For both items, {composite_check} is what the yard inspects before quoting; bringing units in clean and intact gets the cleanest read on the per-unit rate.",
];

const CO_FAQ_POOL_GENERIC: FaqTemplate[] = [
  {
    q: "How does the {category_name} category differ from regular metal scrap?",
    a: "Yards in the {category_name} category buy whole units rather than weight-priced metal. The value comes from {inside_value} recovered downstream by specialists, not from the casing.",
  },
  {
    q: "Are prices in the {category_name} category posted publicly?",
    a: "Per-unit rates change with refiner schedules and downstream contracts, so yards typically quote on a call-ahead basis rather than posting a fixed daily rate at the scale.",
  },
  {
    q: "Do all scrap yards buy {category_name}?",
    a: "Not all yards handle {category_name}. Yards focused on commodity metals (steel, copper, aluminum) sometimes refer sellers to specialty recyclers who handle {item_examples}.",
  },
  {
    q: "What should I check before bringing in {item_examples}?",
    a: "Yards inspect for {composite_check}. Damaged units bring less, so condition matters more in this category than in commodity-grade scrap.",
  },
];

const CO_FAQ_AUTO: FaqTemplate[] = [
  {
    q: "How much is a car battery worth as scrap?",
    a: "Spent automotive batteries pay a per-unit rate that tracks recovered lead value. Yards check the case for cracks and look for missing terminals before quoting. A standard passenger-car battery typically pays a small per-unit amount at the scale, with diesel-truck batteries paying more because they're larger.",
    condition: (p) => p.slug === "auto-parts",
  },
  {
    q: "Do scrap yards buy whole catalytic converters?",
    a: "Yards that handle catalytic converters buy them whole, with pricing based on the platinum-group metal content of the honeycomb core. Tampered or chiseled converters bring much less because the recoverable PGM is gone.",
    condition: (p) => p.slug === "auto-parts",
  },
  {
    q: "Should I drain fluids before scrapping car parts?",
    a: "For batteries, the case stays sealed — yards handle the acid through their own process. For other parts, draining oil and coolant before drop-off makes the load easier to handle and avoids potential rejection at the scale.",
    condition: (p) => p.slug === "auto-parts",
  },
];

const CO_FAQ_ELECTRONICS: FaqTemplate[] = [
  {
    q: "What kind of electronics do scrap yards buy?",
    a: "Yards in the electronics category typically buy circuit boards (low-grade and high-grade), separated by the density of gold-plated contact fingers. Whole computers, TVs, and consumer devices may go to specialty e-waste recyclers rather than commodity scrap yards.",
    condition: (p) => p.slug === "electronics",
  },
  {
    q: "What is the difference between high-grade and low-grade circuit boards?",
    a: "High-grade boards have visible gold fingers and dense component populations — common on memory sticks, server boards, and CPU cards. Low-grade boards are sparser and pay a smaller per-pound rate, since the recoverable gold and palladium is lower.",
    condition: (p) => p.slug === "electronics",
  },
  {
    q: "Is it worth pulling components off old electronics?",
    a: "For the typical seller, the time cost outweighs the gain. Yards and refiners are set up to process whole boards efficiently. Removing batteries, capacitors, and heat sinks is welcome, but pulling individual chips usually loses you more in time than it gains in price.",
    condition: (p) => p.slug === "electronics",
  },
];

function coSlots(p: CategoryProfile): Record<string, string> {
  return {
    category_name: p.name,
    item_examples: p.item_examples ?? "",
    inside_value: p.inside_value ?? "",
    recovery_target: p.recovery_target ?? "",
    composite_check: p.composite_check ?? "",
    item_a_name: p.item_a_name ?? "",
    item_a_value_basis: p.item_a_value_basis ?? "",
    item_b_name: p.item_b_name ?? "",
    item_b_value_basis: p.item_b_value_basis ?? "",
  };
}

function renderComposite(p: CategoryProfile): RenderedCategory {
  const slots = coSlots(p);

  const aboutRng = new SeededRng(seedFor("about", p.slug));
  const about_md = joinSentences([
    fill(aboutRng.pick(CO_ABOUT_OPENERS), slots),
    fill(aboutRng.pick(CO_ABOUT_FLOW), slots),
    fill(aboutRng.pick(CO_ABOUT_CHECK), slots),
    fill(aboutRng.pick(CO_ABOUT_SELLER), slots),
  ]);

  const mdRng = new SeededRng(seedFor("market_drivers", p.slug));
  const market_drivers_md = joinSentences([
    fill(mdRng.pick(CO_MD_OPENER), slots),
    fill(mdRng.pick(CO_MD_DEMAND), slots),
    fill(mdRng.pick(CO_MD_GRADES), slots),
    fill(mdRng.pick(CO_MD_OUTLOOK), slots),
  ]);

  const gcRng = new SeededRng(seedFor("grade_comparison", p.slug));
  const grade_comparison_md = joinSentences([
    fill(gcRng.pick(CO_GC_OPENER), slots),
    fill(gcRng.pick(CO_GC_ITEM_A), slots),
    fill(gcRng.pick(CO_GC_ITEM_B), slots),
    fill(gcRng.pick(CO_GC_PREP), slots),
  ]);

  const specificPool = p.slug === "auto-parts" ? CO_FAQ_AUTO : p.slug === "electronics" ? CO_FAQ_ELECTRONICS : [];
  const faq_json = renderFaq(p, [...CO_FAQ_POOL_GENERIC, ...specificPool], slots);

  return { about_md, market_drivers_md, grade_comparison_md, faq_json };
}

// =====================================================================
// PRECIOUS family (precious-metals)
// =====================================================================

const PR_ABOUT_OPENERS = [
  "The {category_name} category covers {scrap_forms} brought in for melt or refining value rather than collector resale.",
  "{category_name} at scrap yards covers {scrap_forms}. Pricing centers on the recoverable metal content rather than original retail or numismatic value.",
  "What sits in the {category_name} category is {scrap_forms}, priced on the metal content after refining.",
];
const PR_ABOUT_PURITY = [
  "Yards check for {purity_marks} to set the per-gram rate.",
  "Pricing depends on purity, which yards verify by reading {purity_marks}.",
  "Yards look for {purity_marks}, since purity drives the per-gram rate.",
];
const PR_ABOUT_FLOW = [
  "Sorted material ships on from yards to {precious_end_market}, which separate and recover the underlying metal.",
  "Yards send sorted material to {precious_end_market} for recovery and refining.",
  "After the yard, the material moves on to {precious_end_market}.",
];
const PR_ABOUT_DISTINCTION = [
  "It is worth distinguishing scrap value from bullion value — scrap rates reflect what a refiner pays after recovery costs, while bullion bars and graded coins fetch a premium tied to the recognized form rather than just the metal content.",
  "An important distinction for sellers is between scrap and bullion value: scrap reflects melt and refining costs, while bullion bars and graded coins carry a form premium that scrap rates do not capture at the scale.",
  "Sellers should keep the scrap-versus-bullion distinction in mind: scrap pricing covers recovered metal value only, while investment-grade bullion and collectible coins typically sell for a premium through specialty channels.",
];
const PR_ABOUT_AUDIENCE = [
  "Common sellers in this category include estate handlers, jewelry resellers clearing damaged inventory, and households cleaning out drawer-stash silverware or broken chains.",
  "The typical seller in this category is clearing estate items, broken jewelry, or unwanted flatware rather than disposing of investment-grade metal.",
  "Inbound flow tends to come from estate cleanouts, broken jewelry, dental work, and household silver — not from investment portfolios.",
];

const PR_MD_OPENER = [
  "Pricing in the {category_name} category tracks daily spot prices for gold and silver set on commodity exchanges.",
  "What drives {category_name} yard rates is the daily spot benchmark for gold and silver, with a refining-cost discount built in.",
  "{category_name} pricing follows the spot market for gold and silver, less a refining and processing margin.",
];
const PR_MD_DEMAND = [
  "Downstream demand from {precious_end_market} pulls inbound material through yards that handle the category.",
  "The pull from {precious_end_market} is what sets the floor on yard rates.",
  "Demand from {precious_end_market} keeps recovery active even when consumer jewelry turnover is slow.",
];
const PR_MD_BULLION = [
  "An important point for sellers: scrap yard rates are the melt value, not the bullion or coin-collector price. Investment-grade rounds and graded coins should be sold through bullion dealers or numismatic markets, where they can fetch a premium over melt.",
  "Sellers should know that scrap yard rates reflect melt value only. Bullion bars, investment rounds, and collectible coins typically sell for a premium over melt at bullion dealers and coin shops.",
  "What yards pay reflects the melt value of the metal. Bullion bars and graded coins sell for more than scrap rates at specialty dealers, since the form itself carries a premium.",
];
const PR_MD_OUTLOOK = [
  "Calling ahead is essential — yards that handle {category_name} often quote based on the day's spot reading and the refining contract they're working under.",
  "A quick call ahead saves a wasted trip — per-gram rates in {category_name} can move with the spot market hour by hour.",
  "Yards that handle {category_name} typically quote on the day; calling ahead with the purity and approximate weight gets the cleanest read.",
];

const PR_GC_OPENER = [
  "Within the {category_name} category, gold and silver price separately based on their respective spot benchmarks and purity.",
  "The two main metals in the category — gold and silver — price on independent commodity benchmarks, with purity setting the per-gram rate.",
  "{category_name} yard rates split by metal: gold and silver each follow their own spot benchmark, adjusted for purity.",
];
const PR_GC_GOLD = [
  "Gold scrap is graded by karat — the karat stamp shows the percentage of pure gold in the alloy. Twenty-four karat is pure; lower karats pay a proportional fraction of the spot rate.",
  "For gold, the karat mark drives the rate: pure gold pays the spot benchmark less a refining margin, while lower-karat alloys pay a proportional fraction.",
  "Gold pricing depends on the karat stamp. Higher karats pay closer to spot; lower karats pay a fraction tied to the gold percentage in the alloy.",
];
const PR_GC_SILVER = [
  "Silver scrap is most often sold as sterling, which pays at the spot rate adjusted for the silver percentage. Pure silver pays a slightly higher rate per gram since it needs less refining work.",
  "Silver pricing tracks the spot benchmark, with sterling paying a per-gram rate scaled by the silver percentage after a refining discount. Pure silver bars and rounds pay slightly closer to spot.",
  "For silver, sterling is the most common scrap form and prices at the spot benchmark scaled by the silver percentage. Higher-purity silver pays a per-gram premium because of the lower refining cost.",
];
const PR_GC_PREP = [
  "Sorting by purity ahead of time helps the yard process the load faster and gives a cleaner read on the per-gram rate.",
  "Pre-sorting by metal and purity is welcome — it speeds up the weigh-in and gives the yard a clearer view of what's in the load.",
  "Yards appreciate pre-sorted loads grouped by metal and purity; it speeds the per-gram calculation at the scale.",
];

const PR_FAQ_POOL: FaqTemplate[] = [
  {
    q: "What is the difference between scrap gold price and bullion price?",
    a: "Scrap yard rates reflect the melt value of the metal — what a refiner pays after recovery costs. Bullion price is the spot market rate for investment-grade metal in standardized bar or round form, which includes a premium for the recognized form. Bullion bars and graded coins should be sold through bullion dealers, not scrap yards, to capture that premium.",
  },
  {
    q: "Do scrap yards even buy gold?",
    a: "Some yards buy gold and silver, but many refer sellers to specialty refiners or jewelry-buyers because the per-gram precision and refining contracts differ from commodity-metal handling. The yard search filters by accepted material, so you can see who in your area handles {category_name}.",
  },
  {
    q: "How is sterling silver priced versus fine silver?",
    a: "Sterling silver carries a fineness mark indicating it is roughly ninety-two and a half percent silver, so it pays a corresponding fraction of the per-gram spot rate. Fine silver pays a slightly higher per-gram rate because it requires less refining work to recover the metal.",
  },
  {
    q: "How is gold purity measured?",
    a: "Gold purity is measured in karats. Twenty-four karat is pure gold; eighteen karat is seventy-five percent gold; fourteen karat is roughly fifty-eight percent; ten karat is a bit over forty-one percent. The karat stamp on the piece is what yards use to set the per-gram rate.",
  },
  {
    q: "Should I bring my old jewelry to a scrap yard?",
    a: "Broken jewelry and pieces with no resale value can be sold for melt at yards or specialty buyers. Intact pieces with brand value, antique pieces, and signed designer work usually fetch much higher prices at jewelry resellers or auction than at melt rates.",
  },
  {
    q: "What about dental gold?",
    a: "Dental gold (crowns, bridges, gold-alloy fillings) is typically a mixed alloy with gold content varying by piece. Yards and refiners that handle precious metals will price it based on assayed gold percentage rather than a flat per-gram rate.",
  },
  {
    q: "Do I need an appraisal before selling scrap precious metals?",
    a: "For routine scrap quantities (broken chains, sterling flatware), the yard's per-gram rate is the standard. For larger pieces, antiques, or anything where the form might carry value beyond melt, getting a second opinion from a jeweler or appraiser before scrapping is worth the time.",
  },
];

function prSlots(p: CategoryProfile): Record<string, string> {
  return {
    category_name: p.name,
    scrap_forms: p.scrap_forms ?? "",
    purity_marks: p.purity_marks ?? "",
    precious_end_market: p.precious_end_market ?? "",
  };
}

function renderPrecious(p: CategoryProfile): RenderedCategory {
  const slots = prSlots(p);

  const aboutRng = new SeededRng(seedFor("about", p.slug));
  const about_md = joinSentences([
    fill(aboutRng.pick(PR_ABOUT_OPENERS), slots),
    fill(aboutRng.pick(PR_ABOUT_PURITY), slots),
    fill(aboutRng.pick(PR_ABOUT_FLOW), slots),
    fill(aboutRng.pick(PR_ABOUT_DISTINCTION), slots),
    fill(aboutRng.pick(PR_ABOUT_AUDIENCE), slots),
  ]);

  const mdRng = new SeededRng(seedFor("market_drivers", p.slug));
  const market_drivers_md = joinSentences([
    fill(mdRng.pick(PR_MD_OPENER), slots),
    fill(mdRng.pick(PR_MD_DEMAND), slots),
    fill(mdRng.pick(PR_MD_BULLION), slots),
    fill(mdRng.pick(PR_MD_OUTLOOK), slots),
  ]);

  const gcRng = new SeededRng(seedFor("grade_comparison", p.slug));
  const grade_comparison_md = joinSentences([
    fill(gcRng.pick(PR_GC_OPENER), slots),
    fill(gcRng.pick(PR_GC_GOLD), slots),
    fill(gcRng.pick(PR_GC_SILVER), slots),
    fill(gcRng.pick(PR_GC_PREP), slots),
  ]);

  const faq_json = renderFaq(p, PR_FAQ_POOL, slots);

  return { about_md, market_drivers_md, grade_comparison_md, faq_json };
}

// =====================================================================
// FAQ renderer (shared)
// =====================================================================

function renderFaq(
  p: CategoryProfile,
  pool: FaqTemplate[],
  slots: Record<string, string>,
): Array<{ q: string; a: string }> {
  const eligible = pool.filter((t) => !t.condition || t.condition(p));
  const rng = new SeededRng(seedFor("faq", p.slug));
  const shuffled = rng.shuffle(eligible);
  // Pick 6, clamped to [5, 7] by spec; fall back to all eligible if pool small.
  const want = Math.min(7, Math.max(5, Math.min(6, shuffled.length)));
  const picked = shuffled.slice(0, Math.min(want, shuffled.length));
  return picked.map((t) => ({
    q: fill(t.q, slots),
    a: fill(t.a, slots),
  }));
}

// =====================================================================
// Top-level dispatch
// =====================================================================

export function renderCategoryContent(p: CategoryProfile): RenderedCategory {
  switch (p.family) {
    case "pure-metal":
      return renderPureMetal(p);
    case "composite":
      return renderComposite(p);
    case "precious":
      return renderPrecious(p);
  }
}
