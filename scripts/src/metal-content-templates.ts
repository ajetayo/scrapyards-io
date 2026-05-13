/**
 * Slot-filling content templates for metal price pages.
 *
 * Same architecture as `yard-desc-templates.ts`:
 *   - Pre-screened sentence templates × deterministic per-metal slot filling.
 *   - `md5(metal_slug)` → xorshift32 PRNG → deterministic output per metal.
 *   - All templates pre-screened against the v3 stop-list.
 *   - No digits in template text. No comparative / superlative / time-tenure
 *     language. No regional descriptors not in facts.
 *
 * Three content blocks per metal (national pages):
 *   1. market_drivers_md     (150-200 words)
 *   2. grade_differences_md  (100-150 words)
 *   3. faq_json              (5-7 Q&A pairs)
 *
 * One content block per (metal, state) pair (state pages):
 *   4. market_context_md     (130-180 words)
 */
import crypto from "node:crypto";

// ---------- Types ----------

export type MetalProfile = {
  slug: string;
  name: string;
  category: string;
  unit: string;
  // Slot inputs — chosen so every value is generic, defensible English with
  // no digits, no comparatives, no time-tenure language.
  demand_use: string;            // "electrical wiring and plumbing"
  supply_factor: string;         // "construction demolition and renovation work"
  industry: string;              // "construction and electrical work"
  recyclable_product: string;    // "household wiring"
  top_grade: string | null;      // "Bare Bright Copper" — null when category has 1 grade
  top_grade_purpose: string;     // "clean conductor stock for mills"
  lowest_grade: string | null;   // "#2 Copper" — null when category has 1 grade
  lowest_grade_issue: string;    // "solder, paint, or attached fittings"
  contamination: string;         // "insulation, solder, or attached brass fittings"
  consumer_market: string;       // "circuit breaker panels and refrigeration coils"
};

export type StateContextInput = {
  metal: MetalProfile;
  state_name: string;
  state_code: string;            // 2-letter
  state_industries: string;      // from states.industries_text (or fallback)
  top_city: string | null;       // city in the state with the most yards
  yard_count: number;            // count of yards in state accepting this metal
  regional_demand_factor: string; // derived from state_code → region phrase
};

export type RenderedNational = {
  market_drivers_md: string;
  grade_differences_md: string;
  faq_json: Array<{ q: string; a: string }>;
};

export type RenderedState = {
  market_context_md: string;
};

// ---------- PRNG (same as yard-desc) ----------

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

// ---------- Per-metal profiles (23 metals) ----------
//
// Hand-curated, generic, no digits, no comparatives. Each value is a
// drop-in noun phrase that reads naturally inside the templates below.

