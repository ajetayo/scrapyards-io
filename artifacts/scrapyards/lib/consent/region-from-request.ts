/**
 * Determine the visitor's consent region (opt-in / opt-out) from a
 * Next.js middleware request.
 *
 * Priority chain (live data WINS — sy_region cookie is a fallback-only
 * detection cache, never authoritative; sy_consent is the user's actual
 * choice and is read elsewhere):
 *
 *   1. Sec-GPC: 1                       → opt-out (user signal, persisted)
 *   2. ?region= dev override            → respected, NOT persisted
 *   3. CF-IPCountry / x-vercel-ip-country / fastly-geo-country edge
 *      header                            → persisted
 *   4. country.is HTTP lookup            → persisted ONLY on success
 *   5. sy_region cookie                  → fallback when 3 + 4 fail
 *   6. Default 'opt-in' (safer)         → NOT persisted
 *
 * Why cookie is now last among real signals:
 * Live edge geo data is always more accurate than a cached value from a
 * prior request. A US visitor whose first hit fell through to the safe
 * `opt-in` default (e.g. transient country.is timeout, or hit
 * ?region=opt-in for testing) used to get a sticky `sy_region=opt-in`
 * cookie that overrode accurate live detection for an hour. That's the
 * exact bug we're fixing — see the regression test in
 * `region-from-request.test.ts`.
 *
 * `persist` controls whether middleware should write the resolved value
 * back into the sy_region cookie. Only branches with a *real* signal
 * (GPC, edge header, successful geo) persist. Dev override and the
 * safe-default fallback never persist.
 */
import type { NextRequest } from "next/server";
import { lookupCountry } from "./geo";
import { regionForCountry, type ConsentRegion } from "./regions";

export type RegionDecision = {
  region: ConsentRegion;
  gpc: boolean;
  source: "gpc" | "edge-header" | "geo-lookup" | "cookie" | "dev-override" | "default";
  country?: string;
  persist: boolean;
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

  // 1. GPC — legally meaningful user signal, overrides everything.
  if (gpc) {
    return { region: "opt-out", gpc, source: "gpc", persist: true };
  }

  // 2. Dev override (non-prod only). NEVER persisted — caching a test
  //    override into a 1-hour cookie was the original poisoning vector.
  if (process.env.NODE_ENV !== "production") {
    const override = request.nextUrl.searchParams.get("region");
    if (override === "opt-in" || override === "opt-out") {
      return { region: override, gpc, source: "dev-override", persist: false };
    }
  }

  // 3. Edge-provided country header (Cloudflare / Vercel / Fastly). Live
  //    and authoritative — always preferred over cached cookie.
  for (const h of COUNTRY_HEADERS) {
    const cc = request.headers.get(h);
    if (cc && cc.length === 2) {
      return {
        region: regionForCountry(cc),
        gpc,
        source: "edge-header",
        country: cc.toUpperCase(),
        persist: true,
      };
    }
  }

  // 4. country.is HTTP lookup (in-memory cache + 1500ms timeout).
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0]?.trim();
  if (ip) {
    const cc = await lookupCountry(ip);
    if (cc) {
      return {
        region: regionForCountry(cc),
        gpc,
        source: "geo-lookup",
        country: cc,
        persist: true,
      };
    }
  }

  // 5. Cached cookie from a previous successful detection. Only used
  //    when live detection (3 + 4) failed — the cookie is now a
  //    fallback, not a short-circuit.
  const cookieVal = request.cookies.get(REGION_COOKIE)?.value;
  if (cookieVal === "opt-in" || cookieVal === "opt-out") {
    return { region: cookieVal, gpc, source: "cookie", persist: false };
  }

  // 6. Final fallback. NOT persisted — caching a guess defeats the
  //    point of guessing.
  return { region: "opt-in", gpc, source: "default", persist: false };
}

export const REGION_COOKIE_NAME = REGION_COOKIE;
export const REGION_COOKIE_MAX_AGE = 60 * 60; // 1 hour
export const REGION_HEADER = "x-consent-region";
export const GPC_HEADER = "x-consent-gpc";
