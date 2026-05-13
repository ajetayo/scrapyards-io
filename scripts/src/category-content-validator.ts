/**
 * Validator wrapper for metal-category content. Reuses the v3 stop-list from
 * `yard-desc-validator.ts` with category-page-appropriate facts.
 *
 * Differences from grade-page validation (`metal-content-validator.ts`):
 *   - Adds an `about` content type with the same band as market_drivers.
 *   - Facts include `grade_names[]` and optional `purity_marks` so digit
 *     runs inside grade names (e.g. "#1 Copper", "(.999)", "(304)") and
 *     purity marks pass the unsourced-digits check.
 *   - Skips the metal name-repetition check (category names appear several
 *     times per block and read fine).
 *   - Extra SOFT WARNING: `checkGradeMention` reports when none of the
 *     category's grade names appear in market_drivers_md or
 *     grade_comparison_md. Used by the generator to log a warning, not to
 *     fail validation. Catches generic-sounding content that could apply
 *     to any category.
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

export type CategoryContentType = "about" | "market_drivers" | "grade_comparison";

const WORD_BANDS: Record<CategoryContentType, [number, number]> = {
  about: [80, 220],
  market_drivers: [80, 220],
  grade_comparison: [60, 180],
};

export type CategoryContentFacts = {
  category_name: string;
  category_slug: string;
  family: string;
  grade_names: string[];
  purity_marks?: string;
};

export type CategoryValidationResult = {
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

function buildAllowed(facts: CategoryContentFacts): Set<string> {
  const allowed = new Set<string>([
    ...tokens(facts.category_name),
    ...tokens(facts.category_slug.replace(/-/g, " ")),
  ]);
  for (const g of facts.grade_names) {
    for (const t of tokens(g)) allowed.add(t);
  }
  return allowed;
}

export function validateCategoryContent(
  text: string,
  type: CategoryContentType,
  facts: CategoryContentFacts,
): CategoryValidationResult {
  const reasons: string[] = [];
  const allowed = buildAllowed(facts);

  const wc = countWords(text);
  const [min, max] = WORD_BANDS[type];
  if (wc < min || wc > max) {
    reasons.push(`word_count_out_of_range:${wc}(want ${min}-${max})`);
  }

  for (const re of BANNED_PHRASES) {
    if (re.test(text)) reasons.push(`banned_phrase:${re.source}`);
  }
  for (const re of BANNED_OPENERS) {
    if (re.test(text.trim())) reasons.push(`banned_opener:${re.source}`);
  }

  for (const term of STOP_COMPARATIVE) {
    if (allowed.has(term.toLowerCase())) continue;
    if (stopRegex(term).test(text)) reasons.push(`comparative:${term}`);
  }

  for (const term of STOP_REGION) {
    if (allowed.has(term.toLowerCase())) continue;
    if (stopRegex(term).test(text)) reasons.push(`region:${term}`);
  }

  for (const term of STOP_TIME) {
    if (allowed.has(term.toLowerCase())) continue;
    if (stopRegex(term).test(text)) reasons.push(`time:${term}`);
  }

  // Unsourced digits — facts blob includes grade_names and optional purity_marks
  const factsBlob = JSON.stringify(facts);
  const digitRuns = text.match(/\d+/g) ?? [];
  const unsourced = digitRuns.filter((d) => !factsBlob.includes(d));
  if (unsourced.length > 0) {
    reasons.push(`unsourced_digits:${unsourced.slice(0, 5).join(",")}`);
  }

  for (const h of checkSince(text, allowed)) reasons.push(`since_context:${h}`);
  for (const h of checkEstablished(text, allowed)) reasons.push(`established_context:${h}`);
  for (const h of checkQuantifierPeer(text, allowed)) reasons.push(`quantifier_peer:${h}`);

  return { ok: reasons.length === 0, reasons, word_count: wc };
}

export function validateCategoryFaq(
  faq: Array<{ q: string; a: string }>,
  facts: CategoryContentFacts,
): CategoryValidationResult {
  const text = faq.map((p) => `${p.q} ${p.a}`).join(" ");
  const reasons: string[] = [];
  const allowed = buildAllowed(facts);

  const wc = countWords(text);
  if (wc < 50 || wc > 1200) reasons.push(`faq_word_count:${wc}`);
  if (faq.length < 5 || faq.length > 7) reasons.push(`faq_count:${faq.length}`);

  for (const re of BANNED_PHRASES) {
    if (re.test(text)) reasons.push(`banned_phrase:${re.source}`);
  }
  for (const re of BANNED_OPENERS) {
    // FAQ questions naturally start with "Where", "How", etc. — only check answers
    // for opener bans by scanning each answer separately.
    for (const p of faq) {
      if (re.test(p.a.trim())) reasons.push(`banned_opener_in_answer:${re.source}`);
    }
  }
  for (const term of STOP_COMPARATIVE) {
    if (allowed.has(term.toLowerCase())) continue;
    if (stopRegex(term).test(text)) reasons.push(`comparative:${term}`);
  }
  for (const term of STOP_REGION) {
    if (allowed.has(term.toLowerCase())) continue;
    if (stopRegex(term).test(text)) reasons.push(`region:${term}`);
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

/**
 * SOFT WARNING — does the text mention at least one of the category's actual
 * grade names? Used to flag generic-sounding content that could apply to any
 * category. Returns true when at least one grade name appears in the text.
 */
export function checkGradeMention(text: string, grade_names: string[]): boolean {
  const lower = text.toLowerCase();
  for (const g of grade_names) {
    if (lower.includes(g.toLowerCase())) return true;
  }
  return false;
}