export const METAL_PROFILES: Record<string, Omit<MetalProfile, "slug" | "name" | "category" | "unit">> = {
  "bare-bright-copper": {
    demand_use: "electrical wiring and plumbing",
    supply_factor: "renovation projects and electrical work",
    industry: "construction and electrical work",
    recyclable_product: "stripped household wiring",
    top_grade: "Bare Bright Copper",
    top_grade_purpose: "clean conductor stock for copper mills",
    lowest_grade: "Number Two Copper",
    lowest_grade_issue: "solder, paint, or attached fittings",
    contamination: "insulation, solder, or attached brass fittings",
    consumer_market: "circuit breaker panels and refrigeration coils",
  },
  "copper-1": {
    demand_use: "electrical wiring and plumbing",
    supply_factor: "renovation projects and electrical work",
    industry: "construction and electrical work",
    recyclable_product: "tubing and bus bar offcuts",
    top_grade: "Bare Bright Copper",
    top_grade_purpose: "clean conductor stock for copper mills",
    lowest_grade: "Number Two Copper",
    lowest_grade_issue: "solder, paint, or attached fittings",
    contamination: "light tarnish, paint, or visible solder",
    consumer_market: "household plumbing and HVAC tubing",
  },
  "copper-2": {
    demand_use: "electrical wiring and plumbing",
    supply_factor: "demolition jobs and HVAC removal",
    industry: "construction and electrical work",
    recyclable_product: "soldered tubing and old fittings",
    top_grade: "Bare Bright Copper",
    top_grade_purpose: "clean conductor stock for copper mills",
    lowest_grade: "Number Two Copper",
    lowest_grade_issue: "solder, paint, or attached fittings",
    contamination: "solder joints, paint, brass fittings, or burn marks",
    consumer_market: "demolition tubing and old radiator coils",
  },
  "insulated-copper-wire": {
    demand_use: "electrical wiring and plumbing",
    supply_factor: "telecom upgrades and home rewiring",
    industry: "construction and electrical work",
    recyclable_product: "Romex cable and extension cords",
    top_grade: "Bare Bright Copper",
    top_grade_purpose: "clean conductor stock for copper mills",
    lowest_grade: "Number Two Copper",
    lowest_grade_issue: "solder, paint, or attached fittings",
    contamination: "PVC or rubber insulation jackets",
    consumer_market: "household and commercial wiring",
  },
  "copper-pipe": {
    demand_use: "plumbing and HVAC systems",
    supply_factor: "plumbing renovations and HVAC service work",
    industry: "construction and HVAC service",
    recyclable_product: "household plumbing tubing",
    top_grade: "Bare Bright Copper",
    top_grade_purpose: "clean conductor stock for copper mills",
    lowest_grade: "Number Two Copper",
    lowest_grade_issue: "solder, paint, or attached fittings",
    contamination: "solder joints and brass fittings on the ends",
    consumer_market: "household plumbing systems",
  },
  "aluminum-mixed": {
    demand_use: "beverage cans, building products, and auto parts",
    supply_factor: "demolition siding and consumer goods recycling",
    industry: "packaging and construction",
    recyclable_product: "siding, cans, and small castings",
    top_grade: "Aluminum Extrusion",
    top_grade_purpose: "billet stock for new extrusion",
    lowest_grade: "Aluminum (Mixed)",
    lowest_grade_issue: "attached steel, plastic, or paint",
    contamination: "attached steel screws, plastic trim, and paint",
    consumer_market: "consumer packaging and building products",
  },
  "aluminum-cans": {
    demand_use: "beverage and food packaging",
    supply_factor: "household and event recycling streams",
    industry: "beverage packaging",
    recyclable_product: "soda and beer cans",
    top_grade: "Aluminum Extrusion",
    top_grade_purpose: "billet stock for new extrusion",
    lowest_grade: "Aluminum (Mixed)",
    lowest_grade_issue: "attached steel, plastic, or paint",
    contamination: "residual liquid, food waste, and pull tabs of mixed alloy",
    consumer_market: "the can-to-can closed loop with major beverage producers",
  },
  "aluminum-extrusion": {
    demand_use: "window frames, storefronts, and trim",
    supply_factor: "window replacement and storefront refits",
    industry: "construction and architectural products",
    recyclable_product: "old window frames and storefront trim",
    top_grade: "Aluminum Extrusion",
    top_grade_purpose: "billet stock for new extrusion",
    lowest_grade: "Aluminum (Mixed)",
    lowest_grade_issue: "attached steel, plastic, or paint",
    contamination: "thermal break plastic and rubber gaskets",
    consumer_market: "new window frames and storefront systems",
  },
  "steel-heavy-melt": {
    demand_use: "structural steel and rebar production",
    supply_factor: "demolition jobs and end-of-life equipment",
    industry: "construction and steel mill feed",
    recyclable_product: "I-beams, plate cutoffs, and heavy machinery",
    top_grade: "Heavy-Melt Steel",
    top_grade_purpose: "EAF mill feed for new structural product",
    lowest_grade: "Light Iron",
    lowest_grade_issue: "thin gauge and attached non-ferrous parts",
    contamination: "attached copper wiring, oil residue, or sealed containers",
    consumer_market: "structural beams, rebar, and heavy plate",
  },
  "light-iron": {
    demand_use: "rebar and lower-grade steel products",
    supply_factor: "appliance turnover and sheet metal scrap",
    industry: "appliance manufacturing and HVAC",
    recyclable_product: "old appliances and sheet steel",
    top_grade: "Heavy-Melt Steel",
    top_grade_purpose: "EAF mill feed for new structural product",
    lowest_grade: "Light Iron",
    lowest_grade_issue: "thin gauge and attached non-ferrous parts",
    contamination: "attached copper coils, plastic housings, and refrigerant lines",
    consumer_market: "rebar, sheet, and lower-grade structural steel",
  },
  "cast-iron": {
    demand_use: "engine blocks, pipe, and machine bases",
    supply_factor: "automotive engine cores and old plumbing pipe",
    industry: "automotive remanufacturing and plumbing",
    recyclable_product: "engine blocks and bath tubs",
    top_grade: "Heavy-Melt Steel",
    top_grade_purpose: "EAF mill feed for new structural product",
    lowest_grade: "Light Iron",
    lowest_grade_issue: "thin gauge and attached non-ferrous parts",
    contamination: "attached steel parts and trapped sand from castings",
    consumer_market: "machine bases, brake rotors, and pipe",
  },
  "stainless-steel": {
    demand_use: "food service equipment, sinks, and chemical tanks",
    supply_factor: "restaurant equipment turnover and industrial scrap",
    industry: "food service and chemical processing",
    recyclable_product: "kitchen sinks and restaurant prep tables",
    top_grade: "Type Three-Oh-Four Stainless",
    top_grade_purpose: "remelting into new stainless plate and sheet",
    lowest_grade: "Type Three-Oh-Four Stainless",
    lowest_grade_issue: "attached carbon steel, plastic, or rubber",
    contamination: "attached carbon steel brackets, rubber feet, or fasteners",
    consumer_market: "appliances, sinks, and food service equipment",
  },
  "brass-yellow": {
    demand_use: "plumbing fittings, hardware, and decorative trim",
    supply_factor: "plumbing remodels and old hardware",
    industry: "plumbing supply and hardware",
    recyclable_product: "faucets, valves, and door knobs",
    top_grade: "Yellow Brass",
    top_grade_purpose: "remelting for new fittings and valves",
    lowest_grade: "Red Brass",
    lowest_grade_issue: "attached steel parts and rubber gaskets",
    contamination: "steel screws, rubber gaskets, and attached chrome plating",
    consumer_market: "plumbing fittings and door hardware",
  },
  "brass-red": {
    demand_use: "valves, pumps, and marine fittings",
    supply_factor: "industrial valve replacement and pump rebuilds",
    industry: "industrial plumbing and marine fitting",
    recyclable_product: "industrial valve bodies and pump housings",
    top_grade: "Red Brass",
    top_grade_purpose: "remelting for valves and high-strength fittings",
    lowest_grade: "Yellow Brass",
    lowest_grade_issue: "attached steel parts and rubber gaskets",
    contamination: "steel stems, rubber seats, and any chrome plating",
    consumer_market: "industrial valves and marine fittings",
  },
  "lead-soft": {
    demand_use: "battery plates, sheet roofing, and radiation shielding",
    supply_factor: "old roofing tear-off and battery breaking",
    industry: "battery manufacturing and roofing",
    recyclable_product: "lead flashing and battery posts",
    top_grade: "Lead (Soft)",
    top_grade_purpose: "remelting into new battery plates and sheet",
    lowest_grade: "Lead Wheel Weights",
    lowest_grade_issue: "attached steel clips and zinc alloy substitutes",
    contamination: "steel clips, zinc alloy substitutes, and dirt",
    consumer_market: "battery plates, sheet roofing, and ammunition",
  },
  "lead-wheel-weights": {
    demand_use: "battery plates and sheet roofing",
    supply_factor: "tire shop turnover from wheel balancing",
    industry: "tire service and battery manufacturing",
    recyclable_product: "removed wheel weights from tire shops",
    top_grade: "Lead (Soft)",
    top_grade_purpose: "remelting into new battery plates and sheet",
    lowest_grade: "Lead Wheel Weights",
    lowest_grade_issue: "attached steel clips and zinc alloy substitutes",
    contamination: "steel clips and modern zinc alloy weights mixed in",
    consumer_market: "battery plate stock after sorting",
  },
  "zinc-die-cast": {
    demand_use: "die-cast hardware, automotive trim, and small castings",
    supply_factor: "old hardware and automotive trim turnover",
    industry: "automotive trim and consumer hardware",
    recyclable_product: "automotive trim and door handles",
    top_grade: "Zinc Die Cast",
    top_grade_purpose: "remelting into new zinc die-cast products",
    lowest_grade: "Zinc Die Cast",
    lowest_grade_issue: "attached chrome plating and steel inserts",
    contamination: "chrome plating, steel inserts, and rubber bushings",
    consumer_market: "automotive trim and consumer hardware",
  },
  "low-grade-board": {
    demand_use: "precious metal recovery from solder and traces",
    supply_factor: "consumer electronics turnover and IT decommissioning",
    industry: "electronics recycling and precious metal refining",
    recyclable_product: "TV power supply boards and computer power boards",
    top_grade: "High-Grade Circuit Board",
    top_grade_purpose: "specialty refining for gold-finger contacts",
    lowest_grade: "Low-Grade Circuit Board",
    lowest_grade_issue: "attached steel cages, fans, and heatsinks",
    contamination: "attached steel cages, plastic shrouds, and fan assemblies",
    consumer_market: "downstream copper and precious metal recovery",
  },
  "high-grade-board": {
    demand_use: "gold and palladium recovery from finger contacts",
    supply_factor: "IT department decommissioning of servers and workstations",
    industry: "data center refresh and electronics refining",
    recyclable_product: "memory sticks, server boards, and CPU cards",
    top_grade: "High-Grade Circuit Board",
    top_grade_purpose: "specialty refining for gold-finger contacts",
    lowest_grade: "Low-Grade Circuit Board",
    lowest_grade_issue: "attached steel cages, fans, and heatsinks",
    contamination: "attached batteries, capacitors, or heatsinks",
    consumer_market: "the gold and palladium refining stream",
  },
  "silver": {
    demand_use: "industrial uses, jewelry, and investment products",
    supply_factor: "jewelry turnover and silverware estates",
    industry: "jewelry, photography, and electronics",
    recyclable_product: "sterling flatware and investment rounds",
    top_grade: "Silver (.999)",
    top_grade_purpose: "remelting into new investment bars and industrial stock",
    lowest_grade: "Silver (.999)",
    lowest_grade_issue: "attached steel pins and base metal mounts",
    contamination: "attached steel pins, base metal mounts, and stones",
    consumer_market: "investment bars, electronics, and jewelry stock",
  },
  "gold": {
    demand_use: "jewelry, electronics contacts, and investment products",
    supply_factor: "jewelry turnover and electronic gold recovery",
    industry: "jewelry, electronics, and investment products",
    recyclable_product: "old jewelry and dental gold",
    top_grade: "Gold (.999)",
    top_grade_purpose: "refining into new investment bars and electronic stock",
    lowest_grade: "Gold (.999)",
    lowest_grade_issue: "attached base metal clasps and gemstone mounts",
    contamination: "attached base metal clasps, solder joints, and gemstone mounts",
    consumer_market: "investment products and electronic contact stock",
  },
  "car-battery": {
    demand_use: "lead recovery for new battery plates",
    supply_factor: "auto repair shop turnover and end-of-life vehicles",
    industry: "automotive repair and battery manufacturing",
    recyclable_product: "spent automotive starter batteries",
    top_grade: "Car Battery",
    top_grade_purpose: "lead smelting for new battery plates",
    lowest_grade: "Car Battery",
    lowest_grade_issue: "case damage, missing terminals, or acid leakage",
    contamination: "case cracks, missing terminals, or acid leakage",
    consumer_market: "the lead-acid battery closed loop",
  },
  "catalytic-converter": {
    demand_use: "platinum, palladium, and rhodium recovery",
    supply_factor: "auto repair shops and end-of-life vehicles",
    industry: "automotive repair and precious metal refining",
    recyclable_product: "removed converters from auto repair shops",
    top_grade: "Catalytic Converter",
    top_grade_purpose: "specialty PGM refining",
    lowest_grade: "Catalytic Converter",
    lowest_grade_issue: "missing or chiseled-out honeycomb cores",
    contamination: "missing honeycomb cores or torch damage to the shell",
    consumer_market: "the platinum group metals refining stream",
  },
};

