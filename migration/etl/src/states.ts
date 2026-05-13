// All 50 US states + DC. Mirrors scripts/src/seed-scrapyards.ts plus DC.
export interface StateRow {
  code: string;
  slug: string;
  name: string;
  fips: string;
  lat: string;
  lng: string;
}

export const STATES: StateRow[] = [
  { code: "AL", slug: "alabama", name: "Alabama", fips: "01", lat: "32.3182", lng: "-86.9023" },
  { code: "AK", slug: "alaska", name: "Alaska", fips: "02", lat: "64.2008", lng: "-153.4937" },
  { code: "AZ", slug: "arizona", name: "Arizona", fips: "04", lat: "34.0489", lng: "-111.0937" },
  { code: "AR", slug: "arkansas", name: "Arkansas", fips: "05", lat: "34.9697", lng: "-92.3731" },
  { code: "CA", slug: "california", name: "California", fips: "06", lat: "36.7783", lng: "-119.4179" },
  { code: "CO", slug: "colorado", name: "Colorado", fips: "08", lat: "39.5501", lng: "-105.7821" },
  { code: "CT", slug: "connecticut", name: "Connecticut", fips: "09", lat: "41.6032", lng: "-73.0877" },
  { code: "DE", slug: "delaware", name: "Delaware", fips: "10", lat: "38.9108", lng: "-75.5277" },
  { code: "DC", slug: "district-of-columbia", name: "District of Columbia", fips: "11", lat: "38.9072", lng: "-77.0369" },
  { code: "FL", slug: "florida", name: "Florida", fips: "12", lat: "27.9944", lng: "-81.7603" },
  { code: "GA", slug: "georgia", name: "Georgia", fips: "13", lat: "33.0406", lng: "-83.6431" },
  { code: "HI", slug: "hawaii", name: "Hawaii", fips: "15", lat: "19.8968", lng: "-155.5828" },
  { code: "ID", slug: "idaho", name: "Idaho", fips: "16", lat: "44.0682", lng: "-114.7420" },
  { code: "IL", slug: "illinois", name: "Illinois", fips: "17", lat: "40.3495", lng: "-88.9861" },
  { code: "IN", slug: "indiana", name: "Indiana", fips: "18", lat: "40.2672", lng: "-86.1349" },
  { code: "IA", slug: "iowa", name: "Iowa", fips: "19", lat: "42.0115", lng: "-93.2105" },
  { code: "KS", slug: "kansas", name: "Kansas", fips: "20", lat: "38.5266", lng: "-96.7265" },
  { code: "KY", slug: "kentucky", name: "Kentucky", fips: "21", lat: "37.6681", lng: "-84.6701" },
  { code: "LA", slug: "louisiana", name: "Louisiana", fips: "22", lat: "31.1695", lng: "-91.8678" },
  { code: "ME", slug: "maine", name: "Maine", fips: "23", lat: "44.6939", lng: "-69.3819" },
  { code: "MD", slug: "maryland", name: "Maryland", fips: "24", lat: "39.0639", lng: "-76.8021" },
  { code: "MA", slug: "massachusetts", name: "Massachusetts", fips: "25", lat: "42.2302", lng: "-71.5301" },
  { code: "MI", slug: "michigan", name: "Michigan", fips: "26", lat: "44.3148", lng: "-85.6024" },
  { code: "MN", slug: "minnesota", name: "Minnesota", fips: "27", lat: "46.7296", lng: "-94.6859" },
  { code: "MS", slug: "mississippi", name: "Mississippi", fips: "28", lat: "32.7416", lng: "-89.6787" },
  { code: "MO", slug: "missouri", name: "Missouri", fips: "29", lat: "38.4561", lng: "-92.2884" },
  { code: "MT", slug: "montana", name: "Montana", fips: "30", lat: "46.8797", lng: "-110.3626" },
  { code: "NE", slug: "nebraska", name: "Nebraska", fips: "31", lat: "41.4925", lng: "-99.9018" },
  { code: "NV", slug: "nevada", name: "Nevada", fips: "32", lat: "38.8026", lng: "-116.4194" },
  { code: "NH", slug: "new-hampshire", name: "New Hampshire", fips: "33", lat: "43.1939", lng: "-71.5724" },
  { code: "NJ", slug: "new-jersey", name: "New Jersey", fips: "34", lat: "40.0583", lng: "-74.4057" },
  { code: "NM", slug: "new-mexico", name: "New Mexico", fips: "35", lat: "34.5199", lng: "-105.8701" },
  { code: "NY", slug: "new-york", name: "New York", fips: "36", lat: "42.1657", lng: "-74.9481" },
  { code: "NC", slug: "north-carolina", name: "North Carolina", fips: "37", lat: "35.6301", lng: "-79.8064" },
  { code: "ND", slug: "north-dakota", name: "North Dakota", fips: "38", lat: "47.5515", lng: "-101.0020" },
  { code: "OH", slug: "ohio", name: "Ohio", fips: "39", lat: "40.4173", lng: "-82.9071" },
  { code: "OK", slug: "oklahoma", name: "Oklahoma", fips: "40", lat: "35.0078", lng: "-97.0929" },
  { code: "OR", slug: "oregon", name: "Oregon", fips: "41", lat: "43.8041", lng: "-120.5542" },
  { code: "PA", slug: "pennsylvania", name: "Pennsylvania", fips: "42", lat: "41.2033", lng: "-77.1945" },
  { code: "RI", slug: "rhode-island", name: "Rhode Island", fips: "44", lat: "41.6809", lng: "-71.5118" },
  { code: "SC", slug: "south-carolina", name: "South Carolina", fips: "45", lat: "33.8361", lng: "-81.1637" },
  { code: "SD", slug: "south-dakota", name: "South Dakota", fips: "46", lat: "44.2998", lng: "-99.4388" },
  { code: "TN", slug: "tennessee", name: "Tennessee", fips: "47", lat: "35.7478", lng: "-86.6923" },
  { code: "TX", slug: "texas", name: "Texas", fips: "48", lat: "31.9686", lng: "-99.9018" },
  { code: "UT", slug: "utah", name: "Utah", fips: "49", lat: "39.3210", lng: "-111.0937" },
  { code: "VT", slug: "vermont", name: "Vermont", fips: "50", lat: "44.5588", lng: "-72.5778" },
  { code: "VA", slug: "virginia", name: "Virginia", fips: "51", lat: "37.4316", lng: "-78.6569" },
  { code: "WA", slug: "washington", name: "Washington", fips: "53", lat: "47.7511", lng: "-120.7401" },
  { code: "WV", slug: "west-virginia", name: "West Virginia", fips: "54", lat: "38.5976", lng: "-80.4549" },
  { code: "WI", slug: "wisconsin", name: "Wisconsin", fips: "55", lat: "43.7844", lng: "-88.7879" },
  { code: "WY", slug: "wyoming", name: "Wyoming", fips: "56", lat: "43.0760", lng: "-107.2903" },
];

