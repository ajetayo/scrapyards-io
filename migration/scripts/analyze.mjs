#!/usr/bin/env node
import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";

const TMP = "/tmp";
async function load(file, filter = () => true) {
  const out = [];
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(TMP, file)) });
  for await (const line of rl) {
    if (!line) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    if (filter(r)) out.push(r);
  }
  return out;
}

console.error("Loading posts...");
const posts = await load("posts.jsonl");
const byType = {};
for (const p of posts) byType[p.post_type] = (byType[p.post_type] || 0) + 1;

const gdPosts = posts.filter(p => p.post_type === "gd_place");
const gdById = new Map(gdPosts.map(p => [String(p.ID), p]));
const gdByStatus = {};
for (const p of gdPosts) gdByStatus[p.post_status] = (gdByStatus[p.post_status] || 0) + 1;

console.error("Loading place_detail...");
const pd = await load("pd.jsonl");
const pdById = new Map(pd.map(r => [String(r.post_id), r]));

const realYards = pd.filter(r => r.post_status === "publish" && r.post_dummy !== "1");
const matched = realYards.filter(r => gdById.has(String(r.post_id)));
const unmatched = realYards.filter(r => !gdById.has(String(r.post_id)));

console.error("Loading terms / taxonomy / relationships...");
const terms = await load("terms.jsonl");
const tt = await load("term_taxonomy.jsonl");
const tr = await load("term_relationships.jsonl");

const termById = new Map(terms.map(t => [String(t.term_id), t]));
const ttById = new Map(tt.map(t => [String(t.term_taxonomy_id), t]));
const ttByTaxonomy = {};
for (const t of tt) (ttByTaxonomy[t.taxonomy] ||= []).push(t);

const trByObject = new Map();
for (const r of tr) {
  const k = String(r.object_id);
  if (!trByObject.has(k)) trByObject.set(k, []);
  trByObject.get(k).push(String(r.term_taxonomy_id));
}

// Categories assigned to gd_place posts via term_relationships
const gdCatTtIds = new Set(ttByTaxonomy["gd_placecategory"]?.map(t => String(t.term_taxonomy_id)) || []);
const gdLocTtIds = new Set(ttByTaxonomy["gd_place_tags"]?.map(t => String(t.term_taxonomy_id)) || []);
let gdPlaceWithCat = 0;
const catUsage = {};
for (const p of gdPosts) {
  const ttIds = trByObject.get(String(p.ID)) || [];
  let has = false;
  for (const ttId of ttIds) {
    if (gdCatTtIds.has(ttId)) {
      has = true;
      catUsage[ttId] = (catUsage[ttId] || 0) + 1;
    }
  }
  if (has) gdPlaceWithCat++;
}

// Also check post_category CSV in pd
const catUsageFromPd = {};
for (const r of realYards) {
  const csv = (r.post_category || "").split(",").filter(Boolean);
  for (const tid of csv) catUsageFromPd[tid] = (catUsageFromPd[tid] || 0) + 1;
}

// Top categories with names
function termNameForTtId(ttId) {
  const t = ttById.get(String(ttId));
  if (!t) return null;
  const tm = termById.get(String(t.term_id));
  return tm ? { name: tm.name, slug: tm.slug, taxonomy: t.taxonomy, count: t.count } : null;
}

const topCatsByPd = Object.entries(catUsageFromPd)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25)
  .map(([tid, n]) => ({ tid, n, term: termNameForTtId(tid) }));

const topCatsByTr = Object.entries(catUsage)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25)
  .map(([tid, n]) => ({ tid, n, term: termNameForTtId(tid) }));

// All gd_placecategory terms
const allGdCats = (ttByTaxonomy["gd_placecategory"] || []).map(t => ({
  ttId: t.term_taxonomy_id,
  ...termNameForTtId(t.term_taxonomy_id),
})).sort((a, b) => (b.count | 0) - (a.count | 0));

console.error("Loading post_locations...");
const locs = await load("geodir_post_locations.jsonl");
const locByPost = new Map(locs.map(l => [String(l.post_id), l]));
const stateSlugUsage = {};
for (const l of locs) stateSlugUsage[l.region_slug] = (stateSlugUsage[l.region_slug] || 0) + 1;
const citySlugSeen = new Set();
for (const l of locs) citySlugSeen.add(`${l.region_slug}|${l.city_slug}`);

console.error("Loading attachments / business hours / redirects / postmeta...");
const atts = await load("geodir_attachments.jsonl");
const attsByPost = {};
for (const a of atts) {
  (attsByPost[String(a.post_id)] ||= []).push(a);
}
const yardsWithImages = new Set(atts.map(a => String(a.post_id)));
const realIdSet = new Set(realYards.map(r => String(r.post_id)));
const realWithImages = [...yardsWithImages].filter(id => realIdSet.has(id)).length;

// Business hours: GeoDirectory stores them inline on geodir_gd_place_detail.business_hours
// for this dataset. The standalone geodir_business_hours table exists but does not
// reference any of our 8,296 yards (verified). Count completeness from inline source.
const bh = await load("geodir_business_hours.jsonl");
const bhByPost = {};
for (const b of bh) (bhByPost[String(b.post_id)] ||= []).push(b);
const realWithHoursStandalone = realYards.filter(r => bhByPost[String(r.post_id)]).length;
const realWithHoursInline = realYards.filter(r => isFilledStr(r.business_hours)).length;
const realWithHours = realWithHoursInline; // canonical: inline is the source of truth