export function buildMetalProfile(m: { slug: string; name: string; category: string; unit: string }): MetalProfile {
  const extra = METAL_PROFILES[m.slug];
  if (!extra) {
    throw new Error(`No METAL_PROFILES entry for ${m.slug} — add one to metal-content-templates.ts`);
  }
  return { slug: m.slug, name: m.name, category: m.category, unit: m.unit, ...extra };
}

// ---------- Slot fill / pick helpers ----------

function fill(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = slots[key];
    if (v == null) throw new Error(`Missing slot: ${key} in template "${template.slice(0, 60)}..."`);
    return v;
  });
}

function joinSentences(parts: string[]): string {
  // Join with single space, ensure each sentence ends with period.
  return parts
    .map((p) => p.trim())
    .map((p) => (p.endsWith(".") ? p : p + "."))
    .join(" ");
}

// ---------- NATIONAL: market_drivers_md (4 families × 3 follow-ons) ----------

const MARKET_DRIVERS_OPENERS: string[] = [
  "Demand for {metal_name} comes mostly from {demand_use}.",
  "Most {metal_name} flows through the scrap market because of {demand_use}.",
  "{metal_name} pricing tracks the part of the broader {category_name} market that supplies {demand_use}.",
  "End-use demand for {metal_name} sits with {demand_use}.",
];

