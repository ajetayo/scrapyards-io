/**
 * Shared validator for yard descriptions, used by both
 * `generate-yard-descriptions.ts` (live validation) and
 * `retro-validate-v1.ts` (post-hoc check).
 *
 * v3 changes vs v2:
 *   - Yard-name token allowlist: stop-words present in the yard's own name
 *     (e.g. "Best American Recycling") are exempt for that yard.
 *   - `since`        — flag only when followed within 5 words by a 4-digit
 *                      year (1990-2030) OR a "for X years" pattern.
 *                      Allow as logical connector ("since the data isn't…").
 *   - `established`  — flag only when followed within 5 words by a year OR
 *                      by "in" + year. Allow descriptive use
 *                      ("ABC has established hours").
 *   - `many`/`most`/`few` — flag only when followed within 3 words by a
 *                      noun referring to the yard itself or its peer set
 *                      ("most yards", "many scrap dealers", "few competitors").
 *                      Allow enumeration of materials/services.
 *   - County normalization (St./Saint/punctuation) before compare.
 */

export const TARGET_WORDS_MIN = 150;
export const TARGET_WORDS_MAX = 250;

export type ValidatorFacts = {
  yard_id: number;
  name: string;
  city: string;
  state: string;
  zip: string | null;
  county?: string | null;
  county_known?: boolean;
};

export const BANNED_PHRASES: RegExp[] = [
  /trusted by the community/i,
  /best in the area/i,
  /competitive prices/i,
  /one[- ]stop shop/i,
  /look no further/i,
  /satisfaction guaranteed/i,
  /we pride ourselves/i,
  /state[- ]of[- ]the[- ]art/i,
  /family[- ]owned/i,
  /family business/i,
  /years of experience/i,
  /(since|founded in|established in) (18|19|20)\d{2}/i,
  /award[- ]winning/i,
  /\bcertified\b/i,
  /\blicensed\b/i,
];

export const BANNED_OPENERS: RegExp[] = [
  /^located (in|at)\b/i,
  /^founded\b/i,
  /^established\b/i,
  /^welcome to\b/i,
];

// Comparative / superlative claims (whole-word matches).
// `since`, `established`, `many`, `most`, `few` are NOT in this blanket list —
// they have context-aware checks below.
export const STOP_COMPARATIVE = [
  "compared to",
  "larger than",
  "smaller than",
  "more than",
  "less than",
  "limited",
  "extensive",
  "vast",
  "best",
  "worst",
  "leading",
  "premier",
  "well-known",
  "well known",
  "longtime",
  "trusted",
  "reliable",
];

// Region / geography descriptors not in facts.
export const STOP_REGION = [
  "metro area",
  "metropolitan",
  "downtown",
  "uptown",
  "suburban",
  "rural",
  "north side",
  "south side",
  "east side",
  "west side",
  "outskirts",
  "the area",
  "this area",
  "the region",
];

// Time-period claims (blanket — `since` and `established` handled separately).
export const STOP_TIME = ["for over", "for many years", "decades", "founded"];

// Nouns that, when following many/most/few within 3 words, indicate a peer-set
// or self-reference (a hallucination class). When followed by these, the
// quantifier IS flagged. When followed by anything else (e.g. material types),
// allowed as enumeration.
const PEER_NOUNS = new Set([
  "yard", "yards",
  "scrapyard", "scrapyards", "scrap-yard", "scrap-yards",
  "dealer", "dealers",
  "buyer", "buyers",
  "operator", "operators",
  "competitor", "competitors",
  "facility", "facilities",
  "business", "businesses",
  "shop", "shops",
  "center", "centers", "centre", "centres",
  "company", "companies",
  "recycler", "recyclers",
  "processor", "processors",
]);

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function stopRegex(term: string): RegExp {
  return new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
}

function yardNameTokens(name: string): Set<string> {
  // Tokenize the yard name into lowercased word tokens (3+ chars, alphabetic).
  // Used as a per-yard allowlist for stop-list checks.
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((t) => t.length >= 3),
  );
}

function findStopHits(text: string, terms: string[], allowed: Set<string>): string[] {
  const hits: string[] = [];
  for (const term of terms) {
    if (allowed.has(term.toLowerCase())) continue;
    if (stopRegex(term).test(text)) hits.push(term);
  }
  return hits;
}

// ---- Context-aware checks for narrowed stop-words ----

/**
 * `since` only fails when followed within 5 words by:
 *   - a 4-digit year 1990-2030, or
 *   - "for X years" pattern
 * Otherwise it passes (e.g. "since the materials list isn't on file").
 */
export function checkSince(text: string, allowed: Set<string>): string[] {
  if (allowed.has("since")) return [];
  const hits: string[] = [];
  const re = /\bsince\b\s+((?:\S+\s+){0,4}\S+)/gi;
  for (const m of text.matchAll(re)) {
    const tail = m[1] ?? "";
    if (/\b(199\d|20[0-2]\d|2030)\b/.test(tail)) {
      hits.push("since+year");
    } else if (/\bfor\s+\w+\s+years?\b/i.test(tail)) {
      hits.push("since+for-X-years");
    }
  }
  return hits;
}

