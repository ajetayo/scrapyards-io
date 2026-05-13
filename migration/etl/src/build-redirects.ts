// Pure (in-memory) builder for the full set of legacy redirects. Operates on
// transform output + canonical seeds — no DB required. Used by sql-writer to
// embed INSERTs in 03-staging-import.sql, and by redirects.ts for the CSV.
import fs from "node:fs";
import type { CityRow, YardRow } from "./transform.js";
import { STATES } from "./states.js";
import { METALS } from "./metals.js";

export interface Redirect { source: string; target: string; status: 200 | 301 | 302; }

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    let p = u.pathname || "/";
    if (!p.endsWith("/")) p += "/";
    return p;
  } catch {
    return url.endsWith("/") ? url : url + "/";
  }
}

// Spec §B1 — only these state slugs ever appear with "-N" in the dump.
const STATE_SLUG_ALIASES: Record<string, string> = {
  "delaware-2": "delaware", "indiana-1": "indiana", "kansas-1": "kansas",
  "michigan-1": "michigan", "nevada-2": "nevada", "north-dakota-1": "north-dakota",
  "south-dakota-1": "south-dakota", "virginia-2": "virginia", "washington-7": "washington",
};
function stripSuffix(s: string): string { return s.replace(/-\d+$/, ""); }