const MARKET_DRIVERS_SUPPLY: string[] = [
  "On the supply side, the steady stream of yard inflow comes from {supply_factor}.",
  "Yard inflow comes mainly from {supply_factor}, which sets the pace of what hits the scale each week.",
  "The supply that reaches yards is driven by {supply_factor}.",
];

const MARKET_DRIVERS_INDUSTRY: string[] = [
  "That ties the price closely to activity in {industry}.",
  "Activity in {industry} ends up showing in posted yard prices over a couple weeks.",
  "When {industry} slows or speeds up, posted yard prices for {metal_name} usually move with it.",
];

const MARKET_DRIVERS_PRODUCT: string[] = [
  "A typical example of what comes in is {recyclable_product}, which yards see across many tickets a week.",
  "Yards see {recyclable_product} across tickets from both households and trade customers.",
  "{recyclable_product} is one of the regular streams sellers bring in.",
];

const MARKET_DRIVERS_CONSUMER: string[] = [
  "On the consumer side, recovered {metal_name} feeds {consumer_market}.",
  "Recovered material feeds {consumer_market}, which keeps the recycling loop tight.",
  "The recovered metal goes into {consumer_market} and similar end uses.",
];

const MARKET_DRIVERS_OUTLOOK: string[] = [
  "For sellers, the practical takeaway is that posted yard rates for {metal_name} reflect both the broader commodity benchmark and the local downstream demand from {industry}, so calling two or three nearby yards on the same morning gives a useful read on what rates are doing that week.",
  "Sellers tracking {metal_name} get the most accurate read by checking posted rates at a handful of yards in the same window, since the daily benchmark and the local downstream demand from {industry} both feed into what each yard pays at the scale.",
  "Anyone selling {metal_name} regularly will see that posted rates move with the broader commodity benchmark plus the rhythm of {industry}, with each yard's volume and downstream relationships then setting where they land inside that band.",
];

