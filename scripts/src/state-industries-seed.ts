/**
 * Seed data for `states.industries_text`.
 *
 * Hand-written, generic noun phrases describing each state's dominant
 * industries. Used as a slot value in the metal_state_content market_context
 * templates. Sources: BLS QCEW (2024), state industry profiles, generic
 * common knowledge. Phrasing is deliberately low-claim and digit-free so
 * it passes the v3 stop-list when interpolated into templates.
 */
export const STATE_INDUSTRIES: Record<string, string> = {
  AL: "automotive manufacturing, steel, aerospace, and forestry",
  AK: "oil and gas production, fishing, and mining",
  AZ: "semiconductor manufacturing, mining, aerospace, and construction",
  AR: "food processing, paper and forestry, and steel",
  CA: "technology hardware, agriculture, aerospace, and entertainment production",
  CO: "aerospace, energy, technology, and mining",
  CT: "aerospace and defense manufacturing, insurance, and pharmaceuticals",
  DE: "chemicals, pharmaceuticals, and finance",
  DC: "federal government services and professional services",
  FL: "tourism, aerospace, agriculture, and construction",
  GA: "automotive manufacturing, logistics, food processing, and forestry",
  HI: "tourism, defense, and agriculture",
  ID: "agriculture, forestry, technology, and food processing",
  IL: "manufacturing, finance, food processing, and rail logistics",
  IN: "automotive manufacturing, steel, pharmaceuticals, and agriculture",
  IA: "agriculture, food processing, finance, and biofuels",
  KS: "aerospace, agriculture, and oil and gas",
  KY: "automotive manufacturing, aluminum, bourbon, and logistics",
  LA: "petrochemicals, oil and gas, ports and shipping, and seafood",
  ME: "forestry and paper, fishing, and shipbuilding",
  MD: "biotechnology, defense, federal services, and ports and shipping",
  MA: "biotechnology, education, healthcare, and finance",
  MI: "automotive manufacturing, steel, and aerospace",
  MN: "medical devices, agriculture, mining, and food processing",
  MS: "automotive manufacturing, forestry, and shipbuilding",
  MO: "automotive manufacturing, agriculture, and aerospace",
  MT: "agriculture, mining, and forestry",
  NE: "agriculture, food processing, insurance, and rail logistics",
  NV: "tourism, mining, and warehousing and logistics",
  NH: "advanced manufacturing, technology, and tourism",
  NJ: "pharmaceuticals, chemicals, ports and shipping, and finance",
  NM: "oil and gas, federal labs and aerospace, and agriculture",
  NY: "finance, healthcare, technology, and ports and shipping",
  NC: "biotechnology, banking, furniture, and textile-derived industries",
  ND: "oil and gas, agriculture, and energy",
  OH: "automotive manufacturing, steel, plastics, and healthcare",
  OK: "oil and gas, aerospace, and agriculture",
  OR: "technology hardware, forestry, and food processing",
  PA: "steel, healthcare, energy, and food processing",
  RI: "healthcare, education, and defense manufacturing",
  SC: "automotive manufacturing, aerospace, and tire production",
  SD: "agriculture, food processing, and finance",
  TN: "automotive manufacturing, healthcare, and music and entertainment",
  TX: "oil and gas, petrochemicals, technology hardware, and aerospace",
  UT: "technology, aerospace and defense, and mining",
  VT: "dairy and food processing, technology, and tourism",
  VA: "federal services, defense, shipbuilding, and ports and shipping",
  WA: "aerospace, technology, agriculture, and ports and shipping",
  WV: "coal and energy, chemicals, and forestry",
  WI: "manufacturing, paper and forestry, and dairy",
  WY: "energy, mining, and agriculture",
};

export const FALLBACK_INDUSTRIES = "manufacturing, construction, and consumer goods";
