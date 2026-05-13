import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../lib/db/src/schema/index.js";
import {
  statesTable, citiesTable, yardsTable, metalsTable, metalPricesTable,
  metalCategoriesTable, legacyRedirectsTable,
} from "../../lib/db/src/schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const STATES = [
  { code: "PA", slug: "pennsylvania", name: "Pennsylvania", fips: "42", lat: "41.2033", lng: "-77.1945" },
  { code: "TX", slug: "texas", name: "Texas", fips: "48", lat: "31.9686", lng: "-99.9018" },
  { code: "CA", slug: "california", name: "California", fips: "06", lat: "36.7783", lng: "-119.4179" },
  { code: "FL", slug: "florida", name: "Florida", fips: "12", lat: "27.9944", lng: "-81.7603" },
  { code: "OH", slug: "ohio", name: "Ohio", fips: "39", lat: "40.4173", lng: "-82.9071" },
  { code: "MI", slug: "michigan", name: "Michigan", fips: "26", lat: "44.3148", lng: "-85.6024" },
  { code: "NY", slug: "new-york", name: "New York", fips: "36", lat: "42.1657", lng: "-74.9481" },
  { code: "IL", slug: "illinois", name: "Illinois", fips: "17", lat: "40.3495", lng: "-88.9861" },
  { code: "GA", slug: "georgia", name: "Georgia", fips: "13", lat: "33.0406", lng: "-83.6431" },
  { code: "NC", slug: "north-carolina", name: "North Carolina", fips: "37", lat: "35.6301", lng: "-79.8064" },
  { code: "AZ", slug: "arizona", name: "Arizona", fips: "04", lat: "34.0489", lng: "-111.0937" },
  { code: "TN", slug: "tennessee", name: "Tennessee", fips: "47", lat: "35.7478", lng: "-86.6923" },
  { code: "MO", slug: "missouri", name: "Missouri", fips: "29", lat: "38.4561", lng: "-92.2884" },
  { code: "IN", slug: "indiana", name: "Indiana", fips: "18", lat: "40.2672", lng: "-86.1349" },
  { code: "WI", slug: "wisconsin", name: "Wisconsin", fips: "55", lat: "43.7844", lng: "-88.7879" },
  { code: "MN", slug: "minnesota", name: "Minnesota", fips: "27", lat: "46.7296", lng: "-94.6859" },
  { code: "CO", slug: "colorado", name: "Colorado", fips: "08", lat: "39.5501", lng: "-105.7821" },
  { code: "WA", slug: "washington", name: "Washington", fips: "53", lat: "47.7511", lng: "-120.7401" },
  { code: "OR", slug: "oregon", name: "Oregon", fips: "41", lat: "43.8041", lng: "-120.5542" },
  { code: "NV", slug: "nevada", name: "Nevada", fips: "32", lat: "38.8026", lng: "-116.4194" },
  { code: "AL", slug: "alabama", name: "Alabama", fips: "01", lat: "32.3182", lng: "-86.9023" },
  { code: "AR", slug: "arkansas", name: "Arkansas", fips: "05", lat: "34.9697", lng: "-92.3731" },
  { code: "CT", slug: "connecticut", name: "Connecticut", fips: "09", lat: "41.6032", lng: "-73.0877" },
  { code: "DE", slug: "delaware", name: "Delaware", fips: "10", lat: "38.9108", lng: "-75.5277" },
  { code: "HI", slug: "hawaii", name: "Hawaii", fips: "15", lat: "19.8968", lng: "-155.5828" },
  { code: "ID", slug: "idaho", name: "Idaho", fips: "16", lat: "44.0682", lng: "-114.7420" },
  { code: "IA", slug: "iowa", name: "Iowa", fips: "19", lat: "42.0115", lng: "-93.2105" },
  { code: "KS", slug: "kansas", name: "Kansas", fips: "20", lat: "38.5266", lng: "-96.7265" },
  { code: "KY", slug: "kentucky", name: "Kentucky", fips: "21", lat: "37.6681", lng: "-84.6701" },
  { code: "LA", slug: "louisiana", name: "Louisiana", fips: "22", lat: "31.1695", lng: "-91.8678" },
  { code: "ME", slug: "maine", name: "Maine", fips: "23", lat: "44.6939", lng: "-69.3819" },
  { code: "MD", slug: "maryland", name: "Maryland", fips: "24", lat: "39.0639", lng: "-76.8021" },
  { code: "MA", slug: "massachusetts", name: "Massachusetts", fips: "25", lat: "42.2302", lng: "-71.5301" },
  { code: "MS", slug: "mississippi", name: "Mississippi", fips: "28", lat: "32.7416", lng: "-89.6787" },
  { code: "MT", slug: "montana", name: "Montana", fips: "30", lat: "46.8797", lng: "-110.3626" },
  { code: "NE", slug: "nebraska", name: "Nebraska", fips: "31", lat: "41.4925", lng: "-99.9018" },
  { code: "NH", slug: "new-hampshire", name: "New Hampshire", fips: "33", lat: "43.1939", lng: "-71.5724" },
  { code: "NJ", slug: "new-jersey", name: "New Jersey", fips: "34", lat: "40.0583", lng: "-74.4057" },
  { code: "NM", slug: "new-mexico", name: "New Mexico", fips: "35", lat: "34.5199", lng: "-105.8701" },
  { code: "ND", slug: "north-dakota", name: "North Dakota", fips: "38", lat: "47.5515", lng: "-101.0020" },
  { code: "OK", slug: "oklahoma", name: "Oklahoma", fips: "40", lat: "35.0078", lng: "-97.0929" },
  { code: "RI", slug: "rhode-island", name: "Rhode Island", fips: "44", lat: "41.6809", lng: "-71.5118" },
  { code: "SC", slug: "south-carolina", name: "South Carolina", fips: "45", lat: "33.8361", lng: "-81.1637" },
  { code: "SD", slug: "south-dakota", name: "South Dakota", fips: "46", lat: "44.2998", lng: "-99.4388" },
  { code: "UT", slug: "utah", name: "Utah", fips: "49", lat: "39.3210", lng: "-111.0937" },
  { code: "VT", slug: "vermont", name: "Vermont", fips: "50", lat: "44.5588", lng: "-72.5778" },
  { code: "VA", slug: "virginia", name: "Virginia", fips: "51", lat: "37.4316", lng: "-78.6569" },
  { code: "WV", slug: "west-virginia", name: "West Virginia", fips: "54", lat: "38.5976", lng: "-80.4549" },
  { code: "WY", slug: "wyoming", name: "Wyoming", fips: "56", lat: "43.0760", lng: "-107.2903" },
  { code: "AK", slug: "alaska", name: "Alaska", fips: "02", lat: "64.2008", lng: "-153.4937" },
];