export function renderMarketDrivers(metal: MetalProfile, categoryName: string): string {
  const seed = seedFor("market_drivers", metal.slug);
  const rng = new SeededRng(seed);
  const slots = {
    metal_name: metal.name,
    category_name: categoryName,
    demand_use: metal.demand_use,
    supply_factor: metal.supply_factor,
    industry: metal.industry,
    recyclable_product: metal.recyclable_product,
    consumer_market: metal.consumer_market,
  };
  const parts = [
    fill(rng.pick(MARKET_DRIVERS_OPENERS), slots),
    fill(rng.pick(MARKET_DRIVERS_SUPPLY), slots),
    fill(rng.pick(MARKET_DRIVERS_INDUSTRY), slots),
    fill(rng.pick(MARKET_DRIVERS_PRODUCT), slots),
    fill(rng.pick(MARKET_DRIVERS_CONSUMER), slots),
    fill(rng.pick(MARKET_DRIVERS_OUTLOOK), slots),
  ];
  return joinSentences(parts);
}

// ---------- NATIONAL: grade_differences_md ----------
//
// For categories with a single grade (silver, gold, car-battery,
// catalytic-converter, stainless-steel — where top == lowest), use the
// SINGLE-GRADE pool which talks about contamination tiers within the same
// grade rather than grade-vs-grade differentials.

const GRADE_DIFF_MULTI_OPENERS: string[] = [
  "Pricing across {category_name} grades depends on how clean the material is.",
  "Yards split {category_name} into several grades, and the spread between them is mostly about cleanliness.",
  "The price gap between {category_name} grades comes from contamination, attached parts, and recovery yield.",
];

