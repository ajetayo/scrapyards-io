// Core transformation: source rows → deduped, slug-resolved yard records.

import { STATE_BY_NAME, type StateRow, normalizeStateSlug, STATE_BY_SLUG } from "./states.js";
import { bucketize, METAL_TO_CATEGORY } from "./categories.js";
import {
  cleanEmail, cleanLatLng, cleanPhone, cleanWebsite, cleanZip, htmlDecode,
  normalizeAddress, slugify, stripSlugSuffix,
} from "./util.js";
import { parseBusinessHours, isPermanentlyClosed, type HoursValue } from "./hours.js";
import type { SourceData, LocationRow } from "./load-source.js";

export interface CityRow {
  state_code: string;
  slug: string;
  name: string;
  lat: string | null;
  lng: string | null;
  // not persisted, internal numeric id assigned post-build (1..N)
  _id: number;
  _latSum: number;
  _lngSum: number;
  _n: number;
}

export interface YardRow {
  // Sources (kept for redirect/skip reporting)
  post_id: string;
  raw_slug: string;
  base_slug: string;
  old_state_slug: string;
  old_city_slug: string;
  primary_legacy_cat: string;

  slug: string; // final, after re-disambiguation
  name: string;
  state_code: string;
  city_id: number;
  city_slug: string; // resolved (without -N suffix)
  address: string | null;
  zip: string | null;
  lat: string | null;
  lng: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  hours: HoursValue | null;
  accepted: string[];
  services: string[];
  status: "active" | "unverified" | "closed";
  legacy_url: string;

  // Bookkeeping for redirects (§R3 dedupe-loser handling).
  _losers: Array<{ old_state_slug: string; old_city_slug: string; raw_slug: string; primary_cat: string }>;
}

export interface SkipReason {
  post_id: string;
  raw_slug: string;
  reason: string;
  details?: string;
}

export interface TransformResult {
  cities: CityRow[];
  yards: YardRow[];
  skipped: SkipReason[];
  // Helpful counts for the validation report.
  counts: Record<string, number>;
}

// Canonical legacy category priority (spec §R1).
const LEGACY_CAT_PRIORITY: ReadonlyArray<string> = [
  "scrap-metals",
  "recycling-centers",
  "surplus-salvage-merchandise",
  "metals",
  "scrap-metals-wholesale",
  "automobile-salvage",
  "junk-dealers",
];

// Generate slug candidates in priority order. CRITICAL: none may end in a
// bare numeric suffix (`-[0-9]+$`) — that's the failure mode this whole
// scheme exists to avoid. Numeric tokens are therefore always followed by
// an alphabetic disambiguator, or prefixed with a letter (`z<zip>`,
// `p<post_id>`).
//
// Order:
//   1) base_slug (the WP post name with WP's own -2/-3 stripped)
//   2) base_slug + "<street-number>-<first-word>"  (e.g. acme-1500-main)
//   3) base_slug + "<first-word>"                  (e.g. acme-main)
//   4) base_slug + "z<zip>"                        (e.g. acme-z90210)
//   5) base_slug + "p<post_id>"                    (guaranteed unique)
function buildSlugCandidates(y: YardRow): Array<{ slug: string; via: "base" | "address" | "zip" | "postid" }> {
  const out: Array<{ slug: string; via: "base" | "address" | "zip" | "postid" }> = [];
  const base = y.base_slug;
  out.push({ slug: base, via: "base" });
  const addr = (y.address ?? "").toLowerCase();
  const numberMatch = addr.match(/\b(\d+)\b/);
  const wordMatch = addr.match(/\b([a-z][a-z]+)\b/);
  if (numberMatch && wordMatch) {
    out.push({ slug: `${base}-${numberMatch[1]}-${wordMatch[1]}`, via: "address" });
  }
  if (wordMatch) {
    out.push({ slug: `${base}-${wordMatch[1]}`, via: "address" });
  }
  if (y.zip) out.push({ slug: `${base}-z${y.zip}`, via: "zip" });
  out.push({ slug: `${base}-p${y.post_id}`, via: "postid" });
  return out;
}

function pickPrimaryCat(catSlugs: string[]): string {
  if (catSlugs.length === 0) return "scrap-metals";
  for (const p of LEGACY_CAT_PRIORITY) {
    if (catSlugs.includes(p)) return p;
  }
  return [...catSlugs].sort()[0]!;
}