const CATEGORIES = [
  { slug: "copper", name: "Copper", displayOrder: 10 },
  { slug: "aluminum", name: "Aluminum", displayOrder: 20 },
  { slug: "steel", name: "Steel & Iron", displayOrder: 30 },
  { slug: "brass", name: "Brass", displayOrder: 40 },
  { slug: "lead", name: "Lead", displayOrder: 50 },
  { slug: "zinc", name: "Zinc", displayOrder: 60 },
  { slug: "electronics", name: "Electronics (E-Scrap)", displayOrder: 70 },
  { slug: "precious-metals", name: "Precious Metals", displayOrder: 80 },
  { slug: "auto-parts", name: "Auto Parts", displayOrder: 90 },
];

const METALS = [
  { slug: "bare-bright-copper", name: "Bare Bright Copper", category: "copper", unit: "lb", spotFactor: "0.900", spotMetal: "copper", displayOrder: 1 },
  { slug: "copper-1", name: "#1 Copper", category: "copper", unit: "lb", spotFactor: "0.850", spotMetal: "copper", displayOrder: 2 },
  { slug: "copper-2", name: "#2 Copper", category: "copper", unit: "lb", spotFactor: "0.750", spotMetal: "copper", displayOrder: 3 },
  { slug: "copper-pipe", name: "Copper Pipe (Clean)", category: "copper", unit: "lb", spotFactor: "0.800", spotMetal: "copper", displayOrder: 4 },
  { slug: "aluminum-mixed", name: "Aluminum (Mixed)", category: "aluminum", unit: "lb", spotFactor: "0.400", spotMetal: "aluminum", displayOrder: 10 },
  { slug: "aluminum-cans", name: "Aluminum Cans", category: "aluminum", unit: "lb", spotFactor: "0.550", spotMetal: "aluminum", displayOrder: 11 },
  { slug: "aluminum-extrusion", name: "Aluminum Extrusion", category: "aluminum", unit: "lb", spotFactor: "0.500", spotMetal: "aluminum", displayOrder: 12 },
  { slug: "steel-heavy-melt", name: "Steel (Heavy Melt)", category: "steel", unit: "ton", spotFactor: "0.600", spotMetal: "steel", displayOrder: 20 },
  { slug: "light-iron", name: "Light Iron / Sheet", category: "steel", unit: "ton", spotFactor: "0.450", spotMetal: "steel", displayOrder: 21 },
  { slug: "cast-iron", name: "Cast Iron", category: "steel", unit: "lb", spotFactor: "0.020", spotMetal: "steel", displayOrder: 22 },
  { slug: "stainless-steel", name: "Stainless Steel (304)", category: "steel", unit: "lb", spotFactor: "0.350", spotMetal: "nickel", displayOrder: 23 },
  { slug: "brass-yellow", name: "Yellow Brass", category: "brass", unit: "lb", spotFactor: "0.700", spotMetal: "copper", displayOrder: 30 },
  { slug: "brass-red", name: "Red Brass", category: "brass", unit: "lb", spotFactor: "0.780", spotMetal: "copper", displayOrder: 31 },
  { slug: "lead-soft", name: "Lead (Soft)", category: "lead", unit: "lb", spotFactor: "0.350", spotMetal: "lead", displayOrder: 40 },
  { slug: "lead-wheel-weights", name: "Lead Wheel Weights", category: "lead", unit: "lb", spotFactor: "0.250", spotMetal: "lead", displayOrder: 41 },
  { slug: "zinc-die-cast", name: "Zinc Die Cast", category: "zinc", unit: "lb", spotFactor: "0.380", spotMetal: "zinc", displayOrder: 50 },
  { slug: "low-grade-board", name: "Low-Grade Circuit Board", category: "electronics", unit: "lb", spotFactor: null, spotMetal: null, displayOrder: 60 },
  { slug: "high-grade-board", name: "High-Grade Circuit Board", category: "electronics", unit: "lb", spotFactor: null, spotMetal: null, displayOrder: 61 },
  { slug: "silver", name: "Silver (.999)", category: "precious-metals", unit: "oz", spotFactor: "0.950", spotMetal: "silver", displayOrder: 70 },
  { slug: "gold", name: "Gold (.999)", category: "precious-metals", unit: "oz", spotFactor: "0.950", spotMetal: "gold", displayOrder: 71 },
  { slug: "car-battery", name: "Car Battery", category: "auto-parts", unit: "each", spotFactor: null, spotMetal: null, displayOrder: 80 },
  { slug: "catalytic-converter", name: "Catalytic Converter", category: "auto-parts", unit: "each", spotFactor: null, spotMetal: null, displayOrder: 81 },
];