/**
 * `established` only fails when followed within 5 words by a year OR by
 * "in" + year. "established hours" passes.
 */
export function checkEstablished(text: string, allowed: Set<string>): string[] {
  if (allowed.has("established")) return [];
  const hits: string[] = [];
  const re = /\bestablished\b\s+((?:\S+\s+){0,4}\S+)/gi;
  for (const m of text.matchAll(re)) {
    const tail = m[1] ?? "";
    if (/\b(199\d|20[0-2]\d|2030)\b/.test(tail)) {
      hits.push("established+year");
    } else if (/\bin\s+(199\d|20[0-2]\d|2030)\b/i.test(tail)) {
      hits.push("established+in-year");
    }
  }
  return hits;
}

/**
 * `many`/`most`/`few` only fail when followed within 3 words by a peer-noun.
 */
export function checkQuantifierPeer(text: string, allowed: Set<string>): string[] {
  const hits: string[] = [];
  for (const q of ["many", "most", "few"]) {
    if (allowed.has(q)) continue;
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

// ---- County normalization ----

/**
 * Normalize a county name for comparison:
 *   - lowercase
 *   - "st." / "st " / "saint" → "saint"
 *   - strip trailing " county"
 *   - strip non-alphanumeric (keep spaces collapsed)
 */
export function normalizeCounty(s: string): string {
  let n = s.toLowerCase().trim();
  n = n.replace(/\bst\.?\s+/g, "saint ");
  n = n.replace(/\s+county\s*$/g, "");
  n = n.replace(/[^a-z0-9\s]/g, " ");
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

// ---- Main validator ----

export type ValidationResult = {
  ok: boolean;
  reasons: string[];
  warnings: string[];
};

export function validateDescription(text: string, facts: ValidatorFacts): ValidationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const allowed = yardNameTokens(facts.name);

  // Word count
  const wc = countWords(text);
  if (wc < TARGET_WORDS_MIN || wc > TARGET_WORDS_MAX) {
    reasons.push(`word_count_out_of_range:${wc}`);
  }

  // Banned phrases
  for (const re of BANNED_PHRASES) {
    if (re.test(text)) reasons.push(`banned_phrase:${re.source}`);
  }
  for (const re of BANNED_OPENERS) {
    if (re.test(text.trim())) reasons.push(`banned_opener:${re.source}`);
  }

  // Unsourced digits
  const factsBlob = JSON.stringify(facts);
  const digitRuns = text.match(/\d+/g) ?? [];
  const unsourced = digitRuns.filter((d) => !factsBlob.includes(d));
  if (unsourced.length > 0) {
    reasons.push(`unsourced_digits:${unsourced.slice(0, 5).join(",")}`);
  }

  // Yard name repetition (>2 times)
  const nameRe = new RegExp(escapeRegex(facts.name), "g");
  const nameOcc = (text.match(nameRe) ?? []).length;
  if (nameOcc > 2) reasons.push(`name_repeated:${nameOcc}x`);

  // County check (with normalization). Catches "X County" AND "Saint X" / "St. X".
  const knownCounty = facts.county_known && facts.county ? facts.county : null;
  const knownNorm = knownCounty ? normalizeCounty(knownCounty) : null;
  const countyMatches = [
    ...text.matchAll(/\b([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,2})\s+County\b/g),
  ];
  for (const m of countyMatches) {
    const mentioned = m[1]!;
    const mNorm = normalizeCounty(mentioned + " county");
    if (!knownNorm) {
      reasons.push(`unsourced_county:${mentioned}`);
    } else if (mNorm !== knownNorm) {
      reasons.push(`wrong_county:${mentioned}_vs_${knownCounty}`);
    }
  }
  // Bare "Saint X" / "St. X" without explicit "County" — still a county claim
  // when the known county uses Saint/St. AND the description names a different
  // saint-city. Skip if known county doesn't use saint, to avoid catching
  // generic "Saint Louis" when the city itself is St. Louis.

  // Comparative blanket
  const compHits = findStopHits(text, STOP_COMPARATIVE, allowed);
  if (compHits.length > 0) reasons.push(`comparative:${compHits.join(",")}`);

  // Region (with "in the {city} area" exception)
  const allowedAreaRe = new RegExp(`\\bin the ${escapeRegex(facts.city)} area\\b`, "ig");
  const textForRegion = text.replace(allowedAreaRe, " ");
  const regionHits = findStopHits(textForRegion, STOP_REGION, allowed);
  if (regionHits.length > 0) reasons.push(`region:${regionHits.join(",")}`);

  // Time blanket
  const timeHits = findStopHits(text, STOP_TIME, allowed);
  if (timeHits.length > 0) reasons.push(`time_period:${timeHits.join(",")}`);

  // Context-aware narrowed checks
  const sinceHits = checkSince(text, allowed);
  if (sinceHits.length > 0) reasons.push(`since:${sinceHits.join(",")}`);
  const estHits = checkEstablished(text, allowed);
  if (estHits.length > 0) reasons.push(`established:${estHits.join(",")}`);
  const qHits = checkQuantifierPeer(text, allowed);
  if (qHits.length > 0) reasons.push(`quantifier:${qHits.join(",")}`);

  return { ok: reasons.length === 0, reasons, warnings };
}