function resolveStateAndCity(
  src: SourceData & { byRegionCity: Map<string, LocationRow> },
  pd: { region: string | null; city: string | null; latitude: string | null; longitude: string | null },
  postId: string
): { state: StateRow; cityName: string; oldStateSlug: string; oldCitySlug: string; citySlug: string } | null {
  const regionName = (pd.region ?? "").trim();
  if (!regionName) return null;
  const state = STATE_BY_NAME.get(regionName.toLowerCase());
  if (!state) return null;

  let oldStateSlug: string;
  let oldCitySlug: string;
  let cityName = (pd.city ?? "").trim();

  const loc = src.locByPostId.get(postId);
  if (loc) {
    oldStateSlug = loc.region_slug || state.slug;
    oldCitySlug = loc.city_slug || slugify(cityName);
    if (!cityName) cityName = loc.city ?? "";
  } else {
    // fallback: try (region, city) lookup
    const fb = src.byRegionCity.get(`${regionName.toLowerCase()}|${cityName.toLowerCase()}`);
    if (fb) {
      oldStateSlug = fb.region_slug || state.slug;
      oldCitySlug = fb.city_slug || slugify(cityName);
    } else {
      oldStateSlug = state.slug;
      oldCitySlug = slugify(cityName);
    }
  }
  if (!cityName || !oldCitySlug) return null;

  // Normalized city slug (without -N) for our schema:
  const citySlug = stripSlugSuffix(oldCitySlug);
  if (!citySlug) return null;

  // Some old slugs include the suffix ("calhoun-6"); we keep oldCitySlug as-is
  // for redirect sources but use citySlug for the canonical city row.
  return { state, cityName, oldStateSlug, oldCitySlug, citySlug };
}