const GRADE_DIFF_MULTI_TOP: string[] = [
  "The cleanest grade, {top_grade}, pays the most because it goes straight into {top_grade_purpose}.",
  "{top_grade} sits at the top of the scale; it is sold as {top_grade_purpose}.",
  "{top_grade} pays the highest of the family because it can be used directly as {top_grade_purpose}.",
];

const GRADE_DIFF_MULTI_LOW: string[] = [
  "On the other end, {lowest_grade} pays less because of {lowest_grade_issue}.",
  "{lowest_grade} pays a lower rate, which reflects {lowest_grade_issue}.",
  "{lowest_grade} carries the discount because of {lowest_grade_issue}.",
];

const GRADE_DIFF_MULTI_PREP: string[] = [
  "Most of the spread can be closed by removing {contamination} before bringing the material in.",
  "Sellers who remove {contamination} ahead of time often clear into a higher grade on the scale.",
  "Trimming off {contamination} at home is the simplest way to land in a cleaner grade.",
];

const GRADE_DIFF_SINGLE_OPENERS: string[] = [
  "Yards usually buy {metal_name} as a single grade rather than splitting it into a family of grades.",
  "Unlike copper or aluminum, {metal_name} is normally posted as one grade on the price board.",
  "The {category_name} category is normally posted as a single grade, with deductions applied for damage or contamination.",
];

const GRADE_DIFF_SINGLE_DEDUCTIONS: string[] = [
  "Deductions show up when there is {lowest_grade_issue}.",
  "Yards apply deductions for {lowest_grade_issue} on a case-by-case basis.",
  "What lowers a posted price is {lowest_grade_issue}.",
];

const GRADE_DIFF_SINGLE_PREP: string[] = [
  "Removing {contamination} before bringing the material in keeps the ticket at the posted rate.",
  "Sellers who clean off {contamination} ahead of time tend to clear at the full posted price.",
  "Cleaning off {contamination} at home is the simplest way to avoid a deduction.",
];

const GRADE_DIFF_SINGLE_BUYER: string[] = [
  "Once it leaves the yard, the material is shipped on for {top_grade_purpose}, which is why yards care about how clean the inbound load is.",
  "After the yard, the material moves on to {top_grade_purpose}, and that downstream destination is what sets how strict the yard is about contamination.",
  "Yards send sorted material on for {top_grade_purpose}; that destination is what shapes the rules around {contamination} at the scale.",
];

const SINGLE_GRADE_CATEGORIES = new Set(["precious-metals", "auto-parts"]);

function isSingleGrade(metal: MetalProfile): boolean {
  if (SINGLE_GRADE_CATEGORIES.has(metal.category)) return true;
  // stainless-steel and zinc-die-cast also sit alone in their respective slots.
  if (metal.slug === "stainless-steel" || metal.slug === "zinc-die-cast") return true;
  return false;
}

export function renderGradeDifferences(metal: MetalProfile, categoryName: string): string {
  const seed = seedFor("grade_differences", metal.slug);
  const rng = new SeededRng(seed);
  const slots = {
    metal_name: metal.name,
    category_name: categoryName,
    top_grade: metal.top_grade ?? metal.name,
    top_grade_purpose: metal.top_grade_purpose,
    lowest_grade: metal.lowest_grade ?? metal.name,
    lowest_grade_issue: metal.lowest_grade_issue,
    contamination: metal.contamination,
  };
  const parts = isSingleGrade(metal)
    ? [
        fill(rng.pick(GRADE_DIFF_SINGLE_OPENERS), slots),
        fill(rng.pick(GRADE_DIFF_SINGLE_DEDUCTIONS), slots),
        fill(rng.pick(GRADE_DIFF_SINGLE_PREP), slots),
        fill(rng.pick(GRADE_DIFF_SINGLE_BUYER), slots),
      ]
    : [
        fill(rng.pick(GRADE_DIFF_MULTI_OPENERS), slots),
        fill(rng.pick(GRADE_DIFF_MULTI_TOP), slots),
        fill(rng.pick(GRADE_DIFF_MULTI_LOW), slots),
        fill(rng.pick(GRADE_DIFF_MULTI_PREP), slots),
      ];
  return joinSentences(parts);
}

// ---------- NATIONAL: faq_json ----------

type FaqTemplate = { q: string; a: string; condition?: (m: MetalProfile) => boolean };