const TODAY = new Date().toISOString().slice(0, 10);

const NATIONAL_SPOT_PRICES: Record<string, number> = {
  "bare-bright-copper": 3.82,
  "copper-1": 3.60,
  "copper-2": 3.18,
  "copper-pipe": 3.40,
  "aluminum-mixed": 0.48,
  "aluminum-cans": 0.65,
  "aluminum-extrusion": 0.60,
  "steel-heavy-melt": 285.00,
  "light-iron": 215.00,
  "cast-iron": 0.18,
  "stainless-steel": 0.62,
  "brass-yellow": 2.95,
  "brass-red": 3.20,
  "lead-soft": 0.42,
  "lead-wheel-weights": 0.30,
  "zinc-die-cast": 0.55,
  "low-grade-board": 0.85,
  "high-grade-board": 8.20,
  "silver": 28.50,
  "gold": 2620.00,
  "car-battery": 8.50,
  "catalytic-converter": 95.00,
};

const CITIES = [
  { stateCode: "PA", slug: "pittsburgh", name: "Pittsburgh", population: 302000, lat: "40.4406", lng: "-79.9959" },
  { stateCode: "PA", slug: "beech-creek", name: "Beech Creek", population: 700, lat: "41.0739", lng: "-77.6361" },
  { stateCode: "WI", slug: "nekoosa", name: "Nekoosa", population: 2580, lat: "44.3144", lng: "-89.9068" },
  { stateCode: "WI", slug: "new-richmond", name: "New Richmond", population: 9819, lat: "45.1225", lng: "-92.5363" },
  { stateCode: "KY", slug: "la-grange", name: "La Grange", population: 9081, lat: "38.4081", lng: "-85.3786" },
  { stateCode: "KY", slug: "richmond", name: "Richmond", population: 36157, lat: "37.7479", lng: "-84.2947" },
  { stateCode: "NC", slug: "sylva", name: "Sylva", population: 2781, lat: "35.3737", lng: "-83.2226" },
  { stateCode: "NC", slug: "charlotte", name: "Charlotte", population: 874579, lat: "35.2271", lng: "-80.8431" },
  { stateCode: "TX", slug: "fort-worth", name: "Fort Worth", population: 935508, lat: "32.7555", lng: "-97.3308" },
  { stateCode: "TX", slug: "houston", name: "Houston", population: 2304000, lat: "29.7604", lng: "-95.3698" },
];

type YardSeed = {
  slug: string; name: string; stateCode: string; cityKey: string;
  address?: string; zip?: string; lat?: string; lng?: string; phone?: string;
  accepted?: string[]; services?: string[]; hours?: Record<string, { open: string; close: string }>;
  ratingAvg?: string; ratingCount?: number; isPremium?: boolean; isVerified?: boolean;
  photoUrls?: string[]; website?: string;
};

const STD_HOURS = { mon: { open: "07:00", close: "17:00" }, tue: { open: "07:00", close: "17:00" }, wed: { open: "07:00", close: "17:00" }, thu: { open: "07:00", close: "17:00" }, fri: { open: "07:00", close: "17:00" }, sat: { open: "08:00", close: "13:00" } };
const SHORT_HOURS = { mon: { open: "08:00", close: "16:00" }, tue: { open: "08:00", close: "16:00" }, wed: { open: "08:00", close: "16:00" }, thu: { open: "08:00", close: "16:00" }, fri: { open: "08:00", close: "16:00" } };

