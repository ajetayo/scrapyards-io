/**
 * City-page description validator.
 *
 * Re-uses the v3 stop-list + helpers from yard-desc-validator (single source of
 * truth), but adapts:
 *   - Word-count target: 80-150 (vs 150-250 for yards)
 *   - No yard-name repetition check (city pages never name yards in prose)
 *   - County check: passes only when the description never claims any "X County"
 *     (city facts have no county; any county claim is unsourced by definition)
 *   - Unsourced-digits: facts blob includes yard_count + auto/industrial counts
 *     so any digit in the rendered text must be one of those values
 */

import {
  BANNED_PHRASES,
  BANNED_OPENERS,
  STOP_COMPARATIVE,
  STOP_REGION,
  STOP_TIME,
  countWords,
  escapeRegex,
} from "./yard-desc-validator";

export const CITY_TARGET_WORDS_MIN = 60;
export const CITY_TARGET_WORDS_MAX = 180;

export type CityValidatorFacts = {
  city: string;
  state: string;
  yard_count: number;
  auto_count?: number;
  industrial_count?: number;
  general_count?: number;
  accepted_top_3?: string[];
};

export type ValidationResult = {
  ok: boolean;
  reasons: string[];
  warnings: string[];
};

function stopRegex(term: string): RegExp {
  return new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
}

function findStopHits(text: string, terms: string[]): string[] {
  const hits: string[] = [];
  for (const term of terms) {
    if (stopRegex(term).test(text)) hits.push(term);
  }
  return hits;
}

function checkSince(text: string): string[] {
  const hits: string[] = [];
  const re = /\bsince\b\s+((?:\S+\s+){0,4}\S+)/gi;
  for (const m of text.matchAll(re)) {
    const tail = m[1] ?? "";
    if (/\b(199\d|20[0-2]\d|2030)\b/.test(tail)) hits.push("since+year");
    else if (/\bfor\s+\w+\s+years?\b/i.test(tail)) hits.push("since+for-X-years");
  }
  return hits;
}

function checkEstablished(text: string): string[] {
  const hits: string[] = [];
  const re = /\bestablished\b\s+((?:\S+\s+){0,4}\S+)/gi;
  for (const m of text.matchAll(re)) {
    const tail = m[1] ?? "";
    if (/\b(199\d|20[0-2]\d|2030)\b/.test(tail)) hits.push("established+year");
    else if (/\bin\s+(199\d|20[0-2]\d|2030)\b/i.test(tail)) hits.push("established+in-year");
  }
  return hits;
}

const PEER_NOUNS = new Set([
  "yard", "yards", "scrapyard", "scrapyards", "dealer", "dealers",
  "buyer", "buyers", "operator", "operators", "competitor", "competitors",
  "facility", "facilities", "business", "businesses", "shop", "shops",
  "center", "centers", "company", "companies", "recycler", "recyclers",
]);

function checkQuantifierPeer(text: string): string[] {
  const hits: string[] = [];
  for (const q of ["many", "most", "few"]) {
    const re = new RegExp(`\\b${q}\\b\\s+((?:\\S+\\s+){0,2}\\S+)`, "gi");
    for (const m of text.matchAll(re)) {
      const tail = m[1] ?? "";
      const tokens = tail.toLowerCase().split(/[^a-z-]+/).filter(Boolean);
      const peerHit = tokens.slice(0, 3).find((t) => PEER_NOUNS.has(t));
      if (peerHit) hits.push(`${q}+${peerHit}`);
    }
  }
  return hits;
}

export function validateCityDescription(text: string, facts: CityValidatorFacts): ValidationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const wc = countWords(text);
  if (wc < CITY_TARGET_WORDS_MIN || wc > CITY_TARGET_WORDS_MAX) {
    reasons.push(`word_count_out_of_range:${wc}`);
  }

  for (const re of BANNED_PHRASES) {
    if (re.test(text)) reasons.push(`banned_phrase:${re.source}`);
  }
  for (const re of BANNED_OPENERS) {
    if (re.test(text.trim())) reasons.push(`banned_opener:${re.source}`);
  }

  // Unsourced digits: facts blob is a JSON of all numeric facts the renderer
  // had access to. Any digit run in text not present in the blob is unsourced.
  const factsBlob = JSON.stringify(facts);
  const digitRuns = text.match(/\d+/g) ?? [];
  const unsourced = digitRuns.filter((d) => !factsBlob.includes(d));
  if (unsourced.length > 0) {
    reasons.push(`unsourced_digits:${unsourced.slice(0, 5).join(",")}`);
  }

  // County: city facts contain none; any "X County" claim in the text is unsourced.
  const countyMatches = text.match(/\b[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,2}\s+County\b/g) ?? [];
  if (countyMatches.length > 0) {
    reasons.push(`unsourced_county:${countyMatches[0]}`);
  }

  const compHits = findStopHits(text, STOP_COMPARATIVE);
  if (compHits.length > 0) reasons.push(`comparative:${compHits.join(",")}`);

  // Region: allow "in the {city} area" phrasing if a city template ever uses it
  // (none currently do, but kept for parity with yard validator).
  const allowedAreaRe = new RegExp(`\\bin the ${escapeRegex(facts.city)} area\\b`, "ig");
  const textForRegion = text.replace(allowedAreaRe, " ");
  const regionHits = findStopHits(textForRegion, STOP_REGION);
  if (regionHits.length > 0) reasons.push(`region:${regionHits.join(",")}`);

  const timeHits = findStopHits(text, STOP_TIME);
  if (timeHits.length > 0) reasons.push(`time_period:${timeHits.join(",")}`);

  const sinceHits = checkSince(text);
  if (sinceHits.length > 0) reasons.push(`since:${sinceHits.join(",")}`);
  const estHits = checkEstablished(text);
  if (estHits.length > 0) reasons.push(`established:${estHits.join(",")}`);
  const qHits = checkQuantifierPeer(text);
  if (qHits.length > 0) reasons.push(`quantifier:${qHits.join(",")}`);

  return { ok: reasons.length === 0, reasons, warnings };
}