const FAQ_POOL: FaqTemplate[] = [
  {
    q: "Why does {metal_name} pricing change from week to week?",
    a: "Posted yard rates for {metal_name} follow underlying commodity benchmarks plus a yard-specific margin. When the benchmark moves, posted prices catch up within a couple business days at the typical yard.",
  },
  {
    q: "How are yard prices for {metal_name} different from the spot price?",
    a: "Spot is the wholesale benchmark. Yards pay a fraction of spot to cover sorting, shipping to a downstream mill or refiner, and their own margin. The fraction varies by grade and by how much volume the yard moves.",
  },
  {
    q: "Where can I sell {metal_name} near me?",
    a: "You can search yards by ZIP code from the search page and filter for ones that accept {metal_name}. Yards typically post their daily rates by phone or on a sign at the scale.",
  },
  {
    q: "Will I get a higher price if I sort or clean my {metal_name}?",
    a: "Yes — removing {contamination} before bringing material in usually lands you in a cleaner grade on the price board. Even an hour of prep work at home can move the ticket up.",
  },
  {
    q: "What does {metal_name} go into after the yard?",
    a: "Sorted {metal_name} is shipped to mills or refiners that produce {consumer_market}. The recovered material reduces the need to mine new ore and keeps the recycling loop tight.",
  },
  {
    q: "Do all yards buy {metal_name}?",
    a: "Not always. Some yards focus on auto salvage, others on industrial scrap. The yard search filters by accepted material, so you can quickly see who in your area takes {metal_name}.",
  },
  {
    q: "How is {metal_name} weighed and paid?",
    a: "Yards weigh material on a public scale and pay by the {unit_word}. The posted rate on the day you bring it in is what applies — calling ahead is the safest way to confirm.",
    condition: (m) => m.unit === "lb" || m.unit === "ton" || m.unit === "oz",
  },
  {
    q: "What lowers the price a yard pays for {metal_name}?",
    a: "The main deductions come from {lowest_grade_issue}. If the material has visible {contamination}, the yard either downgrades the ticket or applies a flat deduction.",
  },
];

const UNIT_WORD: Record<string, string> = {
  lb: "pound",
  ton: "ton",
  oz: "troy ounce",
  each: "unit",
};

export function renderFaq(metal: MetalProfile): Array<{ q: string; a: string }> {
  const seed = seedFor("faq", metal.slug);
  const rng = new SeededRng(seed);
  const slots = {
    metal_name: metal.name,
    contamination: metal.contamination,
    consumer_market: metal.consumer_market,
    lowest_grade_issue: metal.lowest_grade_issue,
    unit_word: UNIT_WORD[metal.unit] ?? "unit",
  };
  const eligible = FAQ_POOL.filter((t) => !t.condition || t.condition(metal));
  // Pick 6 deterministically (or all if fewer)
  const shuffled = rng.shuffle(eligible);
  const picked = shuffled.slice(0, Math.min(6, shuffled.length));
  return picked.map((t) => ({
    q: fill(t.q, slots),
    a: fill(t.a, slots),
  }));
}

// ---------- STATE pages: market_context_md ----------

const STATE_CONTEXT_OPENERS: string[] = [
  "Yards in {state_name} that buy {metal_name} draw from the local mix of {state_industries}.",
  "The {state_name} market for {metal_name} is shaped by the state's economic mix of {state_industries}.",
  "{state_name} sees {metal_name} flow through yards tied to {state_industries}.",
  "Local supply of {metal_name} in {state_name} comes through yards that serve {state_industries}.",
];

const STATE_CONTEXT_REGIONAL: string[] = [
  "Regionally, {regional_demand_factor}.",
  "On a regional level, {regional_demand_factor}.",
  "Wider regional patterns matter too: {regional_demand_factor}.",
];

const STATE_CONTEXT_TOP_CITY_PRESENT: string[] = [
  "Within the state, {top_city} has the largest concentration of yards taking {metal_name}.",
  "The largest pocket of yards taking {metal_name} sits in {top_city}.",
  "Most of the state's posted-rate activity for {metal_name} clusters in and around {top_city}.",
];

const STATE_CONTEXT_TOP_CITY_FALLBACK: string[] = [
  "Yards taking {metal_name} are spread across the state rather than clustered in one city.",
  "There is no single dominant city for {metal_name} in {state_name}; yards taking it are distributed across the state.",
];

