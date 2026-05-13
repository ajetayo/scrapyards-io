/**
 * Region classification for cookie-consent UX.
 *
 * - opt-in: GDPR-style modal. Tracking OFF until explicit consent.
 * - opt-out: US-style footer bar. Tracking ON by default; user may opt out.
 *
 * Sec-GPC: 1 from any region is upgraded to opt-out behavior (i.e. user
 * is signaling DO NOT SELL/SHARE — we treat as if they chose 'essential').
 */

export type ConsentRegion = "opt-in" | "opt-out";

/**
 * ISO 3166-1 alpha-2 country codes treated as opt-in (GDPR / UK GDPR /
 * Swiss FADP / Brazil LGPD).
 */
export const OPT_IN_COUNTRIES: ReadonlySet<string> = new Set([
  // EU member states (27)
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA non-EU + UK + Switzerland
  "GB", "IS", "LI", "NO", "CH",
  // Brazil (LGPD)
  "BR",
]);

export function regionForCountry(countryCode: string | null | undefined): ConsentRegion {
  if (!countryCode) return "opt-in"; // safe default per spec
  return OPT_IN_COUNTRIES.has(countryCode.toUpperCase()) ? "opt-in" : "opt-out";
}
