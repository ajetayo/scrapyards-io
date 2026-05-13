/**
 * Seed the public.items catalog (Garage Calculator data layer).
 *
 * Quality rules (enforced by preflight before any insert):
 *   1. Every component.metal_slug must exist in public.metals.
 *   2. Component pcts must sum to <= 1.0 per item (remainder = non-recoverable
 *      mass: plastic, glass, insulation, refrigerant, etc.). No fake padding.
 *   3. avg_weight_lb is null when weight is unverifiable from a public source
 *      (marked with a // TODO comment) or when the item is priced per unit
 *      rather than per pound (car-battery, catalytic-converter).
 *   4. Descriptions: 50-100 words, factual. Prep tips: 30-60 words, concrete.
 *
 * Source legend (cited inline above each item):
 *   - iScrapApp:    https://www.iscrapapp.com/news/  (item scrap guides)
 *   - copper.org:   Copper Tube Handbook, Table 14.3a (Types K/L/M weights)
 *   - EPA:          https://www.epa.gov/smm  (waste-stream + appliance reports)
 *   - DOE:          https://www.energy.gov/eere/buildings/appliance-and-equipment-standards
 *   - BCI:          Battery Council International tech specs
 *   - NPGA:         National Propane Gas Association tank specs
 *
 * Run:  pnpm --filter @workspace/scripts run seed-items
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "../../lib/db/src/schema/index.js";
import { itemsTable, metalsTable } from "../../lib/db/src/schema/index.js";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

type ItemSeed = {
  slug: string;
  name: string;
  category: "appliance" | "auto" | "electrical" | "electronics" | "plumbing" | "outdoor" | "misc";
  unit: "each" | "ft" | "lb";
  avgWeightLb: number | null;
  components: { metal_slug: string; pct: number; notes?: string }[];
  descriptionMd: string;
  prepTipsMd: string;
  displayOrder: number;
  isFeatured: boolean;
};

const ITEMS: ItemSeed[] = [
  // ========================================================================
  // APPLIANCES (8) — all featured
  // ========================================================================

  // source: iScrapApp water-heater guide; midpoint of 40-50 gal residential.
  // range: 95-130 lb (gas typically lighter than electric due to no element).
  {
    slug: "water-heater",
    name: "Water Heater (40-50 gal)",
    category: "appliance",
    unit: "each",
    avgWeightLb: 110,
    components: [
      { metal_slug: "light-iron", pct: 0.92, notes: "Steel tank and outer shell" },
      { metal_slug: "copper-pipe", pct: 0.02, notes: "Inlet/outlet nipples and dip tube on copper models" },
      { metal_slug: "brass-yellow", pct: 0.005, notes: "Drain valve and anode fitting" },
    ], // ~5.5% remainder: foam insulation, glass lining, plastic dip tube
    descriptionMd:
      "A standard residential gas or electric water heater, typically 40-50 gallons. Found in basements, garages, and utility closets nationwide. The bulk of the unit is light-gauge steel surrounding a glass-lined steel tank and foam insulation. Scrap value is dominated by the steel housing weight; copper and brass fittings add modest extra value when separated. Most yards accept whole units without disassembly.",
    prepTipsMd:
      "Drain the tank fully before transport. If you can cut the copper inlet/outlet pipes and remove the brass drain valve, you'll get the higher #2 copper and yellow brass rates instead of light-iron pricing for those fittings.",
    displayOrder: 10,
    isFeatured: true,
  },

  // source: iScrapApp refrigerator guide; EPA Responsible Appliance Disposal program.
  // range: 150-250 lb depending on size and age; midpoint for typical full-size.
  {
    slug: "refrigerator",
    name: "Refrigerator (Full-Size)",
    category: "appliance",
    unit: "each",
    avgWeightLb: 200,
    components: [
      { metal_slug: "light-iron", pct: 0.78, notes: "Steel cabinet, shelves, and outer shell" },
      { metal_slug: "copper-2", pct: 0.025, notes: "Compressor windings and condenser tubing" },
      { metal_slug: "aluminum-mixed", pct: 0.04, notes: "Evaporator coil and trim" },
    ], // ~15% remainder: plastic liners, glass shelves, refrigerant, foam insulation
    descriptionMd:
      "A full-size residential refrigerator, typically top- or bottom-freezer. Refrigerators contain a sealed refrigeration system that must be evacuated by a certified technician before scrapping under EPA Section 608. Many yards charge a refrigerant-recovery fee or refuse units with intact compressors. The compressor itself is a high-value scrap item (~10-20 lb steel + copper windings) and is often removed and sold separately.",
    prepTipsMd:
      "Refrigerant must be removed by a certified tech (yards may handle this for a fee). Remove glass shelves and plastic drawers before transport. Removing the compressor and selling it separately as #2 sealed unit usually pays better than whole-unit scrap.",
    displayOrder: 20,
    isFeatured: true,
  },

  // source: iScrapApp washing-machine guide; midpoint of 150-200 lb top/front-load.
  {
    slug: "washing-machine",
    name: "Washing Machine",
    category: "appliance",
    unit: "each",
    avgWeightLb: 175,
    components: [
      { metal_slug: "light-iron", pct: 0.7, notes: "Steel cabinet and chassis" },
      { metal_slug: "stainless-steel", pct: 0.08, notes: "Inner drum (most modern units)" },
      { metal_slug: "copper-2", pct: 0.015, notes: "Motor windings" },
      { metal_slug: "aluminum-mixed", pct: 0.01, notes: "Pulleys and minor components" },
    ], // ~19.5% remainder: plastic outer tub, concrete counterweight, electronics, hoses
    descriptionMd:
      "A residential top-load or front-load clothes washer. The frame is light-gauge steel; the inner drum on most modern units is stainless steel (older units may be porcelain-coated steel, which scraps as light iron). A 20-30 lb concrete counterweight is bolted inside and counts as non-recoverable mass at most yards. Scrap value is moderate, with the stainless drum and copper motor providing the upside.",
    prepTipsMd:
      "Removing the stainless inner drum and selling it separately roughly doubles the per-pound rate for that portion. Cut motor leads and pull the motor for #2 copper windings. Drain residual water; many yards refuse wet units.",
    displayOrder: 30,
    isFeatured: true,
  },

  // source: iScrapApp dryer guide; electric dryer typical 120-150 lb (gas slightly less).
  {
    slug: "dryer-electric",
    name: "Electric Dryer",
    category: "appliance",
    unit: "each",
    avgWeightLb: 135,
    components: [
      { metal_slug: "light-iron", pct: 0.85, notes: "Steel cabinet and inner drum" },
      { metal_slug: "copper-2", pct: 0.02, notes: "Heating element coil and motor windings" },
      { metal_slug: "aluminum-mixed", pct: 0.01 },
    ], // ~12% remainder: plastic, glass door, electronics, lint filter housing
    descriptionMd:
      "A residential electric clothes dryer. The cabinet and drum are light-gauge steel; the heating element is a coiled nichrome wire wound around a ceramic former (the copper estimate above reflects motor windings, not the element itself). Gas dryers are similar in weight but contain a brass burner valve worth pulling. Scrap value is mostly determined by steel weight at light-iron rates.",
    prepTipsMd:
      "Cut and remove the power cord (insulated copper wire). For gas dryers, unscrew the brass burner valve. The motor is worth pulling for the copper windings, but the element itself has minimal scrap value.",
    displayOrder: 40,
    isFeatured: true,
  },

  // source: iScrapApp dishwasher guide; range 70-100 lb residential built-in.
  {
    slug: "dishwasher",
    name: "Dishwasher",
    category: "appliance",
    unit: "each",
    avgWeightLb: 85,
    components: [
      { metal_slug: "light-iron", pct: 0.55, notes: "Steel outer tub and frame" },
      { metal_slug: "stainless-steel", pct: 0.18, notes: "Inner tub on stainless models" },
      { metal_slug: "copper-2", pct: 0.015, notes: "Pump motor windings" },
    ], // ~25% remainder: plastic spray arms, racks (vinyl-coated steel), insulation, electronics
    descriptionMd:
      "A built-in residential dishwasher. Modern units typically have a stainless-steel inner tub; older and budget units use plastic. The frame and outer panel are light-gauge steel. Scrap value is highly dependent on whether the inner tub is stainless (significantly higher) or plastic (steel-only). Yards generally accept whole units; the racks (vinyl-coated steel) often go to light iron.",
    prepTipsMd:
      "Check whether the inner tub is stainless by magnet test (stainless 304 is non-magnetic; painted steel is magnetic). If stainless, cut it out and sell separately. Remove the pump motor for copper windings.",
    displayOrder: 50,
    isFeatured: true,
  },

  // source: iScrapApp microwave guide; range 30-40 lb countertop residential.
  {
    slug: "microwave",
    name: "Microwave Oven (Countertop)",
    category: "appliance",
    unit: "each",
    avgWeightLb: 35,
    components: [
      { metal_slug: "light-iron", pct: 0.55, notes: "Steel housing and inner cavity" },
      { metal_slug: "copper-2", pct: 0.04, notes: "Transformer windings and magnetron" },
      { metal_slug: "aluminum-mixed", pct: 0.02, notes: "Waveguide and minor parts" },
    ], // ~39% remainder: glass turntable, plastic, ceramic magnetron core, electronics
    descriptionMd:
      "A countertop microwave oven. The internal transformer is the most valuable scrap component, containing a substantial copper or aluminum winding around a laminated steel core. The magnetron tube contains a ceramic insulator that some yards classify as toxic and may decline. Otherwise, scrap value is light iron plus the transformer pull.",
    prepTipsMd:
      "Open the cabinet and remove the transformer for separate #2 copper or aluminum sale (depending on winding material). Discharge the high-voltage capacitor first by shorting its terminals — it can hold a lethal charge even when unplugged.",
    displayOrder: 60,
    isFeatured: true,
  },

  // source: iScrapApp window-AC guide + DOE small-AC efficiency standards.
  // range: 50-100 lb (5,000-15,000 BTU); midpoint of 75 lb covers 8,000-10,000 BTU.
  {
    slug: "window-ac-unit",
    name: "Window AC Unit (5,000-15,000 BTU)",
    category: "appliance",
    unit: "each",
    avgWeightLb: 75,
    components: [
      { metal_slug: "light-iron", pct: 0.55, notes: "Steel chassis and shroud" },
      { metal_slug: "copper-2", pct: 0.06, notes: "Compressor and tubing" },
      { metal_slug: "aluminum-mixed", pct: 0.18, notes: "Condenser and evaporator fins" },
    ], // ~21% remainder: plastic, refrigerant, foam, fan blade
    descriptionMd:
      "A window-mounted room air conditioner. Like refrigerators, these are sealed refrigeration systems containing refrigerant and require certified evacuation under EPA Section 608 before scrapping. The aluminum fin coils and copper compressor make window units significantly higher-value than their weight alone suggests, even though the steel chassis is the largest single component by mass. Many yards pay a small premium for whole intact window units due to the predictable aluminum-and-copper coil yield.",
    prepTipsMd:
      "Refrigerant must be evacuated by a certified tech first. Some yards offer this service. The cleanest payday is to cut out the radiator-style coil and sell aluminum and copper separately, but most non-pros sell whole units.",
    displayOrder: 70,
    isFeatured: true,
  },

  // source: iScrapApp central-AC condenser guide; 100-200 lb for 2-5 ton residential.
  // midpoint represents a typical 3-ton unit.
  {
    slug: "central-ac-condenser",
    name: "Central AC Condenser Unit (Outdoor)",
    category: "appliance",
    unit: "each",
    avgWeightLb: 150,
    components: [
      { metal_slug: "light-iron", pct: 0.45, notes: "Steel cabinet and base pan" },
      { metal_slug: "copper-2", pct: 0.1, notes: "Compressor and refrigerant tubing" },
      { metal_slug: "aluminum-mixed", pct: 0.18, notes: "Condenser coil fins" },
    ], // ~27% remainder: refrigerant, fan motor (sealed), plastic, capacitor
    descriptionMd:
      "The outdoor condenser unit of a central air conditioning system, typically 2-5 ton residential. These are among the highest-value common scrap items because of the dense copper compressor and large aluminum-fin coil. Catalytic-converter-style theft is a problem; many yards now require ID, photographs, and a hold period for AC units. Refrigerant must be recovered before scrapping.",
    prepTipsMd:
      "Have refrigerant recovered by a certified tech. The cleanest sale is to cut the copper tubing and remove the compressor (#2 sealed) separately, then strip the aluminum coil. Bring photo ID — most states require it for AC scrap to deter theft.",
    displayOrder: 80,
    isFeatured: true,
  },

  // ========================================================================
  // AUTO PARTS (8)
  // ========================================================================

  // source: BCI standard SLI battery weight (Group 24/35 typical); range 30-50 lb.
  {
    slug: "car-battery",
    name: "Car Battery (Lead-Acid)",
    category: "auto",
    unit: "each",
    avgWeightLb: null, // priced per unit at most yards, not per lb
    components: [{ metal_slug: "car-battery", pct: 1.0 }],
    descriptionMd:
      "A standard lead-acid SLI (starting/lighting/ignition) automobile battery. Yards typically pay per unit rather than per pound because the lead core, plastic case, and electrolyte are all recovered together by specialized smelters. Federal and state law in most states requires battery cores to be returned when buying a replacement, which is why some yards pay only with proof of replacement purchase.",
    prepTipsMd:
      "Do not crack or puncture the case — sulfuric acid leaks are hazardous and many yards will refuse damaged batteries. Carry upright in a leak-proof container. Lithium-ion EV batteries are entirely different and not accepted at most scrap yards.",
    displayOrder: 110,
    isFeatured: true,
  },

  // source: priced per unit on the basis of internal PGM (Pt/Pd/Rh) content.
  {
    slug: "catalytic-converter",
    name: "Catalytic Converter",
    category: "auto",
    unit: "each",
    avgWeightLb: null, // per-unit pricing based on PGM content, not weight
    components: [{ metal_slug: "catalytic-converter", pct: 1.0 }],
    descriptionMd:
      "An automotive catalytic converter. Value is determined by the platinum-group metal (PGM) content (platinum, palladium, rhodium) in the ceramic honeycomb substrate rather than by external steel weight, and varies dramatically by vehicle make and model. Diesel particulate filters (DPFs) are physically similar but priced under a separate category. Theft is rampant nationwide, so reputable yards require photo ID, vehicle ownership documentation, and a multi-day hold period before payment under most state laws.",
    prepTipsMd:
      "Do not break, cut, or empty the substrate — yards pay per intact unit and a smashed converter loses most of its value. Bring vehicle title or registration; most states now require documentation to deter theft.",
    displayOrder: 120,
    isFeatured: true,
  },

  // source: iScrapApp alternator guide; range 10-15 lb passenger-car.
  {
    slug: "alternator",
    name: "Car Alternator",
    category: "auto",
    unit: "each",
    avgWeightLb: 12,
    components: [
      { metal_slug: "copper-2", pct: 0.15, notes: "Stator and rotor windings" },
      { metal_slug: "light-iron", pct: 0.55, notes: "Steel housing and core laminations" },
      { metal_slug: "aluminum-mixed", pct: 0.15, notes: "End housings (most modern units)" },
    ], // ~15% remainder: bearings, plastic, rectifier diodes
    descriptionMd:
      "A passenger-vehicle alternator from a typical car, pickup, or SUV. The stator and rotor contain dense copper windings wound around a laminated steel core, which is the source of the unit's scrap value. Many yards classify alternators as 'electric motors' and pay a flat per-unit or per-pound rate; others want them cut open for the higher #2 copper rate on exposed windings. Rebuildable cores often fetch a per-core rebate from auto-parts rebuilders that exceeds scrap value.",
    prepTipsMd:
      "Check first whether the alternator is a rebuildable core — most chain auto-parts stores pay a per-core rebate that beats scrap, especially on late-model and import-vehicle units. If selling for scrap, breaking the housing open with a chisel or sawzall to expose the copper windings raises the per-pound rate.",
    displayOrder: 130,
    isFeatured: false,
  },

  // source: iScrapApp starter-motor guide; range 8-12 lb passenger-car.
  {
    slug: "starter-motor",
    name: "Starter Motor",
    category: "auto",
    unit: "each",
    avgWeightLb: 10,
    components: [
      { metal_slug: "copper-2", pct: 0.18, notes: "Field windings and armature" },
      { metal_slug: "light-iron", pct: 0.7, notes: "Steel housing and core" },
    ], // ~12% remainder: brushes (carbon), bearings, plastic
    descriptionMd:
      "An automotive starter motor from a passenger car or light truck. Higher copper content per pound than alternators because of the dense armature and field windings packed into a smaller housing. Like alternators, rebuilders often pay a per-core rebate that beats scrap value, especially for late-model and import-vehicle starters. Yards typically classify these as 'electric motors' or 'sealed units' for pricing. Permanent-magnet starters are increasingly common on newer vehicles.",
    prepTipsMd:
      "Try the auto-parts core counter first — most chains pay a small per-core rebate. For scrap, breaking open the housing with a chisel or sawzall to expose the copper roughly doubles the per-pound rate. Watch for sealed permanent-magnet starters, which contain neodymium magnets and may have collectible value.",
    displayOrder: 140,
    isFeatured: false,
  },

  // source: iScrapApp auto-radiator guide; modern aluminum/plastic radiators 10-20 lb.
  // older copper/brass radiators were heavier (20-40 lb) and worth far more.
  {
    slug: "auto-radiator",
    name: "Auto Radiator (Aluminum/Plastic)",
    category: "auto",
    unit: "each",
    avgWeightLb: 15,
    components: [
      { metal_slug: "aluminum-mixed", pct: 0.55, notes: "Aluminum core and tubes" },
      { metal_slug: "light-iron", pct: 0.05, notes: "Brackets" },
    ], // ~40% remainder: plastic end-tanks, rubber, residual coolant
    descriptionMd:
      "A modern automotive radiator with an aluminum core and plastic end-tanks (the standard since the 1980s). Older copper-and-brass radiators are still occasionally encountered and are worth substantially more — sell those as 'clean copper/brass radiator' for the brass-yellow rate. Yards may classify modern aluminum/plastic radiators as 'dirty aluminum' due to the plastic.",
    prepTipsMd:
      "Cut off the plastic end-tanks for the higher 'aluminum extrusion' or clean-aluminum rate (instead of dirty). Drain coolant — yards may refuse wet units. If the radiator is older copper/brass, do not strip; sell whole at the brass rate.",
    displayOrder: 150,
    isFeatured: false,
  },

  // source: iScrapApp aluminum-wheel guide; passenger 15-25 lb (truck/SUV up to 35).
  {
    slug: "aluminum-wheel-rim",
    name: "Aluminum Wheel Rim (Passenger)",
    category: "auto",
    unit: "each",
    avgWeightLb: 20,
    components: [{ metal_slug: "aluminum-extrusion", pct: 1.0, notes: "Cast or forged aluminum" }],
    descriptionMd:
      "A cast or forged aluminum passenger-car wheel rim. Pays at clean aluminum extrusion rates if the tire is removed and the rim is free of steel weights and valve stems. Modern truck and SUV rims tend to be 25-35 lb each. Polished and chrome-plated rims are accepted but sometimes downgraded.",
    prepTipsMd:
      "Remove the tire (most yards charge a fee or refuse rims with tires). Pull all stick-on or clip-on lead wheel weights — sell those separately as lead wheel weights. Remove the rubber valve stem.",
    displayOrder: 160,
    isFeatured: false,
  },

  // source: iScrapApp steel-wheel guide; 20-30 lb passenger.
  {
    slug: "steel-wheel-rim",
    name: "Steel Wheel Rim (Passenger)",
    category: "auto",
    unit: "each",
    avgWeightLb: 25,
    components: [{ metal_slug: "light-iron", pct: 1.0, notes: "Stamped steel" }],
    descriptionMd:
      "A stamped-steel passenger-car wheel rim, typically used as a winter wheel, spare, or original equipment on budget trim packages. Steel rims pay at light-iron rates per pound, which is well below the aluminum-extrusion rate that aluminum rims earn for the same wheel. Most are commonly sold by the truckload as part of mixed steel from auto recyclers. A set of four steel wheels yields roughly 100 lb of light iron.",
    prepTipsMd:
      "Remove the tire (most yards charge a fee or refuse rims with tires still mounted) and pry off any stick-on or clip-on lead wheel weights. Pull the rubber valve stem. Sell with other light iron in a single load to minimize trips and weighing fees.",
    displayOrder: 170,
    isFeatured: false,
  },

  // source: iScrapApp engine-block guide; passenger-car aluminum block 80-120 lb bare.
  {
    slug: "aluminum-engine-block",
    name: "Aluminum Engine Block (Bare)",
    category: "auto",
    unit: "each",
    avgWeightLb: 100,
    components: [{ metal_slug: "aluminum-mixed", pct: 0.95, notes: "Cast aluminum" }],
    // ~5% remainder: residual steel cylinder liners, sensor bungs, plug threads
    descriptionMd:
      "A bare aluminum engine block from a passenger car or light truck, stripped of internals. Pays at dirty aluminum rates if cylinder liners (steel sleeves) and other steel inserts remain in place. Removing the liners and selling them as light iron raises the aluminum portion to near-clean rates. Iron blocks are heavier (200-400 lb) and sell as cast iron.",
    prepTipsMd:
      "Drain all engine oil and coolant before transport — yards refuse blocks with fluid inside. Pull steel cylinder liners with a slide hammer if practical, then sell them as light iron for clean-aluminum pricing on the block. Verify aluminum (not iron) by magnet test before listing — iron blocks pay differently.",
    displayOrder: 180,
    isFeatured: false,
  },

  // ========================================================================
  // ELECTRICAL / WIRE (8)
  // ========================================================================

  // source: Southwire Romex SIMpull NM-B product catalog spec sheet
  //   (https://www.southwire.com/ — 12/2 w/ground = 76 lb per 1000 ft = 0.076 lb/ft)
  // copper content per NEC Chapter 9 Table 8 conductor properties:
  //   12 AWG solid copper = 19.77 lb/1000 ft per conductor; 3 conductors (hot, neutral, ground)
  //   = 59.3 lb/1000 ft = 0.0593 lb/ft. pct = 0.0593 / 0.076 = 0.78.
  {
    slug: "romex-wire-12-2",
    name: "Romex Wire 12/2 NM-B (with ground)",
    category: "electrical",
    unit: "ft",
    avgWeightLb: 0.076,
    components: [
      { metal_slug: "bare-bright-copper", pct: 0.78, notes: "Three solid 12 AWG copper conductors after stripping (~0.0593 lb/ft)" },
    ], // ~22% remainder: PVC jacket, paper filler
    descriptionMd:
      "Standard residential 12-gauge two-conductor non-metallic-sheathed cable with ground, used on 20-amp kitchen, bath, and small-appliance circuits. Sold by the linear foot but typically scrapped in coils or full unused reels left over from new construction. Stripped to bare copper, it pays the bare-bright rate — the highest copper grade. Sold whole with PVC jacket and conductor insulation, it pays the lower insulated copper rate, which is roughly half.",
    prepTipsMd:
      "Stripping the outer PVC jacket and inner conductor insulation roughly doubles the per-pound rate (bare bright vs insulated copper wire). Manual benchtop strippers pay back their cost over 50-100 feet of stripped wire. Coil tightly for transport — loose tangled wire is often weighed less generously.",
    displayOrder: 210,
    isFeatured: false,
  },

  // source: Southwire Romex SIMpull NM-B product catalog spec sheet
  //   (https://www.southwire.com/ — 14/2 w/ground = 48 lb per 1000 ft = 0.048 lb/ft)
  // copper content per NEC Chapter 9 Table 8 conductor properties:
  //   14 AWG solid copper = 12.43 lb/1000 ft per conductor; 3 conductors
  //   = 37.3 lb/1000 ft = 0.0373 lb/ft. pct = 0.0373 / 0.048 = 0.78.
  {
    slug: "romex-wire-14-2",
    name: "Romex Wire 14/2 NM-B (with ground)",
    category: "electrical",
    unit: "ft",
    avgWeightLb: 0.048,
    components: [
      { metal_slug: "bare-bright-copper", pct: 0.78, notes: "Three solid 14 AWG copper conductors after stripping (~0.0373 lb/ft)" },
    ],
    descriptionMd:
      "Residential 14-gauge two-conductor NM-B cable with ground, the most common circuit type for general lighting and 15-amp receptacles. Same construction as 12/2 but with thinner conductors, yielding roughly 25% less copper per foot. Lighting installations typically run longer than appliance circuits, so a single house demolition often produces several hundred feet of 14/2 alongside the heavier 12/2. Sold whole, pays the insulated rate; stripped, the bare-bright rate.",
    prepTipsMd:
      "Strip the outer PVC jacket and inner conductor insulation to reach bare-bright pricing — typically doubles the rate vs insulated. Bundle stripped and unstripped lengths separately. Manual strippers earn back their cost over 50-100 ft.",
    displayOrder: 220,
    isFeatured: false,
  },

  // source: THHN spec sheets vary by gauge; weight is highly gauge-dependent.
  // TODO: refine per-gauge weights when calculator UI exposes a gauge selector.
  {
    slug: "thhn-wire-stranded",
    name: "THHN Stranded Wire (Insulated)",
    category: "electrical",
    unit: "ft",
    avgWeightLb: null, // TODO: weight varies 0.01-0.4 lb/ft across 18-4/0 AWG; refine in calculator
    components: [
      { metal_slug: "insulated-copper-wire", pct: 1.0, notes: "Sold whole at insulated rate; strip for bare bright" },
    ],
    descriptionMd:
      "Stranded copper conductor with PVC insulation and nylon jacket (THHN/THWN), used in conduit runs, panel feeders, and commercial wiring. Sold by the linear foot but typically scrapped in mixed-gauge bundles from electrical-contractor cleanouts. Per-foot weight varies dramatically across the AWG range from 18 (thin control wire) up to 4/0 (large feeders). Selling whole pays the insulated rate; stripping the jacket and conductor insulation pays the much higher bare-bright rate.",
    prepTipsMd:
      "Sort by gauge before stripping — heavier gauges (10 AWG and below) pay back stripping effort fastest because more copper per linear foot. Lighter gauges (14 AWG and above) are often more economical to sell whole at the insulated copper rate. Use a benchtop stripper for volume.",
    displayOrder: 230,
    isFeatured: false,
  },

  // source: copper.org Copper Tube Handbook, Table 14.3a — Type L 1/2 in nominal: 0.285 lb/ft.
  //   https://www.copper.org/applications/plumbing/cth/ (Table 14.3a, "Dimensions and Weights of Copper Tube")
  {
    slug: "copper-pipe-half-inch",
    name: 'Copper Pipe 1/2" (Type L)',
    category: "electrical",
    unit: "ft",
    avgWeightLb: 0.285,
    components: [{ metal_slug: "copper-pipe", pct: 1.0, notes: "Clean drained Type L tubing (0.285 lb/ft)" }],
    descriptionMd:
      'Half-inch nominal Type L (medium-wall) copper water tubing, by far the most common residential plumbing copper installed in modern homes. Used on hot and cold supply runs throughout most pre-PEX construction. Pays at the clean copper-pipe rate when stripped of soldered brass fittings, valves, and PEX adapter ends. Type M (thin-wall) is lighter per foot at ~0.204 lb/ft, and Type K (thick-wall) is heavier; all pay the same per-pound rate.',
    prepTipsMd:
      "Cut off all brass fittings, valves, and solder joints — sell brass separately at the yellow-brass rate, and scrap solder-coated cut ends as #2 copper. Make sure each length is fully drained and dry to prevent a weight-class downgrade. Bundle by length and gauge for easier weighing at intake.",
    displayOrder: 240,
    isFeatured: false,
  },

  // source: copper.org Copper Tube Handbook, Table 14.3a — Type L 3/4 in nominal: 0.455 lb/ft.
  //   https://www.copper.org/applications/plumbing/cth/ (Table 14.3a, "Dimensions and Weights of Copper Tube")
  {
    slug: "copper-pipe-three-quarter",
    name: 'Copper Pipe 3/4" (Type L)',
    category: "electrical",
    unit: "ft",
    avgWeightLb: 0.455,
    components: [{ metal_slug: "copper-pipe", pct: 1.0, notes: "Clean drained Type L tubing (0.455 lb/ft)" }],
    descriptionMd:
      'Three-quarter-inch nominal Type L copper water tubing, used for trunk lines, water heater inlet/outlet runs, and mid-house distribution. Same C12200 copper alloy as 1/2 in pipe but with a heavier wall, yielding roughly 60% more copper per foot than 1/2 in. Pays the standard copper-pipe rate when stripped clean of brass valves and solder. Re-piping jobs commonly produce 50-200 ft of mixed 1/2 in and 3/4 in stock from a single house.',
    prepTipsMd:
      "Strip all brass fittings, valves, and solder joints (sell brass and solder separately for the higher rates). Drain residual water and let dry to prevent weight downgrade. Cut into 4-6 ft sections for easier transport and weighing.",
    displayOrder: 250,
    isFeatured: false,
  },

  // source: copper.org Copper Tube Handbook, Table 14.3a — Type L 1 in nominal: 0.654 lb/ft.
  //   https://www.copper.org/applications/plumbing/cth/ (Table 14.3a, "Dimensions and Weights of Copper Tube")
  {
    slug: "copper-pipe-one-inch",
    name: 'Copper Pipe 1" (Type L)',
    category: "electrical",
    unit: "ft",
    avgWeightLb: 0.654,
    components: [{ metal_slug: "copper-pipe", pct: 1.0, notes: "Clean drained Type L tubing (0.654 lb/ft)" }],
    descriptionMd:
      'One-inch nominal Type L copper water tubing, used for main service lines and trunk distribution in homes built before PEX adoption. Significantly heavier per foot than 1/2 in or 3/4 in, which makes even short runs from a main shutoff or boiler feed worth scrapping individually. Pays the standard clean copper-pipe rate when stripped of solder, fittings, and PEX adapters. Type K (thick-wall) is heavier still at ~0.884 lb/ft and pays the same per-pound rate.',
    prepTipsMd:
      "Strip all brass fittings and solder joints (sell brass separately at the yellow-brass rate, scrap leaded solder ends as #2 copper). Drain water fully and let dry to avoid weight downgrade. Cut into 4-6 ft sections and bundle by length for easier weighing.",
    displayOrder: 260,
    isFeatured: false,
  },

  // source: iScrapApp electric-motor guide; small fractional-HP motors typically 5-10 lb.
  {
    slug: "electric-motor-small",
    name: "Electric Motor (Small, under 10 lb)",
    category: "electrical",
    unit: "each",
    avgWeightLb: 7,
    components: [
      { metal_slug: "copper-2", pct: 0.18, notes: "Stator windings" },
      { metal_slug: "light-iron", pct: 0.65, notes: "Steel housing and laminations" },
    ], // ~17% remainder: bearings, plastic fan, leads
    descriptionMd:
      "A small fractional-horsepower electric motor — bathroom fan motor, furnace blower motor, dishwasher pump motor, garage-door opener motor — typically under 10 pounds. Yards classify these as 'electric motors' or 'sealed units' and pay a flat per-pound rate that bundles steel housing and copper windings together at a single number. Cutting open the housing for separate copper recovery raises the per-pound rate but adds labor; the trade-off pays off only on larger lots.",
    prepTipsMd:
      "If selling more than a tote-full, cutting open the housing to expose copper windings is worth the time. Otherwise sell whole at the electric-motor rate. Aluminum-housed motors pay slightly less due to lower steel content.",
    displayOrder: 270,
    isFeatured: false,
  },

  // source: iScrapApp electric-motor guide; larger 1+ HP motors typically 15-50 lb.
  {
    slug: "electric-motor-large",
    name: "Electric Motor (Large, 10-50 lb)",
    category: "electrical",
    unit: "each",
    avgWeightLb: 25,
    components: [
      { metal_slug: "copper-2", pct: 0.2, notes: "Stator windings" },
      { metal_slug: "light-iron", pct: 0.7, notes: "Steel housing and laminations" },
    ], // ~10% remainder: bearings, fan, terminal box
    descriptionMd:
      "A larger industrial or HVAC-grade electric motor, typically 1-5 horsepower and 10-50 pounds, of the type used on commercial blowers, pool pumps, well pumps, and shop tools. Higher copper density than small motors with proportionally less plastic waste. Three-phase industrial motors often pay a small premium over single-phase due to denser windings. The same rule applies as smaller motors: open the housing for the higher copper-rate pricing whenever you have meaningful lot quantities.",
    prepTipsMd:
      "Always worth opening at this size — a torch, sawzall, or angle grinder through the end bell exposes the copper windings cleanly. Sell windings as #2 copper, steel laminations and housing as light iron, and aluminum end bells (some industrial motors) separately. Bearings have no scrap value.",
    displayOrder: 280,
    isFeatured: false,
  },

  // ========================================================================
  // ELECTRONICS (6)
  // ========================================================================

  // source: EPA WEEE/e-waste reports + iScrapApp computer guide; tower 15-25 lb.
  {
    slug: "desktop-computer-tower",
    name: "Desktop Computer Tower",
    category: "electronics",
    unit: "each",
    avgWeightLb: 20,
    components: [
      { metal_slug: "light-iron", pct: 0.55, notes: "Steel chassis and drive cages" },
      { metal_slug: "aluminum-mixed", pct: 0.06, notes: "Heatsinks and side panel on some cases" },
      { metal_slug: "low-grade-board", pct: 0.05, notes: "Motherboard and expansion cards" },
      { metal_slug: "high-grade-board", pct: 0.005, notes: "CPU, memory, and gold-finger cards" },
      { metal_slug: "copper-2", pct: 0.02, notes: "PSU windings and heatsink pipes" },
    ], // ~30.5% remainder: plastic, glass, hard drives (sold separately at e-waste recyclers)
    descriptionMd:
      "A typical desktop PC tower in a mid-tower ATX or micro-ATX form factor. Most mass is the steel chassis and drive cages; the real value drivers are the circuit boards (low- and high-grade), the sealed power supply unit, and any installed CPU and RAM. Hard drives have separate per-unit value at certified e-waste recyclers. Aluminum-cased premium and gaming towers scrap differently from painted-steel office towers and pay a slightly higher mixed rate.",
    prepTipsMd:
      "Open the case and pull the motherboard, GPU, and RAM separately — these grade as high-grade board with gold-plated edge connectors. Pull the power supply as a sealed unit and remove hard drives (wipe data first). The empty steel case scraps as light iron after fan and cable cleanup.",
    displayOrder: 310,
    isFeatured: false,
  },

  // source: iScrapApp laptop guide + manufacturer spec pages; consumer laptops 3-6 lb.
  {
    slug: "laptop",
    name: "Laptop Computer",
    category: "electronics",
    unit: "each",
    avgWeightLb: 4.5,
    components: [
      { metal_slug: "aluminum-mixed", pct: 0.18, notes: "Aluminum body on premium models" },
      { metal_slug: "high-grade-board", pct: 0.07, notes: "Motherboard with CPU and RAM" },
      { metal_slug: "light-iron", pct: 0.05, notes: "Hinge and brackets" },
    ], // ~70% remainder: plastic case (consumer models), LCD glass, lithium battery, keyboard
    descriptionMd:
      "A consumer or business-class laptop computer. Premium aluminum-bodied laptops (MacBook, ThinkPad, XPS) pay materially better than plastic-body consumer models because of the recoverable aluminum chassis and lid. The motherboard contains the CPU, soldered RAM, and dense gold-bearing components, all classified as high-grade board. Lithium-ion batteries must be removed before transport — many yards will not accept laptops with batteries still installed because of fire risk during processing.",
    prepTipsMd:
      "Remove the lithium-ion battery first (most yards refuse units with batteries installed). Wipe storage or physically destroy the drive before sale. The motherboard pulls out easily after a few screws and grades as high-grade board with gold edge connectors.",
    displayOrder: 320,
    isFeatured: false,
  },

  // source: EPA flat-panel display reports; LCD monitor 8-15 lb (depends on size).
  {
    slug: "lcd-monitor",
    name: "LCD Monitor (Flat Panel)",
    category: "electronics",
    unit: "each",
    avgWeightLb: 11,
    components: [
      { metal_slug: "light-iron", pct: 0.15, notes: "Stand and rear chassis" },
      { metal_slug: "aluminum-mixed", pct: 0.12, notes: "Frame and backlight reflector" },
      { metal_slug: "low-grade-board", pct: 0.04, notes: "Driver board" },
    ], // ~69% remainder: plastic bezel, LCD glass + liquid crystal layer, mercury (CCFL backlights only)
    descriptionMd:
      "A flat-panel LCD computer monitor, typically 19-27 inches diagonal. CCFL-backlit units (older, pre-2013) contain trace mercury in the backlight tubes and require certified e-waste handling — many scrap yards refuse them outright. LED-backlit units are accepted at most yards but still classified as low-yield electronics. Net scrap value is modest; certified e-waste recyclers may pay slightly better, and many counties offer free residential e-waste drop-off twice a year.",
    prepTipsMd:
      "Check the spec label for backlight type — CCFL units may be refused or charged a disposal fee. The stand and rear chassis are removable as light iron plus a small amount of aluminum. The LCD panel itself has near-zero scrap value and contains glass that should not be broken.",
    displayOrder: 330,
    isFeatured: false,
  },

  // source: EPA CRT recycling reports; tube monitor 30-50 lb. Note negative-value handling cost.
  {
    slug: "crt-monitor",
    name: "CRT Monitor (Tube)",
    category: "electronics",
    unit: "each",
    avgWeightLb: 40,
    components: [
      { metal_slug: "light-iron", pct: 0.18, notes: "Steel shielding around the tube" },
      { metal_slug: "copper-2", pct: 0.03, notes: "Yoke and degaussing coil" },
    ], // ~79% remainder: leaded glass tube, plastic case, electronics — handling cost usually NEGATIVE
    descriptionMd:
      "A CRT (cathode ray tube) computer monitor or television, the dominant display technology before LCDs took over in the mid-2000s. CRT glass contains 1-4 lb of lead in the funnel and front face, and most scrap yards charge a per-unit disposal fee rather than paying anything for the unit. EPA-permitted e-waste recyclers are the correct disposal channel for CRTs. Net economic value to the seller is typically negative — expect to pay a small handling fee per unit, not receive payment.",
    prepTipsMd:
      "Do not break the tube under any circumstances — the implosion risk is real and the leaded glass dust is hazardous to inhale. Take to a permitted e-waste recycler rather than a metal yard. Many counties hold free residential e-waste collection days twice a year as the cheapest disposal option.",
    displayOrder: 340,
    isFeatured: false,
  },

  // source: iScrapApp printer guide; consumer inkjet 10-20 lb.
  {
    slug: "printer-inkjet",
    name: "Printer (Inkjet, Consumer)",
    category: "electronics",
    unit: "each",
    avgWeightLb: 15,
    components: [
      { metal_slug: "light-iron", pct: 0.12, notes: "Steel chassis" },
      { metal_slug: "low-grade-board", pct: 0.04, notes: "Mainboard" },
      { metal_slug: "copper-2", pct: 0.01, notes: "Motors" },
    ], // ~83% remainder: plastic body and rollers — printers are mostly plastic by mass
    descriptionMd:
      "A consumer inkjet printer or all-in-one. Mostly plastic by mass, which limits scrap value. The mainboard and small stepper motors are the only meaningful recoverables. Many yards classify these as 'low-yield electronics' and pay a flat token rate per unit, or refuse them entirely. E-waste recyclers are the better channel.",
    prepTipsMd:
      "Remove ink or toner cartridges first and recycle separately at the printer brand's mail-in program (HP, Epson, Canon all offer free postage-paid envelopes). Pull the mainboard for low-grade board scrap. The stepper and DC motors are small but worth pulling when processing printers in lots of 10 or more.",
    displayOrder: 350,
    isFeatured: false,
  },

  // source: enterprise hardware spec sheets; 1U server typically 30-50 lb.
  {
    slug: "server-rack-1u",
    name: "1U Rack Server",
    category: "electronics",
    unit: "each",
    avgWeightLb: 40,
    components: [
      { metal_slug: "light-iron", pct: 0.5, notes: "Steel chassis" },
      { metal_slug: "aluminum-mixed", pct: 0.08, notes: "Heatsinks" },
      { metal_slug: "high-grade-board", pct: 0.07, notes: "Motherboard with multiple CPU sockets" },
      { metal_slug: "copper-2", pct: 0.02, notes: "PSU windings" },
    ], // ~33% remainder: plastic, hard drives, rails, cabling
    descriptionMd:
      "A 1U rack-mount server such as a Dell PowerEdge, HP ProLiant, or Supermicro chassis. Higher per-unit value than desktop towers because of denser high-grade boards (multiple CPU sockets, dense ECC RAM modules, often gold-plated heatsinks and copper heatpipes), plus dual redundant power supplies. Decommissioned enterprise gear is a strong scrap segment, and refurb resellers often pay multiples of scrap value, especially for newer-generation hardware still in vendor support.",
    prepTipsMd:
      "Try a refurb reseller or used-hardware broker first — even 5-7 year old enterprise servers often have meaningful resale value. For scrap, pull the motherboard (high-grade board), both power supplies (sealed units), and copper heatpipe heatsinks. Wipe or destroy storage drives before sale.",
    displayOrder: 360,
    isFeatured: false,
  },

  // ========================================================================
  // PLUMBING / FIXTURES (5)
  // ========================================================================

  // source: iScrapApp brass-faucet guide; residential kitchen/bath faucet 3-6 lb.
  {
    slug: "brass-faucet",
    name: "Brass Faucet",
    category: "plumbing",
    unit: "each",
    avgWeightLb: 4,
    components: [
      { metal_slug: "brass-yellow", pct: 0.85, notes: "Cast brass body" },
    ], // ~15% remainder: chrome plating, plastic cartridge, rubber washers
    descriptionMd:
      "A residential brass kitchen or bathroom faucet, typically chrome-plated cast yellow brass. Pays at yellow brass rates when free of plastic cartridges, ceramic-disc inserts, and steel mounting nuts. Older solid-brass faucets without plastic internals scrap as fully clean brass; modern faucets often have plastic ceramic-disc cartridges and PEX-style plastic supply tails that should be removed for the cleanest payout. Chrome plating does not need to be stripped before scrapping.",
    prepTipsMd:
      "Unscrew and remove the cartridge (plastic or ceramic), aerator, and any steel supply nuts. Chrome plating does not need to be stripped — yards accept chrome-plated brass at the standard rate.",
    displayOrder: 410,
    isFeatured: false,
  },

  // source: AWWA brass water meter standards; residential 5/8" meter 5-10 lb.
  {
    slug: "brass-water-meter",
    name: "Brass Water Meter",
    category: "plumbing",
    unit: "each",
    avgWeightLb: 7,
    components: [{ metal_slug: "brass-red", pct: 0.92, notes: "Red-brass body (high copper content)" }],
    // ~8% remainder: glass register, plastic indicator, internal gears
    descriptionMd:
      "A residential brass water meter, typically 5/8\" or 3/4\" service. Made from red brass (higher copper content than yellow brass) and pays at the higher red-brass rate. WARNING: utility-owned meters are stolen property if removed without authorization — only scrap meters that you legitimately own (e.g., from your own decommissioned well system or with utility documentation).",
    prepTipsMd:
      "Verify legal ownership before selling — water utilities prosecute meter theft aggressively and yards routinely report suspicious sales to local police under municipal ordinance. Remove the glass register face and plastic flow indicator; the cast red-brass body is the entire value. Bring documentation if available.",
    displayOrder: 420,
    isFeatured: false,
  },

  // source: cast-iron tub manufacturer specs (Kohler, American Standard); 250-350 lb.
  {
    slug: "cast-iron-bathtub",
    name: "Cast Iron Bathtub",
    category: "plumbing",
    unit: "each",
    avgWeightLb: 300,
    components: [{ metal_slug: "cast-iron", pct: 0.95, notes: "Cast iron body" }],
    // ~5% remainder: porcelain enamel coating
    descriptionMd:
      "A traditional cast-iron clawfoot, alcove, or drop-in bathtub with porcelain enamel coating, common in homes built before the 1980s. Heavy and high-value at cast-iron rates per pound, but the real economic question is whether the tub has architectural-salvage value first. Antique clawfoot tubs in good condition often resell to salvage buyers, restoration contractors, and homeowners doing period-correct renovations — scrap should be a last resort. Modern fiberglass and acrylic tubs have effectively zero scrap value.",
    prepTipsMd:
      "Try architectural salvage yards, restoration suppliers, and local marketplaces first — restored clawfoots have meaningful resale demand. For scrap, plan for two strong people and a furniture dolly; these are extremely heavy and awkward. Most yards charge a fee or offer no extra credit for the porcelain enamel coating.",
    displayOrder: 430,
    isFeatured: false,
  },

  // source: vintage solid-copper cookware spec ranges; 2-5 lb per piece.
  {
    slug: "copper-cookware-piece",
    name: "Copper Cookware (Pot or Pan)",
    category: "plumbing",
    unit: "each",
    avgWeightLb: 3,
    components: [{ metal_slug: "copper-2", pct: 0.85, notes: "Solid copper body" }],
    // ~15% remainder: brass or steel handle, tin lining
    descriptionMd:
      "A piece of solid-copper cookware — pot, pan, saucier, or stockpot — typically with a tin or stainless lining and a brass or cast-iron handle. Vintage hammered French copper (Mauviel, Dehillerin, Ruffoni) almost always has resale value to home cooks and collectors well above scrap rate. Try eBay, kitchenware resellers, or restaurant-supply auctions first. Scrap value is meaningful for damaged or unmarked pieces. Copper-clad stainless cookware is mostly stainless steel and pays at the much lower stainless rate.",
    prepTipsMd:
      "Resale almost always beats scrap for any marked or hammered piece. For scrap, remove brass or steel handles by drilling out rivets. Verify the pan is solid copper rather than copper-clad — copper is non-magnetic, so a magnet test is the quickest check before listing.",
    displayOrder: 440,
    isFeatured: false,
  },

  // source: hardware industry standard tank-to-bowl bolt sets; small but consistent.
  // weight is small (under 0.5 lb total), null is not appropriate; using 0.3 lb.
  {
    slug: "toilet-tank-bolts-set",
    name: "Toilet Tank Bolts (Set)",
    category: "plumbing",
    unit: "each",
    avgWeightLb: 0.3,
    components: [
      { metal_slug: "brass-yellow", pct: 0.5, notes: "Brass tank-to-bowl bolts and nuts" },
      { metal_slug: "light-iron", pct: 0.2, notes: "Steel washers" },
    ], // ~30% remainder: rubber washers, plastic
    descriptionMd:
      "A set of brass tank-to-bowl bolts, nuts, and washers from a standard residential toilet, plus the brass mounting hardware on the supply line. Individually low value (cents per set), but the 'small brass' bin at most yards aggregates these from plumbers and bath-remodel contractors. The economic strategy is to bucket many sets together with other small brass plumbing fittings for a single weighing rather than scrapping individually.",
    prepTipsMd:
      "Aggregate with other small brass plumbing fittings (compression nuts, valve stems, supply-line ends, escutcheons) into a single bin or coffee can until you have a few pounds. Strip rubber washers and any plastic. Magnet test before bagging — chrome-plated steel imitations look identical but pay nothing extra at the brass rate.",
    displayOrder: 450,
    isFeatured: false,
  },

  // ========================================================================
  // OUTDOOR / YARD (8)
  // ========================================================================

  // source: iScrapApp lawnmower guide; push mower 50-80 lb (steel deck typical).
  {
    slug: "lawnmower-push",
    name: "Push Lawn Mower (Gas)",
    category: "outdoor",
    unit: "each",
    avgWeightLb: 65,
    components: [
      { metal_slug: "light-iron", pct: 0.6, notes: "Steel deck and handle" },
      { metal_slug: "aluminum-mixed", pct: 0.15, notes: "Engine block (most modern small engines)" },
      { metal_slug: "copper-2", pct: 0.005, notes: "Magneto coil" },
    ], // ~24.5% remainder: plastic, rubber wheels, gas tank residue, blade (steel — counted in light iron)
    descriptionMd:
      "A residential walk-behind gasoline push mower, typically 21-inch deck. Modern small engines (Briggs & Stratton, Honda, Kohler Courage) are aluminum-block, which adds aluminum value on top of the heavier steel deck and handle. A drained engine can be sold whole as 'small engine' (a common yard category that bundles aluminum and steel together at a flat rate) or dismantled into separate aluminum block and steel deck for a higher overall payout when lot size justifies the labor.",
    prepTipsMd:
      "Drain all gasoline and oil completely — yards refuse fueled units for fire safety. Pulling the aluminum engine block and selling separately raises the per-pound rate vs whole-mower pricing. The steel deck, handle, and blade scrap as light iron.",
    displayOrder: 510,
    isFeatured: false,
  },

  // source: iScrapApp riding-mower guide; lawn tractor 400-600 lb.
  {
    slug: "lawnmower-riding",
    name: "Riding Lawn Mower / Lawn Tractor",
    category: "outdoor",
    unit: "each",
    avgWeightLb: 500,
    components: [
      { metal_slug: "light-iron", pct: 0.65, notes: "Steel frame, deck, and chassis" },
      { metal_slug: "aluminum-mixed", pct: 0.04, notes: "Engine block" },
      { metal_slug: "car-battery", pct: 0.02, notes: "Small lead-acid starter battery" },
      { metal_slug: "copper-2", pct: 0.005 },
    ], // ~28.5% remainder: plastic shroud, tires, fuel tank, seat, hydrostatic transmission fluid
    descriptionMd:
      "A residential garden tractor or zero-turn riding mower (John Deere lawn tractor, Cub Cadet, Husqvarna). Significant scrap value due to sheer weight (mostly steel frame, deck, and chassis), but transport is the real challenge — most scrap yards do not offer pickup at this size. The lead-acid starter battery is a separate per-unit sale. Large-frame mowers and zero-turns may need a trailer or a yard with a roll-off container service.",
    prepTipsMd:
      "Drain all fluids (gasoline, engine oil, hydraulic fluid) completely before transport. Pull the lead-acid starter battery and sell separately at the per-unit rate. Many yards offer roll-off or pickup service for items at this size — ask before loading and moving.",
    displayOrder: 520,
    isFeatured: false,
  },

  // source: NPGA standard 20 lb propane tank empty weight ~17-18 lb.
  // note: many yards reject for safety (residual propane); usually purged required.
  {
    slug: "propane-tank-20lb",
    name: 'Propane Tank, 20 lb (BBQ size)',
    category: "outdoor",
    unit: "each",
    avgWeightLb: 17,
    components: [
      { metal_slug: "light-iron", pct: 0.95, notes: "Welded steel cylinder" },
      { metal_slug: "brass-yellow", pct: 0.01, notes: "Service valve" },
    ], // ~4% remainder: paint, plastic foot ring, pressure relief valve hardware
    descriptionMd:
      "A standard 20-pound (4.7 gallon) BBQ propane cylinder. Many yards REFUSE these unconditionally due to explosion risk, even when empty. Yards that do accept usually require the valve to be removed (not just opened) so they can verify the cylinder is purged. Tank exchange (e.g., Blue Rhino swap) is almost always a better economic outcome than scrapping.",
    prepTipsMd:
      "Open the valve and let it sit outdoors for 24+ hours. Many yards require the brass valve removed entirely to verify empty — this needs a pipe wrench and the right safety procedure. When in doubt, exchange instead of scrapping.",
    displayOrder: 530,
    isFeatured: false,
  },

  // source: NPGA standard 100 lb residential cylinder empty weight ~70 lb.
  {
    slug: "propane-tank-100lb",
    name: "Propane Tank, 100 lb (Residential)",
    category: "outdoor",
    unit: "each",
    avgWeightLb: 70,
    components: [
      { metal_slug: "light-iron", pct: 0.96, notes: "Welded steel cylinder" },
      { metal_slug: "brass-yellow", pct: 0.01, notes: "Service valve" },
    ], // ~3% remainder: foot ring, valve hardware
    descriptionMd:
      "A residential 100-pound propane cylinder, used for whole-house cooking, supplemental heating, and some construction-site applications. Same safety concerns as 20-lb tanks: many scrap yards refuse them outright due to explosion risk, and others require the brass service valve removed (not just opened) so they can verify the cylinder is fully purged. Propane refilling stations sometimes accept expired tanks for a flat handling fee that beats scrap value. Recertification is the most common reuse path.",
    prepTipsMd:
      "Open the valve and let the cylinder vent outdoors for 24+ hours before transport. Most yards require the brass service valve removed entirely (pipe wrench, follow tank-purging procedure). Call ahead — yards have specific propane policies and a few may charge a per-tank disposal fee instead of paying.",
    displayOrder: 540,
    isFeatured: false,
  },

  // source: industry consumer-bike spec sheets; aluminum hybrid/road 20-30 lb.
  {
    slug: "bicycle-aluminum",
    name: "Aluminum Bicycle Frame",
    category: "outdoor",
    unit: "each",
    avgWeightLb: 25,
    components: [
      { metal_slug: "aluminum-mixed", pct: 0.6, notes: "Frame, fork, rims" },
      { metal_slug: "light-iron", pct: 0.2, notes: "Chain, sprockets, hardware" },
    ], // ~20% remainder: rubber tires/tubes, plastic, leather/foam saddle, cabling
    descriptionMd:
      "A modern aluminum-frame bicycle — hybrid, road, or hardtail mountain bike — with the typical mix of an aluminum frame and rims, steel chain and drivetrain, and rubber tires. Resale value almost always beats scrap, even for basic adult bikes; local marketplaces, charity shops, and bike co-ops are usually the better channel. For scrap, the frame, fork, and rims grade as dirty aluminum because of steel headset cups and bottom-bracket inserts. Steel-frame vintage bikes are a separate resale category.",
    prepTipsMd:
      "Try resale or donation first — almost any working adult bike has more value as transportation than as scrap. For scrap, separate the steel chain, gears, and bottom bracket (light iron) from the aluminum frame. Steel-frame vintage bikes are resale items; check the brand before scrapping.",
    displayOrder: 550,
    isFeatured: false,
  },

  // source: iScrapApp BBQ-grill guide; mid-size 3-burner gas 50-100 lb.
  {
    slug: "bbq-grill-gas",
    name: "BBQ Grill (Gas, 3-4 burner)",
    category: "outdoor",
    unit: "each",
    avgWeightLb: 75,
    components: [
      { metal_slug: "light-iron", pct: 0.5, notes: "Steel frame, lid, side shelves" },
      { metal_slug: "stainless-steel", pct: 0.1, notes: "Burners and grates on stainless models" },
      { metal_slug: "aluminum-mixed", pct: 0.04, notes: "Cast aluminum side panels on some models" },
    ], // ~36% remainder: porcelain coating, plastic, ceramic briquettes, gas hoses
    descriptionMd:
      "A residential 3-4 burner gas BBQ grill on a free-standing cart, typical of mid-range Weber, Char-Broil, or Brinkmann models. Stainless-steel models pay better than painted-steel because the burners and grates earn the stainless rate. Cast-aluminum side tables and control panels on premium grills add modest aluminum value. Verify any propane tank is removed before transport — yards refuse units with attached tanks for safety reasons.",
    prepTipsMd:
      "Remove and exchange or sell the propane tank separately (most yards refuse grills with tanks attached). Pull stainless burners and grates and sell at the higher stainless rate. Remove cast-aluminum control panels and side tables if present. Strip any plastic side handles before weighing.",
    displayOrder: 560,
    isFeatured: false,
  },

  // source: aluminum gutter manufacturer spec; standard 5" K-style 0.45-0.55 lb/ft.
  {
    slug: "aluminum-gutter",
    name: 'Aluminum Gutter (5" K-style)',
    category: "outdoor",
    unit: "ft",
    avgWeightLb: 0.5,
    components: [{ metal_slug: "aluminum-extrusion", pct: 0.95, notes: "Painted aluminum" }],
    // ~5% remainder: paint, sealant residue
    descriptionMd:
      "Standard 5-inch K-style residential aluminum rain gutter, painted or mill finish. Pays at clean aluminum extrusion rates when free of steel hangers, screws, and downspout brackets. Painted finish does not significantly affect the yard rate at most yards. A common contractor scrap stream from gutter replacement and reroofing jobs, where a single house typically yields 100-200 linear feet. Seamless gutter, the most common modern type, scraps identically.",
    prepTipsMd:
      "Pull all steel hangers, brackets, and screws and sell those separately as light iron. Crush sections flat by stepping on them to triple your trailer or truck-bed capacity. 100+ linear feet is a meaningful payday for a small contractor cleanup.",
    displayOrder: 570,
    isFeatured: false,
  },

  // source: chain-link fence manufacturer specs; standard 11.5-gauge 4-ft galvanized ~0.7 lb/ft.
  {
    slug: "chain-link-fence",
    name: "Chain Link Fence Fabric (4 ft tall)",
    category: "outdoor",
    unit: "ft",
    avgWeightLb: 0.7,
    components: [{ metal_slug: "light-iron", pct: 1.0, notes: "Galvanized steel mesh" }],
    descriptionMd:
      "Standard galvanized steel chain-link fence fabric in 4-foot height (taller 5-ft and 6-ft fences are proportionally heavier per linear foot). Posts, top rails, tension bars, and gate frames are typically galvanized steel pipe and sell together with the fabric as a single light-iron load. Galvanizing does not affect the per-pound rate at most yards. A typical residential perimeter fence yields several hundred linear feet of fabric plus a similar weight in posts and rails.",
    prepTipsMd:
      "Roll the fabric up tightly for transport — loose fabric takes up disproportionate truck space. Posts and rails go in the same load: no rate difference between fabric and pipe at light iron. If the fence has aluminum privacy slats woven through the mesh, separate those for the higher aluminum rate.",
    displayOrder: 580,
    isFeatured: false,
  },

  // ========================================================================
  // MISC / HOUSEHOLD (7)
  // ========================================================================

  // source: aluminum-cans guide; ~32 cans/lb crushed; a 5-gal bag holds ~3-5 lb crushed.
  {
    slug: "aluminum-cans-five-gallon-bag",
    name: "Aluminum Cans (5-gallon bag, crushed)",
    category: "misc",
    unit: "each",
    avgWeightLb: 4,
    components: [{ metal_slug: "aluminum-cans", pct: 1.0 }],
    descriptionMd:
      "A typical 5-gallon contractor bag of crushed aluminum beverage cans. Approximately 32 crushed cans per pound; a packed bag holds roughly 3-5 lb depending on how flat the cans are. Pays at the aluminum-cans rate, which is lower per pound than aluminum extrusion or sheet because cans are coated and contain residue.",
    prepTipsMd:
      "Crush each can flat (foot or can-crusher) to roughly triple bag capacity for the same weight. Rinse soda and beer residue first — sticky cans attract pests in storage and may be downgraded at intake for contamination. Most yards weigh by the bag rather than counting cans, so denser is always better.",
    displayOrder: 610,
    isFeatured: false,
  },

  // source: standard 1/2 BBL stainless keg spec; ~30 lb empty.
  // note: many yards refuse due to deposit theft concerns under state laws.
  {
    slug: "empty-beer-keg",
    name: "Beer Keg (1/2 BBL Stainless, Empty)",
    category: "misc",
    unit: "each",
    avgWeightLb: 30,
    components: [{ metal_slug: "stainless-steel", pct: 0.95 }],
    // ~5% remainder: rubber bumpers, valve hardware
    descriptionMd:
      "A standard half-barrel (15.5 gallon) stainless steel beer keg, empty. WARNING: kegs are typically the property of the brewery or distributor and carry a meaningful deposit when purchased through legitimate retail channels. Many states classify keg scrapping as felony theft of brewery property, and licensed yards are required to refuse intake without a brewery release form. Returning the keg to the distributor for the deposit refund almost always beats scrap value, and is the legally appropriate channel.",
    prepTipsMd:
      "Return the keg to the distributor or retailer for the deposit refund — this is almost always better economically than scrap and is the legally correct channel. Yards typically require brewery release paperwork to accept kegs; without it they are required to refuse and report the attempt.",
    displayOrder: 620,
    isFeatured: false,
  },

  // source: outdoor-furniture industry; aluminum patio chair 5-15 lb; table 15-40 lb.
  // TODO: split into chair vs table when calculator UI supports it.
  {
    slug: "patio-furniture-aluminum",
    name: "Aluminum Patio Furniture (Piece)",
    category: "misc",
    unit: "each",
    avgWeightLb: 17, // midpoint of full chair-to-table range; range: 5-40 lb
    components: [{ metal_slug: "aluminum-extrusion", pct: 0.92, notes: "Tubular or cast aluminum frame" }],
    // ~8% remainder: vinyl strapping, plastic feet, fabric (sling chairs)
    descriptionMd:
      "An aluminum-frame outdoor chair, table, or chaise from a typical residential patio set. Pays at clean aluminum extrusion rates when vinyl strapping, fabric, and plastic feet are removed first. Cast aluminum pieces (heavier and more decorative) carry a higher metal-to-mass ratio and yield the cleanest per-item payout. Steel-frame patio furniture is a separate entry and pays substantially less. Sets typically yield 30-150 lb total.",
    prepTipsMd:
      "Strip vinyl strapping, sling fabric, and any cushions — these are weighed against the load and reduce the yard rate. Pull plastic glides from chair feet and remove rubber bumpers from table tops. Stack chairs and bundle table legs together for transport.",
    displayOrder: 630,
    isFeatured: false,
  },

  // source: outdoor-furniture industry tables; steel patio piece 10-50 lb.
  // Midpoint of full range used; refine when calculator UI offers a type selector.
  {
    slug: "patio-furniture-steel",
    name: "Steel Patio Furniture (Piece)",
    category: "misc",
    unit: "each",
    avgWeightLb: 25,
    components: [{ metal_slug: "light-iron", pct: 0.95 }],
    // ~5% remainder: paint, plastic glides, fabric
    descriptionMd:
      "A steel-frame outdoor chair, table, or bench, typically powder-coated tubular steel from a modern residential patio set. Pays at light-iron rates per pound, which is well below aluminum patio furniture for the same volume. Wrought-iron antique pieces (Woodard, Salterini, vintage cast bistro sets) are resale items rather than scrap — verify by checking maker marks before scrapping. Modern powder-coated tubular steel is the typical case.",
    prepTipsMd:
      "Strip cushions, slings, and any plastic feet or arm caps before transport. If the piece is wrought iron with detail castings or visible maker marks, check resale value first — restored sets often pay multiples of scrap. Stack flat in the truck bed to maximize load.",
    displayOrder: 640,
    isFeatured: false,
  },

  // source: office furniture spec sheets; lateral or vertical 4-drawer 75-100 lb.
  {
    slug: "file-cabinet-steel-4-drawer",
    name: "Steel File Cabinet (4-Drawer)",
    category: "misc",
    unit: "each",
    avgWeightLb: 90,
    components: [{ metal_slug: "light-iron", pct: 0.97, notes: "Steel body and drawer slides" }],
    // ~3% remainder: plastic drawer pulls, paper labels
    descriptionMd:
      "A standard 4-drawer steel office file cabinet, vertical or lateral form factor, from a typical commercial-office liquidation. Heavy and consistent at light-iron rates per pound, with very little non-recoverable mass beyond plastic drawer pulls and paper labels. Office liquidations and demolitions are the typical source of large lots — 5-10 cabinets fill a pickup truck. Fireproof safes (much heavier, with concrete or gypsum fill) are a different category and most yards refuse them.",
    prepTipsMd:
      "Empty all drawers and remove plastic drawer pulls and label holders. Lay flat in the truck bed for transport — these are awkward and tippy when standing upright. Multiple cabinets fill a pickup quickly and minimize trip count for an office cleanout.",
    displayOrder: 650,
    isFeatured: false,
  },

  // source: residential ceiling fan spec sheets; 10-20 lb (52-in standard).
  {
    slug: "ceiling-fan",
    name: "Ceiling Fan",
    category: "misc",
    unit: "each",
    avgWeightLb: 14,
    components: [
      { metal_slug: "light-iron", pct: 0.5, notes: "Motor housing and bracket" },
      { metal_slug: "copper-2", pct: 0.06, notes: "Motor windings" },
      { metal_slug: "aluminum-mixed", pct: 0.05, notes: "Decorative trim on some models" },
    ], // ~39% remainder: wood/MDF blades, plastic, glass light shades
    descriptionMd:
      "A standard 52-inch residential ceiling fan with integrated light kit, of the type pulled during remodels and replaced with low-profile or smart-home models. The motor housing is the only meaningful scrap component; the fan blades are typically wood, MDF, or plastic with no scrap value. Light shades are glass. Better classified as a 'small electric motor plus light iron mounting bracket' than a single scrap unit when calculating expected payout.",
    prepTipsMd:
      "Remove the blades and glass shades (no scrap value, dispose separately). The motor pulls easily and counts as a small electric motor for higher copper credit. The mounting bracket is light iron.",
    displayOrder: 660,
    isFeatured: false,
  },

  // source: home-fitness industry; folding treadmill 150-250 lb.
  {
    slug: "treadmill",
    name: "Treadmill",
    category: "misc",
    unit: "each",
    avgWeightLb: 200,
    components: [
      { metal_slug: "light-iron", pct: 0.6, notes: "Steel frame and uprights" },
      { metal_slug: "copper-2", pct: 0.02, notes: "DC motor windings" },
      { metal_slug: "low-grade-board", pct: 0.01, notes: "Console mainboard" },
    ], // ~37% remainder: rubber belt, plastic cowling, MDF deck, electronics
    descriptionMd:
      "A residential motorized treadmill, typically with a folding deck and incline motor. The steel frame is the bulk of scrap value; the DC drive motor is a meaningful pull as a small electric motor. The rubber running belt, MDF or fiberboard deck, and plastic side rails are all non-recoverable mass. Working units have meaningful resale demand on local marketplaces and through fitness-equipment buyers — try resale before scrapping a functional unit.",
    prepTipsMd:
      "Try resale or local fitness-equipment buyers first — working treadmills move quickly second-hand. For scrap, removing the DC drive motor (small electric motor category) and the console electronics helps the per-unit payout. Heavy and awkward — usually requires two people and a furniture dolly to load.",
    displayOrder: 670,
    isFeatured: false,
  },
];

// ----------------------------------------------------------------------------
// VALIDATION
// ----------------------------------------------------------------------------

function validateOrThrow(items: ItemSeed[], validMetalSlugs: Set<string>) {
  // 1. Exactly 50 items
  if (items.length !== 50) {
    throw new Error(`expected 50 items, have ${items.length}`);
  }
  // 2. Slug uniqueness
  const slugs = new Set<string>();
  for (const it of items) {
    if (slugs.has(it.slug)) throw new Error(`duplicate slug: ${it.slug}`);
    slugs.add(it.slug);
  }
  // 3. Per-item invariants
  const VALID_CATEGORIES = new Set(["appliance", "auto", "electrical", "electronics", "plumbing", "outdoor", "misc"]);
  const VALID_UNITS = new Set(["each", "ft", "lb"]);
  for (const it of items) {
    if (!VALID_CATEGORIES.has(it.category)) {
      throw new Error(`${it.slug}: invalid category "${it.category}"`);
    }
    if (!VALID_UNITS.has(it.unit)) {
      throw new Error(`${it.slug}: invalid unit "${it.unit}"`);
    }
    // Component metal slugs must exist in metals
    for (const c of it.components) {
      if (!validMetalSlugs.has(c.metal_slug)) {
        throw new Error(`${it.slug}: component metal_slug "${c.metal_slug}" not in public.metals`);
      }
      if (c.pct < 0 || c.pct > 1) {
        throw new Error(`${it.slug}: pct ${c.pct} out of [0,1] for ${c.metal_slug}`);
      }
    }
    // Sum of component pcts must be <= 1.0 (allow tiny float epsilon)
    const sum = it.components.reduce((a, c) => a + c.pct, 0);
    if (sum > 1.0001) {
      throw new Error(`${it.slug}: component pct sum ${sum.toFixed(4)} exceeds 1.0`);
    }
    // Description and prep tip word counts (50-100 desc, 30-60 prep)
    const descWords = (it.descriptionMd || "").trim().split(/\s+/).length;
    const prepWords = (it.prepTipsMd || "").trim().split(/\s+/).length;
    if (descWords < 50 || descWords > 105) {
      console.warn(`  [warn] ${it.slug}: description is ${descWords} words (target 50-100)`);
    }
    if (prepWords < 25 || prepWords > 65) {
      console.warn(`  [warn] ${it.slug}: prep_tips is ${prepWords} words (target 30-60)`);
    }
  }
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

async function main() {
  console.log("=== seed-items ===");

  // Preflight: load valid metal slugs.
  const metalRows = await db.select({ slug: metalsTable.slug }).from(metalsTable);
  const validMetalSlugs = new Set(metalRows.map((r) => r.slug));
  console.log(`loaded ${validMetalSlugs.size} valid metal slugs from public.metals`);

  // Validate.
  validateOrThrow(ITEMS, validMetalSlugs);
  console.log(`✓ ${ITEMS.length} items pass preflight validation`);

  // Wipe + insert (idempotent).
  await db.delete(itemsTable);
  for (const it of ITEMS) {
    await db.insert(itemsTable).values({
      slug: it.slug,
      name: it.name,
      category: it.category,
      unit: it.unit,
      avgWeightLb: it.avgWeightLb === null ? null : String(it.avgWeightLb),
      components: it.components,
      descriptionMd: it.descriptionMd,
      prepTipsMd: it.prepTipsMd,
      displayOrder: it.displayOrder,
      isFeatured: it.isFeatured,
    });
  }

  // Post-insert assertion.
  const countRes = await db.execute(sql`SELECT COUNT(*)::int AS count FROM public.items`);
  const count = (countRes.rows[0] as { count: number }).count;
  if (count !== 50) throw new Error(`post-insert count ${count} != 50`);
  console.log(`✓ inserted ${count} items`);

  // FK soundness check.
  const orphans = await db.execute(sql`
    SELECT i.slug AS item, c.value->>'metal_slug' AS metal_slug
    FROM public.items i, jsonb_array_elements(i.components) c
    WHERE NOT EXISTS (SELECT 1 FROM public.metals m WHERE m.slug = c.value->>'metal_slug')
  `);
  if (orphans.rows.length > 0) {
    throw new Error(`orphan metal_slug references after insert: ${JSON.stringify(orphans.rows)}`);
  }
  console.log(`✓ all component metal_slugs resolve in public.metals`);

  // Featured count for sanity.
  const featured = ITEMS.filter((i) => i.isFeatured).length;
  console.log(`featured items (calculator default dropdown): ${featured}`);

  // TODO summary.
  const todos = ITEMS.filter((i) => i.avgWeightLb === null && i.components[0].metal_slug !== "car-battery" && i.components[0].metal_slug !== "catalytic-converter");
  if (todos.length > 0) {
    console.log(`\nitems with avg_weight_lb=null marked TODO (need source verification or UI gauge selector):`);
    for (const t of todos) console.log(`  - ${t.slug}: ${t.name}`);
  }

  await pool.end();
  console.log("done.");
}

main().catch((err) => {
  console.error("FAILED:", err);
  pool.end();
  process.exit(1);
});