const STATE_CONTEXT_DEMAND: string[] = [
  "Sellers usually find that posted rates respond to the same end-use demand for {demand_use} that drives the national market, with yard-to-yard differences inside the state coming down to volume and downstream relationships.",
  "Posted rates inside the state move with end-use demand for {demand_use}, and yard-to-yard spreads reflect each yard's volume and where it ships its sorted material.",
  "End-use demand for {demand_use} sets the floor; what each yard pays on top of that depends on its volume and shipping setup.",
];

const STATE_CONTEXT_CALL_AHEAD: string[] = [
  "Calling ahead to confirm the rate and that the yard is buying the grade you have is always worth the minute it takes.",
  "Calling the yard before driving over is the simplest way to confirm the day's rate and that they want the grade you have on hand.",
  "A quick call ahead confirms both the day's posted rate and whether the yard wants the specific grade you are bringing.",
];

export function renderMarketContext(input: StateContextInput): string {
  const seed = seedFor("market_context", input.metal.slug, input.state_code);
  const rng = new SeededRng(seed);
  const slots = {
    metal_name: input.metal.name,
    state_name: input.state_name,
    state_industries: input.state_industries,
    top_city: input.top_city ?? "",
    regional_demand_factor: input.regional_demand_factor,
    demand_use: input.metal.demand_use,
  };
  const parts = [
    fill(rng.pick(STATE_CONTEXT_OPENERS), slots),
    fill(rng.pick(STATE_CONTEXT_REGIONAL), slots),
    fill(
      input.top_city
        ? rng.pick(STATE_CONTEXT_TOP_CITY_PRESENT)
        : rng.pick(STATE_CONTEXT_TOP_CITY_FALLBACK),
      slots,
    ),
    fill(rng.pick(STATE_CONTEXT_DEMAND), slots),
    fill(rng.pick(STATE_CONTEXT_CALL_AHEAD), slots),
  ];
  return joinSentences(parts);
}

// ---------- Top-level rendering ----------

export function renderNational(metal: MetalProfile, categoryName: string): RenderedNational {
  return {
    market_drivers_md: renderMarketDrivers(metal, categoryName),
    grade_differences_md: renderGradeDifferences(metal, categoryName),
    faq_json: renderFaq(metal),
  };
}

export function renderState(input: StateContextInput): RenderedState {
  return {
    market_context_md: renderMarketContext(input),
  };
}

// ---------- Regional demand factor lookup (state code → phrase) ----------
//
// Used for the state market_context. Generic, no time tenure, no comparatives.

const NORTHEAST = new Set(["NY", "PA", "NJ", "MA", "CT", "RI", "NH", "VT", "ME", "MD", "DE", "DC"]);
const SOUTHEAST = new Set(["VA", "WV", "NC", "SC", "GA", "FL", "AL", "MS", "TN", "KY", "AR", "LA"]);
const MIDWEST = new Set(["OH", "MI", "IN", "IL", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"]);
const SOUTHWEST = new Set(["TX", "OK", "NM", "AZ"]);
const WEST = new Set(["CA", "NV", "UT", "CO", "WY", "MT", "ID", "OR", "WA", "AK", "HI"]);

export function regionalDemandFactor(stateCode: string, metal: MetalProfile): string {
  if (NORTHEAST.has(stateCode)) {
    return "the dense Northeast corridor of mills, refiners, and ports keeps downstream demand close, which usually keeps yard pay tighter to the spot benchmark";
  }
  if (SOUTHEAST.has(stateCode)) {
    return "Southeast steel and aluminum mills, plus Gulf and Atlantic ports, give yards short shipping legs to downstream buyers of " + metal.demand_use;
  }
  if (MIDWEST.has(stateCode)) {
    return "Midwest steel mills, auto plants, and rail logistics put yards close to the consuming buyers for " + metal.demand_use;
  }
  if (SOUTHWEST.has(stateCode)) {
    return "Southwest mills and Gulf-of-Mexico ports give yards a working corridor to the buyers of " + metal.demand_use;
  }
  if (WEST.has(stateCode)) {
    return "West Coast ports and the regional mill base feed downstream demand from " + metal.industry + ", though longer shipping legs to inland mills can show up in posted yard rates";
  }
  return "regional mills and ports drive downstream demand from " + metal.industry;
}
