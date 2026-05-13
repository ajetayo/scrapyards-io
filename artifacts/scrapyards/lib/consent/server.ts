/**
 * Server-side helpers for reading the consent state set by middleware.
 *
 * - getRegion(): reads x-consent-region from request headers (set by
 *   middleware). Falls back to 'opt-in' if absent (e.g. when middleware
 *   is bypassed for /api/_next paths — those pages don't render consent
 *   UI anyway).
 * - getConsent(): reads sy_consent cookie ('all' | 'essential' | undefined).
 * - shouldFireTracking(): canonical gate used by Analytics + AdSenseUnit.
 *     consent === 'all'                                       → true
 *     consent === 'essential'                                 → false
 *     consent === undefined && region === 'opt-out' && !gpc   → true
 *     consent === undefined && region === 'opt-in'            → false
 *     consent === undefined && gpc === true                   → false
 */
import { cookies, headers } from "next/headers";
import {
  REGION_HEADER,
  GPC_HEADER,
} from "./region-from-request";
import type { ConsentRegion } from "./regions";

const CONSENT_COOKIE = "sy_consent";

export type ConsentValue = "all" | "essential" | undefined;

export async function getRegion(): Promise<ConsentRegion> {
  const h = await headers();
  const v = h.get(REGION_HEADER);
  return v === "opt-out" ? "opt-out" : "opt-in";
}

export async function getGpc(): Promise<boolean> {
  const h = await headers();
  return h.get(GPC_HEADER) === "1";
}

export async function getConsent(): Promise<ConsentValue> {
  const c = await cookies();
  const v = c.get(CONSENT_COOKIE)?.value;
  if (v === "all" || v === "essential") return v;
  return undefined;
}

// Common crawler/bot UAs. Conservative list — covers Googlebot, Bingbot,
// social previewers, AdsBot, monitoring/uptime services. We never fire
// analytics/ads markup for these to (a) keep crawl budget clean, (b) avoid
// inflating GA traffic numbers, (c) not require consent decisions for
// non-human traffic.
const BOT_UA_RE =
  /bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview|duckduckbot|baiduspider|yandex|sogou|exabot|ia_archiver|adsbot|mediapartners|petalbot|semrush|ahrefs|mj12bot|dotbot|pingdom|uptimerobot|gtmetrix|lighthouse|headlesschrome|chrome-lighthouse|google-pagespeed/i;

export async function isBot(): Promise<boolean> {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  return BOT_UA_RE.test(ua);
}

export async function shouldFireTracking(): Promise<boolean> {
  if (await isBot()) return false;
  const [region, gpc, consent] = await Promise.all([getRegion(), getGpc(), getConsent()]);
  if (consent === "all") return true;
  if (consent === "essential") return false;
  // No explicit consent yet — region default applies.
  if (gpc) return false;
  return region === "opt-out";
}

export const CONSENT_COOKIE_NAME = CONSENT_COOKIE;