const ALL_COMMON = ["bare-bright-copper", "copper-1", "copper-2", "aluminum-mixed", "aluminum-cans", "steel-heavy-melt", "brass-yellow", "stainless-steel"];
const HEAVY = ["steel-heavy-melt", "light-iron", "cast-iron", "stainless-steel", "aluminum-mixed", "copper-1"];
const COPPER_FOCUS = ["bare-bright-copper", "copper-1", "copper-2", "copper-pipe", "brass-yellow", "brass-red"];
const AUTO_FOCUS = ["car-battery", "catalytic-converter", "steel-heavy-melt", "aluminum-mixed", "copper-1", "lead-soft"];

const YARDS: YardSeed[] = [
  // PA - Pittsburgh (6 yards)
  { slug: "steel-city-scrap", name: "Steel City Scrap", stateCode: "PA", cityKey: "PA-pittsburgh", address: "2101 Sidney St", zip: "15203", lat: "40.4280", lng: "-79.9750", phone: "(412) 555-0193", accepted: HEAVY, services: ["pickup", "rolloff", "cash-payment"], hours: STD_HOURS, ratingAvg: "4.5", ratingCount: 88, isPremium: true, isVerified: true, photoUrls: ["https://example.com/p1.jpg"] },
  { slug: "three-rivers-recycling", name: "Three Rivers Recycling", stateCode: "PA", cityKey: "PA-pittsburgh", address: "5500 Butler St", zip: "15201", lat: "40.4750", lng: "-79.9500", phone: "(412) 555-0204", accepted: ALL_COMMON, services: ["cash-payment"], hours: STD_HOURS, ratingAvg: "4.1", ratingCount: 52, isVerified: true },
  { slug: "monongahela-metals", name: "Monongahela Metals", stateCode: "PA", cityKey: "PA-pittsburgh", address: "100 Carson St", zip: "15219", lat: "40.4310", lng: "-80.0010", phone: "(412) 555-0316", accepted: COPPER_FOCUS, services: ["cash-payment"], hours: SHORT_HOURS, ratingAvg: "4.7", ratingCount: 134, isPremium: true, isVerified: true },
  { slug: "iron-city-salvage", name: "Iron City Salvage", stateCode: "PA", cityKey: "PA-pittsburgh", address: "3401 Penn Ave", zip: "15201", lat: "40.4592", lng: "-79.9614", phone: "(412) 555-0428" },
  { slug: "allegheny-auto-recycling", name: "Allegheny Auto Recycling", stateCode: "PA", cityKey: "PA-pittsburgh", address: "8800 Frankstown Ave", zip: "15221", lat: "40.4612", lng: "-79.8842", phone: "(412) 555-0539", accepted: AUTO_FOCUS, services: ["auto-salvage", "pickup"], hours: STD_HOURS, ratingAvg: "3.9", ratingCount: 41 },
  { slug: "ohio-river-scrap", name: "Ohio River Scrap", stateCode: "PA", cityKey: "PA-pittsburgh", address: "601 Beaver Ave", zip: "15233", lat: "40.4520", lng: "-80.0420", phone: "(412) 555-0641", accepted: ALL_COMMON, hours: STD_HOURS, ratingAvg: "4.0", ratingCount: 28 },

  // PA - Beech Creek (4 yards)
  { slug: "beech-creek-iron", name: "Beech Creek Iron Works", stateCode: "PA", cityKey: "PA-beech-creek", address: "150 Main St", zip: "16822", lat: "41.0742", lng: "-77.6358", phone: "(570) 555-0712", accepted: HEAVY, services: ["pickup"], hours: SHORT_HOURS, ratingAvg: "4.4", ratingCount: 22, isVerified: true },
  { slug: "central-pa-recycling", name: "Central PA Recycling", stateCode: "PA", cityKey: "PA-beech-creek", address: "88 Bald Eagle Dr", zip: "16822", lat: "41.0801", lng: "-77.6201", phone: "(570) 555-0823", accepted: ALL_COMMON, hours: STD_HOURS, ratingAvg: "3.7", ratingCount: 14 },
  { slug: "mountain-metal-co", name: "Mountain Metal Co.", stateCode: "PA", cityKey: "PA-beech-creek", phone: "(570) 555-0934" },
  { slug: "valley-scrap-yard", name: "Valley Scrap Yard", stateCode: "PA", cityKey: "PA-beech-creek", address: "245 Liberty Rd", zip: "16822", lat: "41.0689", lng: "-77.6489", phone: "(570) 555-1045", accepted: COPPER_FOCUS, hours: SHORT_HOURS, ratingAvg: "4.2", ratingCount: 31 },

  // WI - Nekoosa (5 yards)
  { slug: "nekoosa-metals", name: "Nekoosa Metals", stateCode: "WI", cityKey: "WI-nekoosa", address: "402 Market St", zip: "54457", lat: "44.3151", lng: "-89.9077", phone: "(715) 555-1156", accepted: ALL_COMMON, services: ["cash-payment", "pickup"], hours: STD_HOURS, ratingAvg: "4.6", ratingCount: 67, isVerified: true },
  { slug: "wisconsin-river-scrap", name: "Wisconsin River Scrap", stateCode: "WI", cityKey: "WI-nekoosa", address: "1100 Wisconsin Riverside Dr", zip: "54457", lat: "44.3201", lng: "-89.9012", phone: "(715) 555-1267", accepted: HEAVY, hours: STD_HOURS, ratingAvg: "4.0", ratingCount: 38 },
  { slug: "central-wi-recyclers", name: "Central WI Recyclers", stateCode: "WI", cityKey: "WI-nekoosa", phone: "(715) 555-1378", accepted: COPPER_FOCUS },
  { slug: "paper-city-salvage", name: "Paper City Salvage", stateCode: "WI", cityKey: "WI-nekoosa", address: "78 Mill Rd", zip: "54457", lat: "44.3098", lng: "-89.9156", phone: "(715) 555-1489", accepted: AUTO_FOCUS, services: ["auto-salvage"], hours: SHORT_HOURS, ratingAvg: "4.3", ratingCount: 45 },
  { slug: "northwoods-metal", name: "Northwoods Metal", stateCode: "WI", cityKey: "WI-nekoosa", address: "55 Pine St", zip: "54457", lat: "44.3175", lng: "-89.9020", phone: "(715) 555-1591", accepted: ALL_COMMON, hours: STD_HOURS, ratingAvg: "4.1", ratingCount: 19, isPremium: true },

  // WI - New Richmond (4 yards)
  { slug: "new-richmond-scrap", name: "New Richmond Scrap & Iron", stateCode: "WI", cityKey: "WI-new-richmond", address: "510 N Knowles Ave", zip: "54017", lat: "45.1230", lng: "-92.5369", phone: "(715) 555-1602", accepted: HEAVY, services: ["rolloff", "pickup"], hours: STD_HOURS, ratingAvg: "4.5", ratingCount: 92, isVerified: true, isPremium: true },
  { slug: "st-croix-recycling", name: "St. Croix Recycling", stateCode: "WI", cityKey: "WI-new-richmond", address: "200 W Richmond Way", zip: "54017", lat: "45.1289", lng: "-92.5421", phone: "(715) 555-1713", accepted: ALL_COMMON, hours: STD_HOURS, ratingAvg: "3.8", ratingCount: 26 },
  { slug: "border-state-metals", name: "Border State Metals", stateCode: "WI", cityKey: "WI-new-richmond", phone: "(715) 555-1824" },
  { slug: "willow-river-scrap", name: "Willow River Scrap", stateCode: "WI", cityKey: "WI-new-richmond", address: "888 N 3rd St", zip: "54017", lat: "45.1198", lng: "-92.5301", phone: "(715) 555-1935", accepted: COPPER_FOCUS, hours: SHORT_HOURS, ratingAvg: "4.2", ratingCount: 33 },

  // KY - La Grange (5 yards)
  { slug: "oldham-metals", name: "Oldham County Metals", stateCode: "KY", cityKey: "KY-la-grange", address: "1500 W Highway 146", zip: "40031", lat: "38.4078", lng: "-85.3781", phone: "(502) 555-2046", accepted: ALL_COMMON, services: ["cash-payment", "pickup"], hours: STD_HOURS, ratingAvg: "4.4", ratingCount: 71, isVerified: true },
  { slug: "bluegrass-recycling", name: "Bluegrass Recycling", stateCode: "KY", cityKey: "KY-la-grange", address: "300 Mt Mercy Dr", zip: "40031", lat: "38.4112", lng: "-85.3812", phone: "(502) 555-2157", accepted: HEAVY, services: ["rolloff"], hours: STD_HOURS, ratingAvg: "4.0", ratingCount: 44 },
  { slug: "derby-city-scrap", name: "Derby City Scrap", stateCode: "KY", cityKey: "KY-la-grange", address: "2200 Crestwood Ln", zip: "40031", lat: "38.4034", lng: "-85.3699", phone: "(502) 555-2268", accepted: COPPER_FOCUS, hours: SHORT_HOURS, ratingAvg: "4.6", ratingCount: 88, isPremium: true, isVerified: true },
  { slug: "north-fork-salvage", name: "North Fork Salvage", stateCode: "KY", cityKey: "KY-la-grange", phone: "(502) 555-2379" },
  { slug: "river-bend-metal", name: "River Bend Metal", stateCode: "KY", cityKey: "KY-la-grange", address: "75 Industrial Park Dr", zip: "40031", lat: "38.4150", lng: "-85.3850", phone: "(502) 555-2480", accepted: AUTO_FOCUS, services: ["auto-salvage"], hours: STD_HOURS, ratingAvg: "3.9", ratingCount: 27 },

  // KY - Richmond (4 yards)
  { slug: "madison-county-recycling", name: "Madison County Recycling", stateCode: "KY", cityKey: "KY-richmond", address: "1102 Big Hill Ave", zip: "40475", lat: "37.7481", lng: "-84.2942", phone: "(859) 555-2591", accepted: ALL_COMMON, services: ["pickup", "cash-payment"], hours: STD_HOURS, ratingAvg: "4.3", ratingCount: 56, isVerified: true },
  { slug: "kentucky-river-scrap", name: "Kentucky River Scrap", stateCode: "KY", cityKey: "KY-richmond", address: "650 Eastern Bypass", zip: "40475", lat: "37.7521", lng: "-84.2871", phone: "(859) 555-2602", accepted: HEAVY, hours: STD_HOURS, ratingAvg: "4.1", ratingCount: 39 },
  { slug: "pioneer-metals", name: "Pioneer Metals", stateCode: "KY", cityKey: "KY-richmond", phone: "(859) 555-2713", accepted: COPPER_FOCUS },
  { slug: "eastern-ky-salvage", name: "Eastern KY Salvage", stateCode: "KY", cityKey: "KY-richmond", address: "20 Industrial Pkwy", zip: "40475", lat: "37.7421", lng: "-84.3001", phone: "(859) 555-2824", accepted: AUTO_FOCUS, services: ["auto-salvage"], hours: SHORT_HOURS, ratingAvg: "4.2", ratingCount: 49 },

  // NC - Sylva (5 yards)
  { slug: "smoky-mountain-metals", name: "Smoky Mountain Metals", stateCode: "NC", cityKey: "NC-sylva", address: "115 W Main St", zip: "28779", lat: "35.3741", lng: "-83.2229", phone: "(828) 555-2935", accepted: ALL_COMMON, hours: STD_HOURS, ratingAvg: "4.5", ratingCount: 63, isVerified: true },
  { slug: "blue-ridge-recycling", name: "Blue Ridge Recycling", stateCode: "NC", cityKey: "NC-sylva", address: "320 Skyland Dr", zip: "28779", lat: "35.3801", lng: "-83.2189", phone: "(828) 555-3046", accepted: HEAVY, hours: STD_HOURS, ratingAvg: "3.8", ratingCount: 21 },
  { slug: "tuckasegee-scrap", name: "Tuckasegee Scrap & Iron", stateCode: "NC", cityKey: "NC-sylva", phone: "(828) 555-3157" },
  { slug: "highlands-metal-co", name: "Highlands Metal Co.", stateCode: "NC", cityKey: "NC-sylva", address: "78 Cope Creek Rd", zip: "28779", lat: "35.3690", lng: "-83.2310", phone: "(828) 555-3268", accepted: COPPER_FOCUS, hours: SHORT_HOURS, ratingAvg: "4.7", ratingCount: 102, isPremium: true, isVerified: true },
  { slug: "appalachian-salvage", name: "Appalachian Salvage", stateCode: "NC", cityKey: "NC-sylva", address: "1500 Asheville Hwy", zip: "28779", lat: "35.3650", lng: "-83.2150", phone: "(828) 555-3379", accepted: AUTO_FOCUS, services: ["auto-salvage", "pickup"], hours: STD_HOURS, ratingAvg: "4.0", ratingCount: 35 },

  // NC - Charlotte (6 yards)
  { slug: "queen-city-scrap", name: "Queen City Scrap", stateCode: "NC", cityKey: "NC-charlotte", address: "3500 N Tryon St", zip: "28206", lat: "35.2391", lng: "-80.8051", phone: "(704) 555-3480", accepted: ALL_COMMON, services: ["cash-payment", "pickup", "rolloff"], hours: STD_HOURS, ratingAvg: "4.4", ratingCount: 156, isVerified: true, isPremium: true, photoUrls: ["https://example.com/qc1.jpg", "https://example.com/qc2.jpg"] },
  { slug: "carolina-recycling", name: "Carolina Recycling", stateCode: "NC", cityKey: "NC-charlotte", address: "8800 Statesville Rd", zip: "28269", lat: "35.3100", lng: "-80.8200", phone: "(704) 555-3591", accepted: HEAVY, services: ["rolloff"], hours: STD_HOURS, ratingAvg: "4.1", ratingCount: 89 },
  { slug: "panthers-metal", name: "Panthers Metal Co.", stateCode: "NC", cityKey: "NC-charlotte", address: "200 Bryant St", zip: "28208", lat: "35.2278", lng: "-80.8581", phone: "(704) 555-3602", accepted: COPPER_FOCUS, hours: SHORT_HOURS, ratingAvg: "4.6", ratingCount: 211, isVerified: true },
  { slug: "uptown-salvage", name: "Uptown Salvage", stateCode: "NC", cityKey: "NC-charlotte", phone: "(704) 555-3713" },
  { slug: "south-end-metals", name: "South End Metals", stateCode: "NC", cityKey: "NC-charlotte", address: "1600 Camden Rd", zip: "28203", lat: "35.2150", lng: "-80.8501", phone: "(704) 555-3824", accepted: AUTO_FOCUS, services: ["auto-salvage"], hours: STD_HOURS, ratingAvg: "3.9", ratingCount: 47 },
  { slug: "catawba-river-scrap", name: "Catawba River Scrap", stateCode: "NC", cityKey: "NC-charlotte", address: "5500 W Boulevard", zip: "28208", lat: "35.2090", lng: "-80.8901", phone: "(704) 555-3935", accepted: ALL_COMMON, hours: STD_HOURS, ratingAvg: "4.0", ratingCount: 33 },

  // TX - Fort Worth (5 yards)
  { slug: "cowtown-metals", name: "Cowtown Metals", stateCode: "TX", cityKey: "TX-fort-worth", address: "2100 N Sylvania Ave", zip: "76111", lat: "32.7891", lng: "-97.3201", phone: "(817) 555-4046", accepted: ALL_COMMON, services: ["cash-payment", "pickup"], hours: STD_HOURS, ratingAvg: "4.5", ratingCount: 124, isVerified: true, isPremium: true },
  { slug: "stockyards-scrap", name: "Stockyards Scrap", stateCode: "TX", cityKey: "TX-fort-worth", address: "131 E Exchange Ave", zip: "76164", lat: "32.7891", lng: "-97.3471", phone: "(817) 555-4157", accepted: HEAVY, services: ["rolloff"], hours: STD_HOURS, ratingAvg: "4.2", ratingCount: 76 },
  { slug: "trinity-river-recycling", name: "Trinity River Recycling", stateCode: "TX", cityKey: "TX-fort-worth", phone: "(817) 555-4268", accepted: COPPER_FOCUS },
  { slug: "panther-city-iron", name: "Panther City Iron", stateCode: "TX", cityKey: "TX-fort-worth", address: "3800 E Lancaster Ave", zip: "76103", lat: "32.7501", lng: "-97.2901", phone: "(817) 555-4379", accepted: AUTO_FOCUS, services: ["auto-salvage"], hours: SHORT_HOURS, ratingAvg: "4.0", ratingCount: 58 },
  { slug: "north-texas-metal", name: "North Texas Metal", stateCode: "TX", cityKey: "TX-fort-worth", address: "5400 Riverside Dr", zip: "76137", lat: "32.8101", lng: "-97.2891", phone: "(817) 555-4480", accepted: ALL_COMMON, hours: STD_HOURS, ratingAvg: "4.3", ratingCount: 91, isVerified: true },

  // TX - Houston (6 yards)
  { slug: "lone-star-recycling", name: "Lone Star Recycling", stateCode: "TX", cityKey: "TX-houston", address: "5800 Polk St", zip: "77023", lat: "29.7300", lng: "-95.3100", phone: "(713) 555-0344", accepted: ALL_COMMON, services: ["cash-payment", "pickup"], hours: STD_HOURS, ratingAvg: "4.6", ratingCount: 112, isVerified: true, isPremium: true },
  { slug: "bayou-city-metals", name: "Bayou City Metals", stateCode: "TX", cityKey: "TX-houston", address: "6500 Navigation Blvd", zip: "77011", lat: "29.7401", lng: "-95.3298", phone: "(713) 555-4591", accepted: HEAVY, services: ["rolloff", "pickup"], hours: STD_HOURS, ratingAvg: "4.1", ratingCount: 84 },
  { slug: "ship-channel-scrap", name: "Ship Channel Scrap", stateCode: "TX", cityKey: "TX-houston", address: "9100 Manchester St", zip: "77012", lat: "29.7250", lng: "-95.2750", phone: "(713) 555-4602", accepted: COPPER_FOCUS, hours: STD_HOURS, ratingAvg: "4.4", ratingCount: 169, isPremium: true, isVerified: true },
  { slug: "space-city-salvage", name: "Space City Salvage", stateCode: "TX", cityKey: "TX-houston", phone: "(713) 555-4713" },
  { slug: "harris-county-iron", name: "Harris County Iron & Metal", stateCode: "TX", cityKey: "TX-houston", address: "12000 Cullen Blvd", zip: "77047", lat: "29.6201", lng: "-95.3801", phone: "(713) 555-4824", accepted: AUTO_FOCUS, services: ["auto-salvage"], hours: STD_HOURS, ratingAvg: "3.9", ratingCount: 52 },
  { slug: "gulf-coast-recycling", name: "Gulf Coast Recycling", stateCode: "TX", cityKey: "TX-houston", address: "4200 Almeda Rd", zip: "77004", lat: "29.7201", lng: "-95.3801", phone: "(713) 555-4935", accepted: ALL_COMMON, hours: SHORT_HOURS, ratingAvg: "4.0", ratingCount: 41 },
];

