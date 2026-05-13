/**
 * Determine the visitor's consent region (opt-in / opt-out) from a
 * Next.js middleware request.
 *
 * Priority chain:
 *   1. Sec-GPC: 1                       → opt-out behavior (user signal)
 *      NOTE: Per Global Privacy Control, GPC is a request to opt OUT of
 *      sale/sharing of personal info. We still classify the *region* as
 *      opt-out (footer bar UX, not modal), but the consent default is
 *      forced to 'essential' rather than 'all' — handled at gating time.
 *   2. CF-IPCountry / x-vercel-ip-country / fastly-geo-country headers
 *   3. country.is HTTP lookup (cached) keyed on x-forwarded-for IP
 *   4. Safe default: 'opt-in' (GDPR-compliant)
 *
 * Dev override: ?region=opt-in|opt-out works in NODE_ENV !== 'production'.
 *
 * Returns the region plus a `gpc` flag so callers can apply the GPC
 * consent default ('essential') even though region itself may match the
 * user's geo.
 */
import type { NextRequest } from "next/server";
import { lookupCountry } from "./geo";
import { regionForCountry, type ConsentRegion } from "./regions";

export type RegionDecision = {
  region: ConsentRegion;
  gpc: boolean;
  source: "gpc" | "edge-header" | "geo-lookup" | "cookie" | "dev-override" | "default";
  country?: string;
};

const REGION_COOKIE = "sy_region";
const COUNTRY_HEADERS = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "fastly-geo-country",
  "x-country-code",
];

export async function determineRegion(request: NextRequest): Promise<RegionDecision> {
  const gpc = request.headers.get("sec-gpc") === "1";

  // 1. Dev override (non-production only)
  if (process.env.NODE_ENV !== "production") {
    const override = request.nextUrl.searchParams.get("region");
    if (override === "opt-in" || override === "opt-out") {
      return { region: override, gpc, source: "dev-override" };
    }
  }

  // 2. Cached cookie
  const cookieVal = request.cookies.get(REGION_COOKIE)?.value;
  if (cookieVal === "opt-in" || cookieVal === "opt-out") {
    return { region: cookieVal, gpc, source: "cookie" };
  }

  // 3. GPC short-circuit: skip geo lookup entirely
  if (gpc) {
    return { region: "opt-out", gpc, source: "gpc" };
  }

  // 4. Edge-provided country header
  for (const h of COUNTRY_HEADERS) {
    const cc = request.headers.get(h);
    if (cc && cc.length === 2) {
      return { region: regionForCountry(cc), gpc, source: "edge-header", country: cc.toUpperCase() };
    }
  }

  // 5. country.is HTTP lookup (with cache + 250ms timeout)
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0]?.trim();
  if (ip) {
    const cc = await lookupCountry(ip);
    if (cc) {
      return { region: regionForCountry(cc), gpc, source: "geo-lookup", country: cc };
    }
  }

  // 6. Final fallback: opt-in (safer)
  return { region: "opt-in", gpc, source: "default" };
}

export const REGION_COOKIE_NAME = REGION_COOKIE;
export const REGION_COOKIE_MAX_AGE = 60 * 60; // 1 hour
export const REGION_HEADER = "x-consent-region";
export const GPC_HEADER = "x-consent-gpc";