function isFilledStr(v) { return v !== null && v !== undefined && String(v).trim() !== ""; }

const ri = await load("redirection_items.jsonl");
const riStatus = {};
for (const r of ri) riStatus[r.status] = (riStatus[r.status] || 0) + 1;

// Permalink/SEO info from postmeta keys we care about
const pm = await load("postmeta.jsonl");
const metaKeyCounts = {};
for (const m of pm) metaKeyCounts[m.meta_key] = (metaKeyCounts[m.meta_key] || 0) + 1;
const topMetaKeys = Object.entries(metaKeyCounts).sort((a, b) => b[1] - a[1]).slice(0, 40);

// Field completeness on real yards
function isFilled(v) { return v !== null && v !== undefined && String(v).trim() !== "" && String(v) !== "0"; }
const FIELDS = ["post_title", "street", "city", "region", "country", "zip", "latitude", "longitude", "phone", "email", "website", "facebook", "twitter", "video", "special_offers", "business_hours", "post_category", "default_category"];
const filled = {};
for (const f of FIELDS) {
  let n = 0;
  for (const r of realYards) {
    const v = r[f];
    if (isFilled(v)) n++;
  }
  filled[f] = { filled: n, pct: ((n / realYards.length) * 100).toFixed(1) };
}

// State distribution
const realByRegion = {};
for (const r of realYards) realByRegion[r.region] = (realByRegion[r.region] || 0) + 1;
const realByRegionSorted = Object.entries(realByRegion).sort((a, b) => b[1] - a[1]);

// Post type "metal" — the new schema
const metalPosts = posts.filter(p => p.post_type === "metal");

// Slug duplicate analysis for gd_place
const slugCounts = {};
for (const p of gdPosts) slugCounts[p.post_name] = (slugCounts[p.post_name] || 0) + 1;
const dupSlugs = Object.entries(slugCounts).filter(([s, n]) => n > 1).sort((a, b) => b[1] - a[1]);
const slugSuffix = gdPosts.filter(p => /-\d+$/.test(p.post_name)).length;

// Listing (ListingPro agriculture posts) basic
const listingPosts = posts.filter(p => p.post_type === "listing");
const listingByStatus = {};
for (const p of listingPosts) listingByStatus[p.post_status] = (listingByStatus[p.post_status] || 0) + 1;

// State slug normalization candidates
const oddStateSlugs = Object.keys(stateSlugUsage).filter(s => /-\d+$/.test(s));

const summary = {
  scope: {
    dump_file: "wp-dump.sql",
    table_prefix: "80TdVe_",
    total_posts: posts.length,
    posts_byType: byType,
  },
  yards_real_data: {
    source: "post_type='gd_place' + geodir_gd_place_detail",
    gd_place_total: gdPosts.length,
    gd_place_byStatus: gdByStatus,
    place_detail_total: pd.length,
    real_publish_yards_in_pd: realYards.length,
    real_yards_with_matching_post: matched.length,
    real_yards_orphan_in_pd: unmatched.length,
    states_covered: Object.keys(realByRegion).length,
    real_yards_with_images: realWithImages,
    real_yards_with_business_hours: realWithHours,
    real_yards_with_business_hours_inline_pd: realWithHoursInline,
    real_yards_with_business_hours_standalone_table: realWithHoursStandalone,
    real_yards_by_state: realByRegionSorted,
  },
  field_completeness_on_real_yards: filled,
  categories: {
    gd_placecategory_terms_total: (ttByTaxonomy["gd_placecategory"] || []).length,
    gd_place_posts_with_at_least_one_category: gdPlaceWithCat,
    top_categories_used_by_real_yards_postCategoryCSV: topCatsByPd,
    top_categories_via_term_relationships: topCatsByTr,
    all_gd_placecategory_terms: allGdCats,
  },
  locations: {
    geodir_post_locations_rows: locs.length,
    distinct_state_slugs: Object.keys(stateSlugUsage).length,
    distinct_city_slugs: citySlugSeen.size,
    weird_state_slugs_with_numeric_suffix: oddStateSlugs.sort(),
    state_slug_distribution: Object.entries(stateSlugUsage).sort((a, b) => b[1] - a[1]),
  },
  slugs: {
    duplicate_slugs_in_gd_place: dupSlugs.length,
    sample_dupes: dupSlugs.slice(0, 10),
    gd_place_slugs_with_numeric_suffix: slugSuffix,
  },
  metals_post_type: {
    total: metalPosts.length,
    sample: metalPosts.slice(0, 15).map(p => ({ id: p.ID, slug: p.post_name, title: p.post_title, status: p.post_status })),
  },
  ignore_listingpro_data: {
    note: "post_type='listing' is leftover ListingPro data: 100% agriculture/livestock businesses (veterinary clinics, butcher shops, livestock haulers). DO NOT MIGRATE.",
    listing_posts_total: listingPosts.length,
    listing_byStatus: listingByStatus,
  },
  postmeta: {
    total_rows: pm.length,
    top_meta_keys: topMetaKeys,
  },
  redirects: {
    total: ri.length,
    byStatus: riStatus,
    sample: ri.slice(0, 10),
  },
};

fs.mkdirSync("migration/output", { recursive: true });
fs.writeFileSync("migration/output/inspection-final.json", JSON.stringify(summary, null, 2));
console.error("Wrote migration/output/inspection-final.json");