const LEGACY_REDIRECTS = [
  { sourcePath: "/wp-content/uploads/2019/old-banner.jpg", targetPath: "/", statusCode: 301 },
  { sourcePath: "/wp-content/themes/scrapyards/page.html", targetPath: "/", statusCode: 301 },
  { sourcePath: "/wp-admin/", targetPath: "/", statusCode: 301 },
  { sourcePath: "/?p=123", targetPath: "/scrap-metal-prices/", statusCode: 301 },
  { sourcePath: "/?p=456", targetPath: "/scrap-yards/", statusCode: 301 },
  { sourcePath: "/?page_id=789", targetPath: "/", statusCode: 301 },
  { sourcePath: "/old-recycling-center-list.php", targetPath: "/scrap-yards/", statusCode: 301 },
  { sourcePath: "/scrap-metals-pricing.html", targetPath: "/scrap-metal-prices/", statusCode: 301 },
  { sourcePath: "/find-a-yard.html", targetPath: "/scrap-yards/", statusCode: 301 },
  { sourcePath: "/metal-prices-2023/", targetPath: "/scrap-metal-prices/", statusCode: 301 },
  { sourcePath: "/author/admin/", targetPath: "/", statusCode: 301 },
  { sourcePath: "/category/news/", targetPath: "/", statusCode: 301 },
  { sourcePath: "/tag/copper/", targetPath: "/scrap-metal-prices/copper/", statusCode: 301 },
  { sourcePath: "/tag/aluminum/", targetPath: "/scrap-metal-prices/aluminum/", statusCode: 301 },
  { sourcePath: "/old-yard-finder/", targetPath: "/scrap-yards/", statusCode: 301 },
  { sourcePath: "/pricing-old.html", targetPath: "/scrap-metal-prices/", statusCode: 301 },
  { sourcePath: "/test-fallback-1", targetPath: "/scrap-yards/", statusCode: 301 },
  { sourcePath: "/test-fallback-2", targetPath: "/scrap-metal-prices/", statusCode: 301 },
  { sourcePath: "/test-db-redirect", targetPath: "/scrap-yards/pennsylvania/", statusCode: 301 },
];