const STATE_NAME_ALIASES: Record<string, string> = {
  "dc": "District of Columbia",
  "d.c.": "District of Columbia",
  "washington dc": "District of Columbia",
  "washington d.c.": "District of Columbia",
};
export const STATE_BY_NAME = new Map<string, StateRow>([
  ...STATES.map((s) => [s.name.toLowerCase(), s] as const),
  ...Object.entries(STATE_NAME_ALIASES).map(
    ([k, v]) => [k, STATES.find((s) => s.name === v)!] as const
  ),
]);
export const STATE_BY_SLUG = new Map<string, StateRow>(
  STATES.map((s) => [s.slug, s])
);
export const STATE_BY_CODE = new Map<string, StateRow>(
  STATES.map((s) => [s.code, s])
);

// GeoDirectory disambiguation suffixes observed in the dump (mapping spec §B1).
export const STATE_SLUG_ALIASES: Record<string, string> = {
  "delaware-2": "delaware",
  "indiana-1": "indiana",
  "kansas-1": "kansas",
  "michigan-1": "michigan",
  "nevada-2": "nevada",
  "north-dakota-1": "north-dakota",
  "south-dakota-1": "south-dakota",
  "virginia-2": "virginia",
  "washington-7": "washington",
};

export function normalizeStateSlug(s: string): string {
  return STATE_SLUG_ALIASES[s] ?? s;
}
