/**
 * Validator wrapper for metal-page content. Reuses the v3 stop-list from
 * `yard-desc-validator.ts` with a metal-page-appropriate facts blob:
 *   - For national content: facts include metal name, category, unit.
 *   - For state content: facts also include state name and state code.
 *
 * Differences from yard validation:
 *   - Word-count band depends on content type (drivers/grade/state).
 *   - Skip the name-repetition check (metal name appearing 4-5 times in a
 *     200-word block is normal and reads fine).
 *   - County checks are dropped (no county data on metal pages).
 *   - State-page content MUST mention the state name at least once
 *     (region-mention check).
 */
import {
  BANNED_PHRASES,
  BANNED_OPENERS,
  STOP_COMPARATIVE,
  STOP_REGION,
  STOP_TIME,
  countWords,
  escapeRegex,
  checkSince,
  checkEstablished,
  checkQuantifierPeer,
} from "./yard-desc-validator.js";

export type ContentType = "market_drivers" | "grade_differences" | "market_context";

const WORD_BANDS: Record<ContentType, [number, number]> = {
  market_drivers: [80, 220],
  grade_differences: [60, 180],
  market_context: [80, 220],
};

export type MetalContentFacts = {
  metal_name: string;
  category_name: string;
  unit: string;
  state_name?: string;
  state_code?: string;
};

export type MetalValidationResult = {
  ok: boolean;
  reasons: string[];
  word_count: number;
};

function stopRegex(term: string): RegExp {
  return new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
}

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z]+/).filter((t) => t.length >= 3));
}

export function validateMetalContent(
  text: string,
  type: ContentType,
  facts: MetalContentFacts,
): MetalValidationResult {
  const reasons: string[] = [];
  const allowed = new Set<string>([
    ...tokens(facts.metal_name),
    ...tokens(facts.category_name),
    ...(facts.state_name ? tokens(facts.state_name) : []),
  ]);

  // Word count
  const wc = countWords(text);
  const [min, max] = WORD_BANDS[type];
  if (wc < min || wc > max) {
    reasons.push(`word_count_out_of_range:${wc}(want ${min}-${max})`);
  }

  // Banned phrases / openers
  for (const re of BANNED_PHRASES) {
    if (re.test(text)) reasons.push(`banned_phrase:${re.source}`);
  }
  for (const re of BANNED_OPENERS) {
    if (re.test(text.trim())) reasons.push(`banned_opener:${re.source}`);
  }

  // Comparative stop-list (apply allowlist for tokens in metal/state names)
  for (const term of STOP_COMPARATIVE) {
    if (allowed.has(term.toLowerCase())) continue;
    if (stopRegex(term).test(text)) reasons.push(`comparative:${term}`);
  }

  // Region stop-list (no facts.city — apply blanket)
  for (const term of STOP_REGION) {
    if (allowed.has(term.toLowerCase())) continue;
    if (stopRegex(term).test(text)) reasons.push(`region:${term}`);
  }

  // Time stop-list
  for (const term of STOP_TIME) {
    if (allowed.has(term.toLowerCase())) continue;
    if (stopRegex(term).test(text)) reasons.push(`time:${term}`);
  }

  // Unsourced digits — flag any digit run not present in facts blob
  const factsBlob = JSON.stringify(facts);
  const digitRuns = text.match(/\d+/g) ?? [];
  const unsourced = digitRuns.filter((d) => !factsBlob.includes(d));
  if (unsourced.length > 0) {
    reasons.push(`unsourced_digits:${unsourced.slice(0, 5).join(",")}`);
  }

  // State pages must mention the state name
  if (type === "market_context" && facts.state_name) {
    const re = new RegExp(`\\b${escapeRegex(facts.state_name)}\\b`, "i");
    if (!re.test(text)) reasons.push("state_name_missing");
  }

  // Context-aware unsourced-claim checks (v3 logic): "since/established"
  // followed by a year, and many/most/few followed by a peer-noun.
  for (const h of checkSince(text, allowed)) reasons.push(`since_context:${h}`);
  for (const h of checkEstablished(text, allowed)) reasons.push(`established_context:${h}`);
  for (const h of checkQuantifierPeer(text, allowed)) reasons.push(`quantifier_peer:${h}`);

  return { ok: reasons.length === 0, reasons, word_count: wc };
}

export function validateFaq(faq: Array<{ q: string; a: string }>, facts: MetalContentFacts): MetalValidationResult {
  // FAQ uses looser rules — each Q+A is a short paragraph. We concatenate
  // and run the comparative/region/time/banned-phrase checks against the
  // joined text. Word count is lenient (50-700 across all Q&As).
  const text = faq.map((p) => `${p.q} ${p.a}`).join(" ");
  const reasons: string[] = [];
  const allowed = new Set<string>([
    ...tokens(facts.metal_name),
    ...tokens(facts.category_name),
  ]);

  const wc = countWords(text);
  if (wc < 50 || wc > 700) reasons.push(`faq_word_count:${wc}`);
  if (faq.length < 5 || faq.length > 7) reasons.push(`faq_count:${faq.length}`);

  for (const re of BANNED_PHRASES) {
    if (re.test(text)) reasons.push(`banned_phrase:${re.source}`);
  }
  for (const term of STOP_COMPARATIVE) {
    if (allowed.has(term.toLowerCase())) continue;
    if (stopRegex(term).test(text)) reasons.push(`comparative:${term}`);
  }
  for (const term of STOP_TIME) {
    if (allowed.has(term.toLowerCase())) continue;
    if (stopRegex(term).test(text)) reasons.push(`time:${term}`);
  }

  const factsBlob = JSON.stringify(facts);
  const digitRuns = text.match(/\d+/g) ?? [];
  const unsourced = digitRuns.filter((d) => !factsBlob.includes(d));
  if (unsourced.length > 0) reasons.push(`unsourced_digits:${unsourced.slice(0, 5).join(",")}`);

  for (const h of checkSince(text, allowed)) reasons.push(`since_context:${h}`);
  for (const h of checkEstablished(text, allowed)) reasons.push(`established_context:${h}`);
  for (const h of checkQuantifierPeer(text, allowed)) reasons.push(`quantifier_peer:${h}`);

  return { ok: reasons.length === 0, reasons, word_count: wc };
}