async function seed() {
  console.log("Seeding states...");
  for (const s of STATES) {
    await db.insert(statesTable).values(s).onConflictDoNothing();
  }

  console.log("Seeding cities...");
  for (const c of CITIES) {
    await db.insert(citiesTable).values(c).onConflictDoNothing();
  }

  console.log("Seeding metal categories...");
  for (const c of CATEGORIES) {
    await db.insert(metalCategoriesTable).values(c).onConflictDoUpdate({
      target: metalCategoriesTable.slug,
      set: { name: c.name, displayOrder: c.displayOrder },
    });
  }

  console.log("Seeding metals...");
  for (const m of METALS) {
    await db.insert(metalsTable).values(m).onConflictDoUpdate({
      target: metalsTable.slug,
      set: { name: m.name, category: m.category, unit: m.unit, spotFactor: m.spotFactor, spotMetal: m.spotMetal, displayOrder: m.displayOrder },
    });
  }

  console.log("Seeding national metal prices...");
  for (const [slug, price] of Object.entries(NATIONAL_SPOT_PRICES)) {
    await db.insert(metalPricesTable).values({
      metalSlug: slug,
      regionCode: "US",
      price: String(price),
      source: "spot-derived",
      recordedOn: TODAY,
    }).onConflictDoNothing();
  }

  console.log("Seeding state-level prices (slight regional variation)...");
  for (const state of STATES) {
    for (const [slug, basePrice] of Object.entries(NATIONAL_SPOT_PRICES)) {
      const variance = 1 + (Math.random() * 0.1 - 0.05);
      const statePrice = (basePrice * variance).toFixed(4);
      await db.insert(metalPricesTable).values({
        metalSlug: slug,
        regionCode: state.code,
        price: statePrice,
        source: "spot-derived",
        recordedOn: TODAY,
      }).onConflictDoNothing();
    }
  }

  console.log("Seeding sample yards...");
  const cityRows = await db.select().from(citiesTable);
  const cityMap = Object.fromEntries(cityRows.map((c) => [`${c.stateCode}-${c.slug}`, c]));

  for (const y of YARDS) {
    const city = cityMap[y.cityKey];
    if (!city) { console.warn(`City not found: ${y.cityKey}`); continue; }
    await db.insert(yardsTable).values({
      slug: y.slug,
      name: y.name,
      stateCode: y.stateCode,
      cityId: city.id,
      address: y.address,
      zip: y.zip,
      lat: y.lat,
      lng: y.lng,
      phone: y.phone,
      website: y.website,
      accepted: y.accepted ?? null,
      services: y.services ?? null,
      hours: y.hours ?? null,
      ratingAvg: y.ratingAvg,
      ratingCount: y.ratingCount ?? 0,
      isPremium: y.isPremium ?? false,
      isVerified: y.isVerified ?? false,
      photoUrls: y.photoUrls ?? null,
      status: "active",
    }).onConflictDoNothing();
  }

  console.log("Seeding legacy redirects...");
  for (const r of LEGACY_REDIRECTS) {
    await db.insert(legacyRedirectsTable).values(r).onConflictDoNothing();
  }

  console.log(`Seed complete! ${YARDS.length} yards, ${METALS.length} metals, ${CATEGORIES.length} categories, ${LEGACY_REDIRECTS.length} legacy redirects.`);
  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