export function transformAll(
  src: SourceData & { byRegionCity: Map<string, LocationRow> }
): TransformResult {
  const skipped: SkipReason[] = [];
  const counts: Record<string, number> = {
    posts_input: src.posts.length,
    not_gd_place: 0,
    not_publish: 0,
    pd_missing: 0,
    pd_not_publish: 0,
    pd_dummy: 0,
    country_not_us: 0,
    no_state_match: 0,
    no_city: 0,
    no_address_no_geo: 0,
    closed_permanently: 0,
    closed_title: 0,
    closed_expired: 0,
    yards_pre_dedupe: 0,
    yards_dedup_winners: 0,
    yards_dedup_losers: 0,
    address_disambiguated: 0,
    zip_disambiguated: 0,
    postid_disambiguated: 0,
  };

  // Cities accumulator: (state_code|citySlug) → CityRow
  const citiesMap = new Map<string, CityRow>();
  function ensureCity(state_code: string, slug: string, name: string, lat: string | null, lng: string | null): CityRow {
    const key = `${state_code}|${slug}`;
    let c = citiesMap.get(key);
    if (!c) {
      c = {
        state_code, slug, name,
        lat: null, lng: null,
        _id: 0, _latSum: 0, _lngSum: 0, _n: 0,
      };
      citiesMap.set(key, c);
    }
    if (lat && lng) {
      const a = parseFloat(lat), b = parseFloat(lng);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        c._latSum += a; c._lngSum += b; c._n++;
      }
    }
    return c;
  }

  const preYards: YardRow[] = [];

  for (const post of src.posts) {
    if (post.post_type !== "gd_place") {
      counts.not_gd_place!++;
      skipped.push({ post_id: post.ID, raw_slug: post.post_name, reason: "not_gd_place", details: post.post_type });
      continue;
    }
    if (post.post_status !== "publish") {
      counts.not_publish!++;
      skipped.push({ post_id: post.ID, raw_slug: post.post_name, reason: "post_not_publish", details: post.post_status });
      continue;
    }
    const pd = src.pdByPostId.get(post.ID);
    if (!pd) {
      counts.pd_missing!++;
      skipped.push({ post_id: post.ID, raw_slug: post.post_name, reason: "pd_missing" });
      continue;
    }
    if (pd.post_status !== "publish") {
      counts.pd_not_publish!++;
      skipped.push({ post_id: post.ID, raw_slug: post.post_name, reason: "pd_not_publish", details: pd.post_status });
      continue;
    }
    if (pd.post_dummy && pd.post_dummy !== "0") {
      counts.pd_dummy!++;
      skipped.push({ post_id: post.ID, raw_slug: post.post_name, reason: "pd_dummy" });
      continue;
    }
    if (pd.country && pd.country.trim().toLowerCase() !== "united states") {
      counts.country_not_us!++;
      skipped.push({ post_id: post.ID, raw_slug: post.post_name, reason: "country_not_us", details: pd.country });
      continue;
    }
    const resolved = resolveStateAndCity(src, pd, post.ID);
    if (!resolved) {
      if (!pd.region || !STATE_BY_NAME.get((pd.region ?? "").toLowerCase())) counts.no_state_match!++;
      else counts.no_city!++;
      skipped.push({
        post_id: post.ID, raw_slug: post.post_name,
        reason: "city_or_state_unresolved",
        details: `region=${pd.region ?? ""} city=${pd.city ?? ""}`,
      });
      continue;
    }
    const { state, cityName, oldStateSlug, oldCitySlug, citySlug } = resolved;

    // Categories.
    const ttIds = src.termRelByObjectId.get(post.ID) ?? [];
    const catSlugs: string[] = [];
    for (const tt of ttIds) {
      const c = src.catSlugByTtId.get(tt);
      if (c) catSlugs.push(c.slug);
    }
    const accepted = new Set<string>();
    const services = new Set<string>();
    for (const slug of catSlugs) {
      const b = bucketize(slug);
      if (b === "drop") continue;
      if (b === "service") services.add(slug);
      else if (b === "metal") {
        const dest = METAL_TO_CATEGORY[slug];
        if (dest) accepted.add(dest);
      }
    }
    // D4: yards with no SERVICE category get scrap-metals as a sensible default.
    if (services.size === 0) services.add("scrap-metals");

    // Address / geo / status determination.
    const address = (() => {
      const a = (pd.street ?? "").trim();
      if (!a) return null;
      const a2 = (pd.street2 ?? "").trim();
      return a2 ? `${a}, ${a2}` : a;
    })();
    const zip = cleanZip(pd.zip);
    const lat = cleanLatLng(pd.latitude);
    const lng = cleanLatLng(pd.longitude);
    const hasGeo = !!(lat && lng);
    const hasAddr = !!(address && zip);

    let status: "active" | "unverified" | "closed" = "active";
    if (isPermanentlyClosed(pd.business_hours)) {
      status = "closed";
      counts.closed_permanently!++;
    } else if (/(\(closed\)|\[closed\]|[-–—]\s*closed)\s*$/i.test(post.post_title.trim())) {
      status = "closed";
      counts.closed_title!++;
    } else if (pd.expire_date && pd.expire_date !== "0000-00-00 00:00:00" && new Date(pd.expire_date) < new Date()) {
      status = "closed";
      counts.closed_expired!++;
    } else if (!hasGeo && !hasAddr) {
      status = "unverified";
      counts.no_address_no_geo!++;
    }

    const primaryLegacyCat = pickPrimaryCat(catSlugs);
    const legacyUrl =
      `https://scrapyards.io/services/united-states/${oldStateSlug}/${oldCitySlug}/${primaryLegacyCat}/${post.post_name}/`;

    const cityRow = ensureCity(state.code, citySlug, cityName, lat, lng);

    preYards.push({
      post_id: post.ID,
      raw_slug: post.post_name,
      base_slug: stripSlugSuffix(post.post_name),
      old_state_slug: oldStateSlug,
      old_city_slug: oldCitySlug,
      primary_legacy_cat: primaryLegacyCat,

      slug: stripSlugSuffix(post.post_name), // re-disambiguated below
      name: htmlDecode(post.post_title).slice(0, 200),
      state_code: state.code,
      city_id: 0, // assigned after city ids
      city_slug: citySlug,
      address: address ? address.slice(0, 255) : null,
      zip,
      lat,
      lng,
      phone: cleanPhone(pd.phone),
      website: cleanWebsite(pd.website),
      email: cleanEmail(pd.email),
      hours: parseBusinessHours(pd.business_hours),
      accepted: [...accepted].sort(),
      services: [...services].sort(),
      status,
      legacy_url: legacyUrl,
      _losers: [],
    });
  }
  counts.yards_pre_dedupe = preYards.length;

  // Dedupe by (state_code, city_slug, lower(name), normalizeAddress(address)).
  // Pick winner by post_modified_gmt desc, tiebreak post_id asc.
  type Group = YardRow[];
  const groups = new Map<string, Group>();
  for (const y of preYards) {
    const key = `${y.state_code}|${y.city_slug}|${y.name.toLowerCase()}|${normalizeAddress(y.address)}`;
    const g = groups.get(key);
    if (g) g.push(y);
    else groups.set(key, [y]);
  }

  // Need access to post_modified_gmt for tiebreak.
  const modifiedById = new Map<string, string>();
  for (const p of src.posts) modifiedById.set(p.ID, p.post_modified_gmt);

  const winners: YardRow[] = [];
  for (const g of groups.values()) {
    if (g.length === 1) {
      winners.push(g[0]!);
      continue;
    }
    g.sort((a, b) => {
      const ma = modifiedById.get(a.post_id) ?? "";
      const mb = modifiedById.get(b.post_id) ?? "";
      if (ma !== mb) return ma < mb ? 1 : -1; // desc
      return parseInt(a.post_id, 10) - parseInt(b.post_id, 10);
    });
    const w = g[0]!;
    for (let i = 1; i < g.length; i++) {
      const l = g[i]!;
      counts.yards_dedup_losers!++;
      // merge categories
      const acc = new Set([...w.accepted, ...l.accepted]);
      const svc = new Set([...w.services, ...l.services]);
      w.accepted = [...acc].sort();
      w.services = [...svc].sort();
      // backfill nullable scalars
      w.email ??= l.email;
      w.website ??= l.website;
      w.hours ??= l.hours;
      // keep loser legacy info for redirect emission
      w._losers.push({
        old_state_slug: l.old_state_slug,
        old_city_slug: l.old_city_slug,
        raw_slug: l.raw_slug,
        primary_cat: l.primary_legacy_cat,
      });
    }
    winners.push(w);
  }
  counts.yards_dedup_winners = winners.length;

  // Assign city ids (deterministic: sort by state_code, slug).
  const cities = [...citiesMap.values()].sort((a, b) =>
    a.state_code === b.state_code ? a.slug.localeCompare(b.slug) : a.state_code.localeCompare(b.state_code)
  );
  cities.forEach((c, i) => {
    c._id = i + 1;
    if (c._n > 0) {
      c.lat = (c._latSum / c._n).toFixed(6);
      c.lng = (c._lngSum / c._n).toFixed(6);
    }
  });
  const cityIdByKey = new Map<string, number>(cities.map((c) => [`${c.state_code}|${c.slug}`, c._id]));
  for (const y of winners) {
    const id = cityIdByKey.get(`${y.state_code}|${y.city_slug}`);
    if (!id) {
      // shouldn't happen — every winner came from ensureCity above
      skipped.push({ post_id: y.post_id, raw_slug: y.raw_slug, reason: "internal_no_city_id" });
      continue;
    }
    y.city_id = id;
  }

  // Slug re-disambiguation per (state_code, city_id). Required: NO numeric
  // -N suffixes in final yards.slug. When two winners collide on base_slug
  // within the same city, distinguish via address fragment → then zip → then
  // post_id. The numeric suffix is reserved as a last-resort guard that
  // should never fire in practice (see address_disambiguated et al. counts).
  winners.sort((a, b) => parseInt(a.post_id, 10) - parseInt(b.post_id, 10));
  const used = new Set<string>(); // (state|city|slug)
  for (const y of winners) {
    const k = (s: string) => `${y.state_code}|${y.city_id}|${s}`;
    const candidates = buildSlugCandidates(y);
    let chosen: string | null = null;
    for (const cand of candidates) {
      if (!used.has(k(cand.slug))) {
        chosen = cand.slug;
        if (cand.via === "address") counts.address_disambiguated!++;
        else if (cand.via === "zip") counts.zip_disambiguated!++;
        else if (cand.via === "postid") counts.postid_disambiguated!++;
        break;
      }
    }
    if (!chosen) chosen = `${y.base_slug}-p${y.post_id}`.slice(0, 120); // theoretical guard
    y.slug = chosen.slice(0, 120);
    used.add(k(y.slug));
  }

  // Restore stable order by post_id for the SQL output.
  winners.sort((a, b) => parseInt(a.post_id, 10) - parseInt(b.post_id, 10));

  return { cities, yards: winners.filter((y) => y.city_id > 0), skipped, counts };
}
