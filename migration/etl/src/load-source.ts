// Loads JSONL files produced by `migration/scripts/parse-dump.mjs` into memory.
import fs from "node:fs";
import path from "node:path";

export interface PostRow {
  ID: string;
  post_status: string;
  post_type: string;
  post_name: string;
  post_title: string;
  post_modified_gmt: string;
  post_date_gmt: string;
}

export interface PdRow {
  post_id: string;
  post_status: string;
  post_dummy: string;
  street: string | null;
  street2: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  zip: string | null;
  latitude: string | null;
  longitude: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  business_hours: string | null;
  expire_date: string | null;
}

export interface LocationRow {
  post_id?: string; // not present in source — we look up by city/region match (see notes)
  region: string;
  city: string;
  region_slug: string;
  city_slug: string;
}

export interface TermRelationship {
  object_id: string;
  term_taxonomy_id: string;
}

export interface TermTaxonomy {
  term_taxonomy_id: string;
  term_id: string;
  taxonomy: string;
}

export interface Term {
  term_id: string;
  name: string;
  slug: string;
}

export interface SourceData {
  posts: PostRow[];
  pdByPostId: Map<string, PdRow>;
  locByPostId: Map<string, LocationRow>;
  termRelByObjectId: Map<string, string[]>; // post_id → list of tt_ids
  catTermBySlug: Map<string, { ttId: string; termId: string; slug: string; name: string }>;
  catSlugByTtId: Map<string, { ttId: string; slug: string; name: string }>;
}

function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing JSONL: ${file}. Run the dumps from migration/README.md first.`
    );
  }
  const txt = fs.readFileSync(file, "utf8");
  const out: T[] = [];
  for (const line of txt.split("\n")) {
    if (!line) continue;
    out.push(JSON.parse(line) as T);
  }
  return out;
}

// `geodir_post_locations` doesn't carry post_id directly — the parser picked up
// columns location_id/country/region/city/.../is_default. We re-key it by the
// post_id when a 1:1 lookup is needed; in the dump structure each post has at
// most one matching `(country, region, city)` location row, but the canonical
// way the WP code joins is via a foreign-key column inserted by GeoDirectory.
// Inspecting the dump: the parser DOES expose the column after slug-data; the
// JSONL structure includes `post_id`. If absent, we fall back to the
// (region, city) → slug map used by spec §C2.
function buildLocByPostId(rows: LocationRow[]): {
  byPostId: Map<string, LocationRow>;
  byRegionCity: Map<string, LocationRow>;
} {
  const byPostId = new Map<string, LocationRow>();
  const byRegionCity = new Map<string, LocationRow>();
  for (const r of rows) {
    if (r.post_id) byPostId.set(r.post_id, r);
    const key = `${(r.region ?? "").toLowerCase()}|${(r.city ?? "").toLowerCase()}`;
    if (key !== "|" && !byRegionCity.has(key)) byRegionCity.set(key, r);
  }
  return { byPostId, byRegionCity };
}

export function loadSource(jsonlDir: string): SourceData & { byRegionCity: Map<string, LocationRow> } {
  // No pre-filtering — transform.ts is the single place that decides whether
  // a post is migrated, dropped, or logged to skipped.csv with a reason.
  const posts = readJsonl<PostRow>(path.join(jsonlDir, "posts.jsonl"));
  const pdAll = readJsonl<PdRow>(path.join(jsonlDir, "pd.jsonl"));
  const pdByPostId = new Map<string, PdRow>();
  // Index ALL pd rows; transform.ts filters on post_status / post_dummy and
  // logs the reason when a row is rejected.
  for (const r of pdAll) {
    pdByPostId.set(r.post_id, r);
  }
  const locRows = readJsonl<LocationRow>(path.join(jsonlDir, "locations.jsonl"));
  const { byPostId: locByPostId, byRegionCity } = buildLocByPostId(locRows);

  const termRels = readJsonl<TermRelationship>(path.join(jsonlDir, "term_relationships.jsonl"));
  const termTaxRows = readJsonl<TermTaxonomy>(path.join(jsonlDir, "term_taxonomy.jsonl"));
  const termRows = readJsonl<Term>(path.join(jsonlDir, "terms.jsonl"));

  const termById = new Map<string, Term>(termRows.map((t) => [t.term_id, t]));
  const catTermBySlug = new Map<string, { ttId: string; termId: string; slug: string; name: string }>();
  const catSlugByTtId = new Map<string, { ttId: string; slug: string; name: string }>();
  for (const tt of termTaxRows) {
    if (tt.taxonomy !== "gd_placecategory") continue;
    const term = termById.get(tt.term_id);
    if (!term) continue;
    catTermBySlug.set(term.slug, {
      ttId: tt.term_taxonomy_id,
      termId: term.term_id,
      slug: term.slug,
      name: term.name,
    });
    catSlugByTtId.set(tt.term_taxonomy_id, {
      ttId: tt.term_taxonomy_id,
      slug: term.slug,
      name: term.name,
    });
  }

  const termRelByObjectId = new Map<string, string[]>();
  for (const tr of termRels) {
    const list = termRelByObjectId.get(tr.object_id);
    if (list) list.push(tr.term_taxonomy_id);
    else termRelByObjectId.set(tr.object_id, [tr.term_taxonomy_id]);
  }

  return {
    posts,
    pdByPostId,
    locByPostId,
    byRegionCity,
    termRelByObjectId,
    catTermBySlug,
    catSlugByTtId,
  };
}