function resolveGscPath(
  p: string,
  yards: Set<string>, cities: Set<string>, states: Set<string>, metals: Set<string>,
  canonicalByLegacyUrl: Map<string, string>,
): string {
  if (p === "/" || p === "") return "/";
  const yardHit = canonicalByLegacyUrl.get(p);
  if (yardHit) return yardHit;
  const sv = p.match(/^\/services\/united-states\/([^/]+)\/([^/]+)(?:\/([^/]+)(?:\/([^/]+))?)?\/?$/);
  if (sv) {
    const stateRaw = sv[1]!;
    const cityRaw = sv[2]!;
    const yardRaw = sv[4];
    // Normalize per spec §B1: strip state alias, always strip city suffix,
    // strip yard suffix only if cleaned slug exists.
    const stateSlug = STATE_SLUG_ALIASES[stateRaw] ?? stateRaw;
    const citySlug = stripSuffix(cityRaw);
    if (yardRaw) {
      const litYardPath = `/scrap-yards/${stateSlug}/${citySlug}/${yardRaw}/`;
      if (yards.has(litYardPath)) return litYardPath;
      const cleanYard = stripSuffix(yardRaw);
      if (cleanYard !== yardRaw) {
        const cleanYardPath = `/scrap-yards/${stateSlug}/${citySlug}/${cleanYard}/`;
        if (yards.has(cleanYardPath)) return cleanYardPath;
      }
    }
    const cityPath = `/scrap-yards/${stateSlug}/${citySlug}/`;
    if (cities.has(cityPath)) return cityPath;
    const statePath = `/scrap-yards/${stateSlug}/`;
    if (states.has(statePath)) return statePath;
    return "/scrap-yards/";
  }
  // P4/P5: /services/category/<cat>/united-states/<state>/<city>?/
  const catPat = p.match(/^\/services\/category\/[^/]+\/united-states\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (catPat) {
    const stateRaw = catPat[1]!;
    const cityRaw = catPat[2];
    const stateSlug = STATE_SLUG_ALIASES[stateRaw] ?? stateRaw;
    if (cityRaw) {
      const cityPath = `/scrap-yards/${stateSlug}/${stripSuffix(cityRaw)}/`;
      if (cities.has(cityPath)) return cityPath;
    }
    const statePath = `/scrap-yards/${stateSlug}/`;
    if (states.has(statePath)) return statePath;
    return "/scrap-yards/";
  }
  // Bare /services/united-states/<state>/ (single segment)
  const stateOnly = p.match(/^\/services\/united-states\/([^/]+)\/?$/);
  if (stateOnly) {
    const stateSlug = STATE_SLUG_ALIASES[stateOnly[1]!] ?? stateOnly[1]!;
    const statePath = `/scrap-yards/${stateSlug}/`;
    if (states.has(statePath)) return statePath;
    return "/scrap-yards/";
  }
  if (p.startsWith("/services/")) return "/scrap-yards/";
  const bm = p.match(/^\/blog\/metal\/([^/]+)\/?$/);
  if (bm) {
    const metalPath = `/scrap-metal-prices/${bm[1]}/`;
    if (metals.has(metalPath)) return metalPath;
    return "/scrap-metal-prices/";
  }
  if (p.startsWith("/blog/")) return "/scrap-metal-prices/";
  if (p.startsWith("/scrap-yards/")) {
    if (yards.has(p) || cities.has(p) || states.has(p)) return p;
    const parts = p.replace(/^\/|\/$/g, "").split("/");
    while (parts.length > 1) {
      parts.pop();
      const candidate = "/" + parts.join("/") + "/";
      if (yards.has(candidate) || cities.has(candidate) || states.has(candidate)) return candidate;
    }
    return "/scrap-yards/";
  }
  if (p.startsWith("/scrap-metal-prices/") || p.startsWith("/scrap-prices/")) {
    const m = p.match(/^\/(?:scrap-prices|scrap-metal-prices)\/([^/]+)\/?$/);
    if (m) {
      const candidate = `/scrap-metal-prices/${m[1]}/`;
      if (metals.has(candidate)) return candidate;
    }
    if (metals.has(p)) return p;
    return "/scrap-metal-prices/";
  }
  return "/";
}

function dedupeRedirects(items: Redirect[]): Redirect[] {
  const seen = new Map<string, Redirect>();
  for (const r of items) {
    const row: Redirect = r.source === r.target ? { ...r, status: 200 } : r;
    if (!seen.has(row.source)) seen.set(row.source, row);
  }
  return [...seen.values()].sort((a, b) => a.source.localeCompare(b.source));
}

export interface BuildRedirectsInput {
  cities: CityRow[];
  yards: YardRow[];
  gscPaths: string[];
}

export interface BuildRedirectsResult {
  all: Redirect[];                 // full set (synthetic + canonical + losers + GSC)
  gscOnly: Redirect[];             // CSV deliverable: 1 row per GSC URL
  knownYardPaths: Set<string>;
  knownCityPaths: Set<string>;
  knownStatePaths: Set<string>;
  knownMetalPaths: Set<string>;
  canonicalByLegacyUrl: Map<string, string>;
}

export function buildRedirects(input: BuildRedirectsInput): BuildRedirectsResult {
  const { cities, yards, gscPaths } = input;

  const stateSlugByCode = new Map(STATES.map((s) => [s.code, s.slug]));
  const citySlugById = new Map<number, { state_code: string; slug: string }>();
  for (const c of cities) citySlugById.set(c._id, { state_code: c.state_code, slug: c.slug });

  const knownStatePaths = new Set(STATES.map((s) => `/scrap-yards/${s.slug}/`));
  const knownCityPaths = new Set(cities.map((c) => `/scrap-yards/${stateSlugByCode.get(c.state_code)}/${c.slug}/`));
  const knownYardPaths = new Set<string>();
  const canonicalByLegacyUrl = new Map<string, string>();
  for (const y of yards) {
    const stateSlug = stateSlugByCode.get(y.state_code);
    const cityRef = citySlugById.get(y.city_id);
    if (!stateSlug || !cityRef) continue;
    const p = `/scrap-yards/${stateSlug}/${cityRef.slug}/${y.slug}/`;
    knownYardPaths.add(p);
    if (y.legacy_url) canonicalByLegacyUrl.set(pathOf(y.legacy_url), p);
  }
  const knownMetalPaths = new Set(METALS.map((m) => `/scrap-metal-prices/${m.slug}/`));

  const redirects: Redirect[] = [];

  // R0. Synthetic parents.
  redirects.push({ source: "/services/", target: "/scrap-yards/", status: 301 });
  redirects.push({ source: "/services/united-states/", target: "/scrap-yards/", status: 301 });
  redirects.push({ source: "/scrap-prices/", target: "/scrap-metal-prices/", status: 301 });
  redirects.push({ source: "/blog/", target: "/scrap-metal-prices/", status: 301 });
  redirects.push({ source: "/blog/metal/", target: "/scrap-metal-prices/", status: 301 });

  // R1. Canonical winner legacy URLs.
  for (const [src, tgt] of canonicalByLegacyUrl) {
    redirects.push({ source: src, target: tgt, status: 301 });
  }

  // R2. Dedupe LOSERS.
  for (const y of yards) {
    const winnerCanon = canonicalByLegacyUrl.get(pathOf(y.legacy_url));
    if (!winnerCanon) continue;
    for (const loser of y._losers) {
      const src = `/services/united-states/${loser.old_state_slug}/${loser.old_city_slug}/${loser.primary_cat}/${loser.raw_slug}/`;
      redirects.push({ source: src, target: winnerCanon, status: 301 });
    }
  }

  // R3. GSC sweep.
  for (const p of gscPaths) {
    const tgt = resolveGscPath(p, knownYardPaths, knownCityPaths, knownStatePaths, knownMetalPaths, canonicalByLegacyUrl);
    redirects.push({ source: p, target: tgt, status: 301 });
  }

  const all = dedupeRedirects(redirects);
  const gscSet = new Set(gscPaths);
  const gscOnly = all.filter((r) => gscSet.has(r.source));

  // Hard checks.
  const missing = [...gscSet].filter((p) => !gscOnly.some((r) => r.source === p));
  if (missing.length > 0) {
    throw new Error(`[build-redirects] FATAL: ${missing.length} GSC URLs missing: ${missing.slice(0, 5).join(", ")}…`);
  }

  return { all, gscOnly, knownYardPaths, knownCityPaths, knownStatePaths, knownMetalPaths, canonicalByLegacyUrl };
}

export function readGscPaths(gscFile: string): string[] {
  if (!fs.existsSync(gscFile)) {
    console.warn(`[build-redirects] no GSC file at ${gscFile} — skipping`);
    return [];
  }
  const txt = fs.readFileSync(gscFile, "utf8");
  const out: string[] = [];
  for (const ln of txt.split(/\r?\n/)) {
    const t = ln.trim();
    if (!t) continue;
    if (t.toLowerCase().startsWith("top pages")) continue;
    const url = t.split(",")[0]!.replace(/^"|"$/g, "");
    if (!/^https?:\/\//i.test(url)) continue;
    out.push(pathOf(url));
  }
  return out;
}
