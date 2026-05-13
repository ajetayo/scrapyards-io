# WP → Postgres Mapping Spec

**Source dump:** `migration/input/wp-dump.sql` (table prefix `80TdVe_`)
**Target schema:** `lib/db/src/schema/` — `states`, `cities`, `yards`, `metals`, `metal_categories`, `metal_prices`, `price_reports`, `legacy_redirects`
**Companion:** `01-inspection-report.md` (counts, schemas, samples).

> Field-by-field mappings, deterministic transforms, dedupe keys, defaults, and validation rules. **No SQL is emitted here — that is Phase 3.** Items marked **DECISION** must be confirmed before Phase 3 starts.

---

## §A — Source Tables Read

| WP table | Filter | Used for |
|---|---|---|
| `80TdVe_posts` | `post_type='gd_place'` | yard core (8,296 publish + 0 draft + 0 trash → only publish exists) |
| `80TdVe_geodir_gd_place_detail` | `post_status='publish' AND post_dummy IN ('0','')` | yard detail (8,296 rows; 1:1 by `post_id`) |
| `80TdVe_geodir_post_locations` | join by `post_id` | canonical city/state slug |
| `80TdVe_term_relationships` ⨝ `_term_taxonomy` ⨝ `_terms` | `term_taxonomy.taxonomy='gd_placecategory'` | yard categories |
| `80TdVe_posts` (`post_type='metal'`) ⨝ `_postmeta` (`meta_key IN ('metal_price','last_update')`) | optional — see §M | metal_prices seed |

Tables explicitly **NOT read** (and reasons): see `01-inspection-report.md §10`.

---

## §B — Pre-Built Lookups

### §B1 — State name → 2-letter code + canonical slug

The dump uses full state names (`pd.region`, e.g. "New York") and possibly-suffixed `region_slug`s. Build a single state lookup keyed by both the name and the alias slug:

```text
"Alabama"  → { code:"AL", slug:"alabama"  }
"Alaska"   → { code:"AK", slug:"alaska"   }
…all 50 + DC…

# Alias map for the 9 GeoDirectory-suffixed slugs found in the dump:
"delaware-2"     → "delaware"
"indiana-1"      → "indiana"
"kansas-1"       → "kansas"
"michigan-1"     → "michigan"
"nevada-2"       → "nevada"
"north-dakota-1" → "north-dakota"
"south-dakota-1" → "south-dakota"
"virginia-2"     → "virginia"
"washington-7"   → "washington"
```

Source for codes/FIPS/lat/lng: existing `scripts/src/seed-scrapyards.ts` already enumerates all 50 + DC — reuse it.

### §B2 — `gd_placecategory` term classification (METAL / SERVICE / DROP)

Exhaustive classification of all 75 `gd_placecategory` terms (full list with usage counts in `inspection-final.json`):

**METAL bucket** — adds the mapped `metal_categories.slug` to the yard's `accepted` array (see §B3 for exact crosswalk):

```
aluminum, aluminum-products, copper, copper-products, brass, bronze, lead, iron,
metals, base-metals, alloys, precious-metals
```

**SERVICE bucket** — adds the term slug verbatim to the yard's `services` array:

```
scrap-metals, scrap-metals-wholesale, recycling-centers, recycling-equipment-services,
surplus-salvage-merchandise, junk-dealers, automobile-salvage, truck-wrecking,
automobile-parts-supplies, automobile-parts, used-rebuilt-auto-parts,
automobile-parts-supplies-used-rebuilt-wholesale-manufacturers,
steel-distributors-warehouses, steel-processing, steel-erectors,
smelters-refiners-precious-metals, waste-recycling-disposal-service-equipment,
garbage-collection, garbage-disposals, dump-truck-service, containers,
wrecker-service-equipment, cranes, machinery-movers-erectors, trucking,
farm-equipment, construction-building-equipment, major-appliances,
electric-equipment-supplies, plastics, plastics-scrap, waste-paper, wood-products,
cabinets, collectibles, jewelers, building-materials, strip
```

**DROP bucket** — neither is recorded:

```
professional-engineers, construction-engineers, structural-engineers
   (auto-imported noise; all share count=448)

orphan TT IDs:
   3684, 3686
   (referenced by 1,026 yards' pd.post_category CSVs, but no term_taxonomy row;
    silently ignored — see §N7)
```

> **DECISION D1** — Confirm the METAL/SERVICE/DROP split. Default = the lists above.

### §B3 — METAL term → `metal_categories.slug` crosswalk

The `metal_categories` table currently has 9 slugs (per `scripts/src/seed-scrapyards.ts`):
**`copper`, `aluminum`, `steel`, `brass`, `lead`, `zinc`, `electronics`, `precious-metals`, `auto-parts`**.

Definitive crosswalk — left side is the `gd_placecategory.slug`, right side is the `metal_categories.slug` placed into `yards.accepted`:

```text
aluminum            → "aluminum"
aluminum-products   → "aluminum"
copper              → "copper"
copper-products     → "copper"
brass               → "brass"
bronze              → "brass"           # bronze is a copper-tin alloy; closest existing category
lead                → "lead"
iron                → "steel"           # "Steel & Iron" category
precious-metals     → "precious-metals"

metals              → (no add — too generic; SERVICE bucket only)
base-metals         → (no add — too generic)
alloys              → (no add — too generic)
```

**Unresolved exceptions** (left side has yards but no destination `metal_categories.slug`):
- *(none after the assignments above — every METAL-bucket term that maps to physical metal has a destination)*

**Categories from the dump that have NO seeded metal_categories slot** and therefore cannot land in `accepted`:
- `tin`, `nickel`, `gold`, `silver` — none of these are present in the dump's `gd_placecategory` set, so this is moot. (Spot check: `terms` rows for those names are absent.)

> **DECISION D8** — Confirm `bronze → brass` (vs. drop `bronze`). Default = map to `brass`.

### §B4 — Slug normalization helper

`slugify(s)`: lowercase; strip diacritics (NFKD + remove combining marks); replace any non `[a-z0-9]+` run with `-`; strip leading/trailing `-`; collapse double `-`. Used as the city-slug fallback.

`stripSlugSuffix(s)`: returns `s` with one trailing `-N` (where `N` is one or more digits) removed if present, else `s` unchanged. Used on yard slugs (§C3).

`normalizeAddress(s)`: lowercase; trim; collapse whitespace to single spaces; strip trailing punctuation; standardize street-type abbreviations (`STREET→ST`, `AVENUE→AVE`, `ROAD→RD`, `DRIVE→DR`, `BOULEVARD→BLVD`, `LANE→LN`, `HIGHWAY→HWY`, `CIRCLE→CIR`, `COURT→CT`, `PLACE→PL`, `PARKWAY→PKWY`, `NORTH/SOUTH/EAST/WEST→N/S/E/W`); used as the dedupe key component.

---

## §C — Target Table Mappings

### §C1 — `states` (per-column)

Schema source of truth: `lib/db/src/schema/states.ts` — columns: `code` (char(2), PK), `slug` (varchar(40), unique), `name` (varchar(60)), `fips` (char(2)), `lat`/`lng` (numeric(9,6)), `intro_md` (text), `laws_md` (text). No `created_at`, `updated_at`, or `population`.

Already seeded by `scripts/src/seed-scrapyards.ts` (50 + DC). The dump's `pd.region` is used **only** to look up an existing `states` row (by `name`) — no rows are inserted, updated, or deleted. Per-column intent if the seeder were to be re-run from this spec:

| `states` column | Source / transform | Notes |
|---|---|---|
| `code` | seeded constant (e.g. `'NY'`) | PK; never sourced from dump |
| `slug` | seeded constant (e.g. `'new-york'`) | After §B1 alias normalization (e.g. `delaware-2`→`delaware`) |
| `name` | seeded constant (e.g. `'New York'`) | Display name; cross-checked against `pd.region` (must match exactly for all 51) |
| `fips` | seeded constant | Not in dump |
| `lat`, `lng` | seeded constant | Not in dump |
| `intro_md` | NULL (curated copy added later) | Not in dump |
| `laws_md` | NULL (curated copy added later) | Not in dump |

Phase-3 precondition: assert `SELECT count(*) FROM states = 51`. Abort load if any `pd.region` value cannot be resolved against the seeded set.

### §C2 — `cities` (per-column)

Schema source of truth: `lib/db/src/schema/cities.ts` — columns: `id` (serial PK), `state_code` (char(2) FK), `slug` (varchar(80)), `name` (varchar(100)), `population` (integer, nullable), `lat`/`lng` (numeric(9,6), nullable). Unique on `(state_code, slug)`.

One row per `(state_code, slug)` derived from yards.

| `cities` column | Source / transform | Notes |
|---|---|---|
| `id` | DB-generated (`serial`) | — |
| `state_code` | §B1 lookup of `pd.region` | FK to `states.code` |
| `slug` | prefer `geodir_post_locations.city_slug` (joined by `post_id`); fallback `slugify(pd.city)` | Unique within `state_code` |
| `name` | `pd.city` (display case); fallback `geodir_post_locations.city` | |
| `population` | NULL | Not in dump |
| `lat`, `lng` | centroid of constituent yards (mean of `pd.latitude` / `pd.longitude`) | |

**Dedupe key:** `(state_code, slug)` (matches `cities_state_slug_unique`). When two display names produce the same slug (e.g. "St. Louis" and "Saint Louis" both → `st-louis`), keep the first-seen `name` and merge yards.

**Edge case** — ~3,177 yards lack a `geodir_post_locations` row: `slugify(pd.city)` is the only option for those; fall through silently.

### §C3 — `yards`

One row per **deduped** yard group. Source = 8,296 `gd_place` posts; expected output = ≤ 8,296 rows after dedupe (estimated 8,200–8,290 after collapsing same-business duplicates).

#### §C3.1 — Slug derivation (suffix strip + re-disambiguation)

1. `raw_slug = posts.post_name`
2. `base_slug = stripSlugSuffix(raw_slug)` — drops one trailing `-N` (1,310 yards have one).
3. After loading the dedupe groups (§C3.3), assign each surviving yard a slug:
   - First survivor in `(state_code, city_id)` keeps `base_slug`.
   - Each additional survivor with the same `base_slug` in the same `(state_code, city_id)` gets `base_slug-2`, `base_slug-3`, … (counter restarts per `(state_code, city_id)`).
4. The resulting `(state_code, city_id, slug)` is unique (matches `yards_state_city_slug_unique`).

> Rationale: the `-N` suffixes in the source come from GeoDirectory's global slug uniqueness. Our schema uniqueness is scoped to `(state_code, city_id)`, so most suffixes are unnecessary and removing them gives cleaner URLs while preserving SEO via `legacy_redirects`. The original suffixed URL is captured in `legacy_url` and `legacy_redirects`.

#### §C3.2 — Field map

Schema source of truth: `lib/db/src/schema/yards.ts` — 23 columns. The insert schema omits `id`, `created_at`, `updated_at` (DB-managed); the loader must not pass values for those.

| `yards` column | Source / transform |
|---|---|
| `id` | DB-generated (`serial`) |
| `slug` | per §C3.1 (varchar(120)) |
| `name` | `posts.post_title` (HTML-decode `&amp;` → `&`, `&#039;` → `'`, etc.) — varchar(200) |
| `state_code` | §B1 lookup of `pd.region` — char(2), FK |
| `city_id` | FK lookup against the loaded `cities` rows by `(state_code, city_slug)` — integer |
| `address` | `pd.street` trimmed; if `pd.street2` non-empty append `, {street2}`; NULL if empty — varchar(255) |
| `zip` | `pd.zip` parsed as float → `Math.trunc()` → zero-pad to 5 → string. NULL if not a 5-digit US ZIP — varchar(10) |
| `lat`, `lng` | `pd.latitude`, `pd.longitude` cast to `numeric(9,6)`. **No geocoding is performed in this phase.** If both are NULL/empty in source (0 rows in current dump), leave both NULL on insert and emit one row per affected yard to the §V validation report under "needs geocoding"; a separate post-load geocoding pass will backfill them later. |
| `phone` | `pd.phone` trimmed (preserve raw format) — varchar(20); truncate any longer values to 20 chars |
| `website` | `pd.website` after the placeholder filter (§C3.4); else NULL — varchar(255) |
| `email` | `pd.email` lowercased; NULL if it does not match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — varchar(120) |
| `hours` | parsed `pd.business_hours` → JSONB (§H); NULL if empty |
| `accepted` | `text[]` of `metal_categories.slug` — apply §B3 to every term in `term_relationships` for the yard's group; **dedupe**, sort, drop empties |
| `services` | `text[]` of `gd_placecategory.slug` from the SERVICE bucket — dedupe, sort |
| `description` | NULL (Phase 4 may synthesize) |
| `photo_urls` | NULL — `text[]`; no source photos available |
| `rating_avg` | NULL — numeric(2,1) |
| `rating_count` | `0` (DB default) |
| `is_verified` | `false` (DB default) |
| `is_premium` | `false` (DB default) |
| `status` | per §C3.5 — varchar(20); one of `active` / `unverified` / `closed` |
| `legacy_url` | full absolute URL per §R1 (e.g. `https://scrapyards.io/services/united-states/new-york/brooklyn/scrap-metals/irving-rubber-metal-co/`) — varchar(500); indexed (`yards_legacy_url_idx`) so middleware can do a fast fallback lookup when no `legacy_redirects.source_path` matches |
| `created_at` | omitted on insert (DB default `now()`) |
| `updated_at` | omitted on insert (DB default `now()`) |

#### §C3.3 — Dedupe (the non-slug uniqueness rule)

After §B1/§B2/§B3 lookups, group raw rows by:

```
dedupe_key = (state_code, city_id, lower(name), normalizeAddress(address))
```

For each group containing more than one source row:

1. **Pick the winner**: highest `posts.post_modified_gmt`, tie-broken by lowest `posts.ID` (deterministic).
2. **Merge categories** from all losers into the winner's `accepted` array (union, then dedupe + sort).
3. **Merge services** the same way.
4. **Backfill** the winner's nullable scalar fields (`email`, `website`, `business_hours`, `street2`) from any loser that has them. Address/lat/lng/zip/phone are taken from the winner without merging.
5. Capture each loser's `(state_slug-with-suffix, city_slug-with-suffix, raw_slug, primary_category_slug)` — those are emitted as additional `legacy_redirects` rows pointing to the winner's new URL.

After dedupe, slugs are assigned per §C3.1.

#### §C3.4 — Website placeholder filter

Drop the `website` value (set to NULL) if it matches any of:

- empty / whitespace
- contains no `.` (e.g. `Sell your scrap here`, `Call for info`)
- starts with `mailto:` or `tel:`
- equals one of the placeholders observed in the dump:
  ```
  Sell your scrap here · sell your scrap here · n/a · N/A · NA · None · none ·
  not available · - · TBD · tbd
  ```

After filtering, prefix `http://` if no scheme is present, lowercase the host, and trim trailing `/`.

#### §C3.5 — `yards.status` mapping

The schema column `yards.status` is `varchar(20) DEFAULT 'active'`. We use exactly three values: **`'active'`**, **`'unverified'`**, **`'closed'`**.

| Source state | `yards.status` |
|---|---|
| `posts.post_status='publish'` AND non-dummy AND has at least one of {`street`+`zip`, lat/lng} AND none of the closed-flag conditions below | `'active'` |
| `posts.post_status='draft'` | `'unverified'` |
| `posts.post_status='pending'` | `'unverified'` |
| `posts.post_status='publish'` but missing **both** (`street` AND `zip`) AND (lat/lng) | `'unverified'` (incomplete record — flag for human review, do not route URLs to it) |
| `posts.post_status='trash'` OR `posts.post_status='auto-draft'` | **not migrated** (§N1) |

**Closed-flag conditions (ONLY these mark a yard as `'closed'` — no soft heuristics):**

A yard is `'closed'` if and only if at least one of the following is true:

1. `pd.business_hours` contains the literal substring `permanently closed` (case-insensitive), OR
2. `posts.post_title` ends with one of `(Closed)`, `[Closed]`, ` - Closed`, ` — Closed` (case-insensitive trim), OR
3. `pd.expire_date` is non-null AND in the past (relative to load date).

For the current dump, all 8,296 source rows are `publish` and **0** match any closed-flag condition or the missing-geo trigger, so the realized distribution is expected to be **100% `'active'`**.

> **DECISION D9** — Confirm the explicit closed-flag list above (no fuzzy heuristics).

### §C4 — `metals` (per-column)

Schema source of truth: `lib/db/src/schema/metals.ts` — columns: `slug` (varchar(60), PK), `name` (varchar(120)), `category` (varchar(40)), `unit` (varchar(10)), `description_md` (text), `prep_tips_md` (text), `spot_factor` (numeric(4,3)), `spot_metal` (varchar(20)), `display_order` (integer, default 100). **No timestamps.**

**Default (D2 = Option A):** no rows inserted from dump. Existing 22 seeded rows are kept untouched. Per-column intent if D2 = Option B is selected (see §M2 for the 245-grade crosswalk):

| `metals` column | Source / transform (Option B) | Notes |
|---|---|---|
| `slug` | `posts.post_name` (verbatim, varchar(60)) | PK; must not collide with the 22 seeded slugs (one collision exists: `stainless-steel` — keep seeded row, skip dump) |
| `name` | `posts.post_title` (HTML-decode) | |
| `category` | per §M2 family table | One of the 9 `metal_categories.slug` values; never NULL |
| `unit` | literal `'lb'` | Dump has no unit field |
| `description_md` | `posts.post_content` (HTML→MD) if non-empty, else NULL | Most are empty in the dump |
| `prep_tips_md` | NULL | Not in dump |
| `spot_factor` | NULL | Not in dump |
| `spot_metal` | derived from `category` (see §M Option B mapping) | NULL when no clean parent (electronics, auto-parts) |
| `display_order` | literal `100` | Pushes dump-imported metals after the curated seeded set |

### §C5 — `metal_categories` (per-column)

Schema source of truth: `lib/db/src/schema/metal-categories.ts` — columns: `slug` (varchar(40), PK), `name` (varchar(80)), `description_md` (text), `display_order` (integer, default 100). **No timestamps.**

**No rows inserted, updated, or deleted from the dump.** The 9 seeded rows (`copper`, `aluminum`, `steel`, `brass`, `lead`, `zinc`, `electronics`, `precious-metals`, `auto-parts`) are the canonical set referenced by §B3 and §M2. Per-column intent if the seeder were to be re-run:

| `metal_categories` column | Source / transform | Notes |
|---|---|---|
| `slug` | seeded constant | PK |
| `name` | seeded constant | Display name |
| `description_md` | seeded constant or NULL | Curated copy |
| `display_order` | seeded constant (1–9) | DB default `100` if omitted |

Phase-3 precondition: assert all 9 seeded slugs exist before loading yards (every value emitted by §B3 must resolve).

### §C6 — `metal_prices` (per-column)

Schema source of truth: `lib/db/src/schema/metal-prices.ts` — columns: `id` (bigserial PK), `metal_slug` (varchar(60), FK), `region_code` (varchar(10)), `price` (numeric(10,4)), `source` (varchar(40)), `recorded_on` (date), `recorded_at` (timestamptz, default `now()`). Unique on `(metal_slug, region_code, recorded_on, source)`.

**Default:** no rows inserted from dump. The cron `/api/cron/update-prices` populates this table from spot-price APIs after Phase 4.

If D2 = Option B (per §M2), emit one row per imported metal:

| `metal_prices` column | Source / transform |
|---|---|
| `id` | DB-generated (`bigserial`) |
| `metal_slug` | `posts.post_name` (matches §C4 inserted slug) |
| `region_code` | literal `'US'` |
| `price` | `postmeta.metal_price` (numeric, USD/lb) |
| `source` | literal `'wp-import'` |
| `recorded_on` | `postmeta.last_update` parsed to `date` |
| `recorded_at` | omitted on insert (DB default `now()`) |

Skip rows where `metal_price` is missing/zero or `last_update` is unparseable.

### §C7 — `price_reports`

Schema source of truth: `lib/db/src/schema/price-reports.ts` — columns: `id` (bigserial), `yard_id`, `metal_slug`, `price` (numeric(10,4)), `reporter_email` (varchar(120)), `reporter_ip` (inet), `notes` (text), `is_approved` (bool, default `false`), `reported_on` (date, default `now()`), `created_at` (timestamptz, default `now()`).

**Empty.** No source data — no historical user-reported prices exist in the dump (the legacy site never had a price-report endpoint). No rows inserted.

### §C8 — `legacy_redirects` (per-column)

Schema source of truth: `lib/db/src/schema/legacy-redirects.ts` — columns: **`source_path` (varchar(500), PK)**, **`target_path` (varchar(500))**, **`status_code` (smallint, default 301)**. **No `id`, no `hits`, no `last_hit_at`, no `created_at`.** Per-column source / transform:

| `legacy_redirects` column | Source / transform | Notes |
|---|---|---|
| `source_path` | per §R2/§R3/§R4 — lowercased path with leading `/` and trailing `/` (e.g. `/services/united-states/new-york/brooklyn/scrap-metals/irving-rubber-metal-co/`). Truncate to 500 chars; reject any longer (none observed: max length in source data is 132). | PK — duplicates collapse per the §R5 "longer target wins" rule applied at row-build time |
| `target_path` | per §R2/§R3/§R4 — new-schema path with leading `/` and trailing `/` (e.g. `/scrap-yards/new-york/brooklyn/irving-rubber-metal-co/`) | Resolved via the loaded `(state, city, deduped-slug)` tuples; varchar(500) |
| `status_code` | omitted on insert (DB default `301`) | Schema default; emit `301` explicitly only if a row needs `308`/etc. (none in this migration) |

Three sources feed this table (full row-emission rules in §R):

1. **§R2 — GSC URLs (~830 rows)**: derived from `migration/input/gsc-pages.csv` patterns.
2. **§R3 — dedupe losers**: one row per yard merged away in §C3.3 (estimated dozens).
3. **§R4 — synthetic per-yard**: one row per surviving yard whose `legacy_url`-derived path is not already in §R2 (~8,200 rows).

The new app's middleware fallback uses `yards.legacy_url` (full absolute URL, indexed by `yards_legacy_url_idx`) to catch any deep-linked old URL that is not in `legacy_redirects` — so this table is the canonical, path-only redirect map, while `yards.legacy_url` is the per-yard absolute-URL backstop.

Total estimated `legacy_redirects` row count: ~9,000.

### §C9 — Schema Conformance Checklist

Phase 3 must verify every target column it touches against `lib/db/src/schema/*` before emitting SQL. The checklist below mirrors the schemas as of this spec:

| Target table | Schema file | Columns the loader writes | Columns the loader explicitly does NOT write |
|---|---|---|---|
| `states` | `states.ts` | none (read-only lookup) | all 8 |
| `cities` | `cities.ts` | `state_code`, `slug`, `name`, `lat`, `lng` | `id` (DB-generated), `population` (NULL) |
| `yards` | `yards.ts` | `slug`, `name`, `state_code`, `city_id`, `address`, `zip`, `lat`, `lng`, `phone`, `website`, `email`, `hours`, `accepted`, `services`, `status`, `legacy_url` | `id`, `description`, `photo_urls`, `rating_avg`, `rating_count`, `is_verified`, `is_premium`, `created_at`, `updated_at` (DB defaults / curated later) |
| `metals` | `metals.ts` | (Option A) none — (Option B) `slug`, `name`, `category`, `unit`, `description_md`, `spot_metal`, `display_order` | `prep_tips_md`, `spot_factor` (NULL) |
| `metal_categories` | `metal-categories.ts` | none (seeded set is canonical) | all 4 |
| `metal_prices` | `metal-prices.ts` | (Option A) none — (Option B) `metal_slug`, `region_code`, `price`, `source`, `recorded_on` | `id`, `recorded_at` (DB defaults) |
| `price_reports` | `price-reports.ts` | none (no source data) | all 10 |
| `legacy_redirects` | `legacy-redirects.ts` | `source_path`, `target_path` | `status_code` (DB default `301`) |

Phase 3 must abort if any of the above schema files has changed shape since this spec was written (compare column names + types against the lists above).

---

## §H — Business Hours Parser (string → JSONB)

Source: inline `geodir_gd_place_detail.business_hours`. Two observed shapes:

1. **Free-form English** (most common in this dump):
   ```
   Mon - Fri: 7:00 am - 5:00 pm Sat: 7:00 am - 1:30 pm Sun Closed
   ```
2. **Schema.org-ish CSV** (older GeoDirectory):
   ```
   Mo,Tu,We,Th,Fr 09:00-17:00 ; Sa 10:00-14:00 ; Su Closed
   ```

Output JSONB:

```json
{
  "mon": [{ "open": "07:00", "close": "17:00" }],
  "tue": [{ "open": "07:00", "close": "17:00" }],
  "wed": [{ "open": "07:00", "close": "17:00" }],
  "thu": [{ "open": "07:00", "close": "17:00" }],
  "fri": [{ "open": "07:00", "close": "17:00" }],
  "sat": [{ "open": "07:00", "close": "13:30" }],
  "sun": "closed"
}
```

When parsing fails, store `{ "raw": "<original string>" }` rather than failing the row. Phase 3 will deliver the parser; expect ≥90% structured-parse success based on samples.

> **DECISION D3** — Confirm the JSONB shape (matches what `artifacts/scrapyards/lib/seo.ts` will consume for `OpeningHoursSpecification`).

---

## §M — Metals Catalog (DECISION D2)

### Option A — Default (recommended): keep 22 seeded metals

Don't touch `metals` or `metal_prices`. Use the §B3 crosswalk (which targets `metal_categories.slug`). Ignore the 245 `metal` posts. Rationale in `01-inspection-report.md §6`.

### Option B — Import 245 `metal` posts as additional metals + price seed

If D2 = "Option B", emit one `metals` row per dump grade and one `metal_prices` row from postmeta. Mapping fields are below; the **definitive 245-grade crosswalk** is in §M2.

| `metals` column | Source |
|---|---|
| `slug` | `posts.post_name` (kept verbatim — adds to the 22 seeded slugs) |
| `name` | `posts.post_title` (HTML-decode) |
| `category` | per §M2 (e.g. `copper`, `steel`, `aluminum`) — never NULL |
| `unit` | `'lb'` (no unit info in dump) |
| `description_md` | `posts.post_content` (HTML→MD) if non-empty, else NULL |
| `prep_tips_md` | NULL |
| `spot_factor` | NULL |
| `spot_metal` | derived from `category` (`copper`→`copper`, `aluminum`→`aluminum`, `steel`→`steel`, `brass`→`copper`, `lead`→`lead`, `zinc`→`zinc`, `precious-metals`→`silver`/`gold` per slug, `electronics`→NULL, `auto-parts`→NULL) |
| `display_order` | 100 |

Plus one `metal_prices` row per metal:

| `metal_prices` column | Source |
|---|---|
| `metal_slug` | `posts.post_name` |
| `region_code` | `'US'` |
| `price` | `postmeta.metal_price` (numeric) |
| `source` | `'wp-import'` |
| `recorded_on` | `postmeta.last_update` (parsed) |

Skip rows where `metal_price` is missing/zero or `last_update` is unparseable.

### §M2 — Definitive 245-Grade Crosswalk (only used if D2 = Option B)

Each of the 245 distinct WP `metal` post slugs is mapped below. The right column is either an **existing seeded `metals.slug`** (we add the WP slug as an alias by inserting a new row whose `category` and `spot_metal` mirror the family) OR `UNRESOLVED` (meaning no clean home in the current 9-category schema — Phase 3 must surface a human decision).

**Family → seeded representative slug → `metal_categories.slug`** (this is what `metals.category` will hold for the new rows):

```text
bare-bright-copper  family → metals.category = "copper"            (2 grades)
copper-1            family → metals.category = "copper"            (1)
copper-2            family → metals.category = "copper"            (51)
copper-pipe         family → metals.category = "copper"            (4)
aluminum-mixed      family → metals.category = "aluminum"          (29)
aluminum-cans       family → metals.category = "aluminum"          (1)
aluminum-extrusion  family → metals.category = "aluminum"          (5)
steel-heavy-melt    family → metals.category = "steel"             (17)
light-iron          family → metals.category = "steel"             (6)
cast-iron           family → metals.category = "steel"             (2)
stainless-steel     family → metals.category = "steel"             (14)
brass-yellow        family → metals.category = "brass"             (14)
brass-red           family → metals.category = "brass"             (9)
lead-soft           family → metals.category = "lead"              (3)
lead-wheel-weights  family → metals.category = "lead"              (1)
zinc-die-cast       family → metals.category = "zinc"              (1)
low-grade-board     family → metals.category = "electronics"       (10)
silver              family → metals.category = "precious-metals"   (1)
gold                family → metals.category = "precious-metals"   (1)
car-battery         family → metals.category = "auto-parts"        (5)
catalytic-converter family → metals.category = "auto-parts"        (6)

UNRESOLVED — needs human decision                                  (62)
```

Per-slug assignments (full enumeration of all 245):

| Family / target | Source `posts.post_name` slugs (WP) |
|---|---|
| **bare-bright-copper** (copper) | `1-bare-bright-copper-wire`, `bare-bright-copper` |
| **copper-1** (copper) | `1-prepared` |
| **copper-2** (copper) | `2-3-mix-copper`, `2-3-mix-copper-2`, `2-copper-tubing`, `2-heavy-melting-steel`, `2-heavy-melting-steel-2`, `2-hms`, `2-hms-2`, `2-prepared`, `2-prepared-2`, `3-copper-with-tar`, `3-copper-with-tar-2`, `3-roofing-copper`, `500-750-insulated-cable`, `al-copper-cutoffs`, `al-copper-rads-w-iron`, `alternators`, `aluminum-copper-coil`, `burnt-copper`, `catv-wire`, `clean-al-copper-fin`, `clean-roofing-copper`, `communications-wire`, `compressors`, `computer-wire`, `copper-scrap`, `copper-transformers`, `copper-turnings`, `copper-yokes`, `dirty-al-copper-fin`, `dirty-roofing-copper`, `double-insulated-cable`, `ec-wire`, `electric-motors-copper`, `elevator-wire`, `enameled-copper`, `fire-wire`, `fire-wire-2`, `heliax-wire`, `housewire`, `insulated-copper-cable`, `insulated-copper-wire`, `lead-coated-copper`, `light-copper`, `meatballs-electric-motors`, `romex-wire`, `silver-plated-copper`, `thhn-wire`, `tin-coated-copper`, `tin-insulated-copper-wire`, `wire-scrap`, `wiring-harness` |
| **copper-pipe** (copper) | `1-copper-tubing`, `1-flashing-copper`, `acr`, `acr-ends` |
| **aluminum-mixed** (aluminum) | `al-thermopane`, `aluminum-3`, `aluminum-boat`, `aluminum-breakage`, `aluminum-bumpers`, `aluminum-clips`, `aluminum-diesel-tank`, `aluminum-engine-block`, `aluminum-litho`, `aluminum-rims`, `aluminum-scrap`, `aluminum-siding`, `aluminum-thermo-pane-break`, `aluminum-thermo-pane-break-2`, `aluminum-transformers`, `aluminum-turnings`, `aluminum-wire-w-steel`, `aluminum-wire-w-steel-2`, `cast-aluminum`, `clean-al-wire`, `dirty-aluminum-turnings`, `electric-motors-aluminum`, `insulated-aluminum-wire`, `old-sheet-aluminum`, `painted-aluminum`, `plate-structural-steel`*, `prepared-aluminum`, `sheet-aluminum`, `zorba` |
| **aluminum-cans** (aluminum) | `aluminum-cans` |
| **aluminum-extrusion** (aluminum) | `al-extrusion`, `aluminum-6061`, `aluminum-6063`, `dirty-al-extrusion`, `junkshop-extrusion` |
| **steel-heavy-melt** (steel) | `1-hms`, `1-steel`, `busheling`, `cpu-chips`*, `high-speed-steel`, `insulated-steel-bx`, `laptops`*, `machine-shop-turning-iron-borings`, `pc-board-with-steel`*, `scrap-iron`, `shreddable-steel`, `steel-bx`, `steel-case-batteries`, `steel-shavings`, `unprepared-hms`, `unprepared-ps`, `wet-automobile` |
| **light-iron** (steel) | `1-heavy-melting-steel`, `light-iron`, `platinum`*†, `tin`*, `washing-machines`, `water-heaters` |
| **cast-iron** (steel) | `cast-iron`, `unprepared-cast-iron` |
| **stainless-steel** (steel) | `17-4-stainless-steel`, `300-series-stainless-steel`, `304-stainless-steel`, `310-stainless-steel`, `316-stainless-steel`, `321-stainless-steel`, `400-series-stainless-steel`, `non-magnetic-stainless-steel`, `stainless-steel`, `stainless-steel-breakage`, `stainless-steel-heatsinks`, `stainless-steel-kegs`, `stainless-steel-sinks`, `stainless-turnings` |
| **brass-yellow** (brass) | `brass`, `brass-hair-wire`, `brass-heater-cores`, `brass-pipe`, `brass-scrap`, `brass-shells`, `brass-turnings`, `clean-brass-turnings`, `dirty-brass`, `plumbers-brass`, `refined-rebrass-copper`, `rod-brass`, `rod-brass-turnings`, `yellow-brass` |
| **brass-red** (brass) | `aluminum-copper-radiators`, `aluminum-radiators`, `brass-radiators`, `clean-brass-radiators`, `dirty-al-radiators`, `dirty-brass-radiators`, `red-brass`, `semi-red-brass`, `unclean-brass-radiators` |
| **lead-soft** (lead) | `lead`, `lead-batteries`, `lead-shot` |
| **lead-wheel-weights** (lead) | `lead-wheel-weights` |
| **zinc-die-cast** (zinc) | `zinc` |
| **low-grade-board** (electronics) | `circuit-breakers`, `hard-drive-boards`, `hard-drives-without-boards`, `keyboards`, `low-grade-boards`, `mainframes`, `motherboards`, `non-green-pc-board`, `pc-boards`, `telecom-equipment` |
| **silver** (precious-metals) | `silver` |
| **gold** (precious-metals) | `gold` |
| **car-battery** (auto-parts) | `backup-batteries`, `car-truck-batteries`, `car-truck-batteries-2`, `forktruck-battery`, `ni-cad-batteries` |
| **catalytic-converter** (auto-parts) | `catalytic-converters`, `large-foreign-catalytic-converter`, `large-gm-catalytic-converter`, `regular-domestic-catalytic-converter`, `small-foreign-catalytic-converter`, `small-gm-catalytic-converter` |

\* = approximate fit (a reasonable match given the 9-category schema, but not perfect — humans may want to relabel). Specifically: `platinum` and `tin` are bucketed into `light-iron` only because no `tin`/`platinum` slot exists in the seeded `metal_categories`; `cpu-chips`/`laptops`/`pc-board-with-steel` are mostly steel housings around boards; `plate-structural-steel` is steel mislabeled as aluminum-mixed because slug starts with `plate` — Phase 3 should reroute it to `steel-heavy-melt`.

† Note: `platinum` is genuinely a precious metal but the seeded `metals` table has no `platinum` slug (only `silver` and `gold`). Phase 3 should propose adding a `platinum` row rather than coercing it to steel.

#### Unresolved 62 grades (require explicit human decision before Option B)

Bucket | Grades | Suggested treatment
---|---|---
**Bronze family (no `bronze` slot in `metal_categories`)** | `bronze`, `bronze-turnings` | Map to `brass-red` (closest copper alloy) — same logic as the §B3 `gd_placecategory` `bronze→brass` decision
**Whole-vehicle grades** | `automobiles`, `car-w-tires`, `car-w-tires-2`, `complete-car`, `crushed-cars`, `dry-automobile`, `incomplete-car`, `uncleaned-auto-cast` | Map to `auto-parts` family with new slug `complete-vehicle`?
**Specialty alloys (no schema home)** | `carbide`, `cobalt`, `f-75`, `fsx-414`, `hastelloy-solids`, `hastelloy-turnings`, `inconel`, `inconel-792`, `inconel-800`, `inconel-825`, `invar`, `kovar`, `marm247`, `monel`, `nickel`, `o2-sensors`, `pewter`, `tin-babbit` | Add a new `metal_categories.slug = 'specialty-alloys'`?
**Catalysts (subset of converters)** | `large-foreign-cat`, `large-gm-cat`, `regular-domestic-cat`, `small-foreign-cat`, `small-gm-cat` | Merge into the corresponding `catalytic-converter` rows (duplicates of the `*-catalytic-converter` set above)
**E-waste sub-grades** | `ballasts`, `cellphones`, `christmas-lights`, `crt`, `empty-pc-servers`, `fuses`, `hard-drives`, `ink-cartridges`, `lcd-monitors-not-working`, `lcd-monitors-working`, `memory`, `mice`, `pc-tower`, `power-supplies`, `printers-fax-machines`, `servers`, `solid-core-heliax`, `speakers`, `starters` | Map to `electronics` (extend the family) once D2 = Option B is chosen
**Scrap-yard whitegoods** | `composition-scrap`, `dishwashers`, `dryers`, `refrigerators`, `rotors`, `sealed-units`, `die-cast` | Map to `steel` (`light-iron`) — they're predominantly steel housing
**Copper sub-grades the regex missed** | `clean-acr`, `dirty-acr`, `dirty-acr-2` | Map to `copper-pipe` (ACR = air-conditioning refrigeration tubing — already copper-pipe family)

> **DECISION D2** — Default = **Option A** (keep 22 seeded metals, do not import 245). If overridden to Option B, the 62 unresolved grades must each get an explicit human decision; the table above is the recommended starting point.

---

## §N — Non-Migration Rules (explicit)

Records dropped from the load, by class:

| Class | Drop rule | Approx count | Reason |
|---|---|---:|---|
| **N1** Non-publish gd_place posts | `posts.post_status NOT IN ('publish')` for `post_type='gd_place'` | 0 (none observed) | Not a yard we want live |
| **N2** Dummy place_detail rows | `geodir_gd_place_detail.post_dummy = '1'` | 30 | Demo data |
| **N3** Non-publish place_detail rows | `geodir_gd_place_detail.post_status IN ('trash','auto-draft','inherit')` | 3,246 | Soft-deleted |
| **N4** ListingPro listings | `posts.post_type = 'listing'` (any status) | 3,090 | Agriculture/livestock — wrong dataset |
| **N5** All other post types | `posts.post_type NOT IN ('gd_place', 'metal' [if D2=B])` | ~1,400 | Pages, revisions, attachments, plugin junk |
| **N6** Non-US yards | `pd.country <> 'United States'` | 0 (none observed) | Out of scope (DECISION D5) |
| **N7** Orphan TT IDs in `pd.post_category` | TT IDs `3684`, `3686` | 1,026 yards reference these (silently ignored at the per-term level — yards still load, just without those specific category assignments) | No matching `term_taxonomy` row |
| **N8** DROP-bucket categories | terms in §B2 DROP list | applied per-term, not per-yard | Noise / not relevant |
| **N9** ListingPro `redirection_items` | all 42 rows | 42 | Agriculture redirects irrelevant to scrap content |
| **N10** Yards with no resolvable city | `pd.region` not in §B1, OR (no `geodir_post_locations` row AND `pd.city` empty) | expected 0–few | Cannot place on a city page; flag |
| **N11** ListingPro/Yoast/Kadence/etc. postmeta | `meta_key NOT IN ('metal_price','last_update' [if D2=B])` | ~46,000 | Schema/UI-specific to old themes |
| **N12** `geodir_attachments` rows | all rows (none reference our yards anyway) | 341 | No yard photos available |
| **N13** `geodir_business_hours` rows | all rows (none reference our yards) | small | Use inline `pd.business_hours` instead |
| **N14** `attached_assets/scrapyards_wp_6fz24_*.sql` | duplicate of `wp-dump.sql` (md5 identical) | n/a | Same content |

Phase 3 will emit per-class drop counts to `migration/output/03-validation-report.md`.

---

## §R — Legacy Redirects

Pull from `migration/input/gsc-pages.csv`. **Skip** `80TdVe_redirection_items` entirely (§N9).

### §R1 — Canonical `legacy_url` per yard (FULL absolute URL)

For each surviving yard (post-dedupe), pick the **canonical category** for its legacy URL using this priority (high → low):
`scrap-metals` → `recycling-centers` → `surplus-salvage-merchandise` → `metals` → `scrap-metals-wholesale` → `automobile-salvage` → `junk-dealers` → first category alphabetically.

```
yards.legacy_url = "https://scrapyards.io/services/united-states/{old_state_slug}/{old_city_slug}/{canonical_cat_slug}/{old_yard_slug}/"
```

This is the **full absolute origin URL** (scheme + host + path with trailing slash) so the dynamic DB-backed middleware fallback can match against either the incoming `Request.url` directly or against the GSC-indexed source. `old_state_slug`, `old_city_slug`, and `old_yard_slug` are the **suffixed** versions from the source (preserve `-1`, `-2`, etc.) since those are the URLs Google actually indexed.

The `yards.legacy_url` column is `varchar(500)` (see schema) — confirmed long enough for every observed legacy URL (longest in the dump = 132 chars).

### §R2 — `legacy_redirects` rows from GSC

| Pattern | Count | `target_path` |
|---|---:|---|
| `/services/united-states/{state}/{city}/{cat}/{yard}/` | 639 | `/scrap-yards/{state-normalized}/{city-normalized}/{yard-deduped-slug}/` (resolve via `(state, city, base-slug)` against loaded yards) |
| `/services/united-states/{state}/{city}/{cat}/` | 123 | `/scrap-yards/{state-normalized}/{city-normalized}/` |
| `/services/united-states/{state}/{city}/` | 4 | `/scrap-yards/{state-normalized}/{city-normalized}/` |
| `/services/category/...` | 157 | `/scrap-metal-prices/` (catch-all; refine in Phase 4) |
| `/blog/metal/{metal-slug}/` | 49 | `/scrap-metal-prices/{metal-slug}/` if `metal-slug` ∈ `metals.slug`, else `/scrap-metal-prices/` |
| `/scrap-yards-{state}/` | 8 | `/scrap-yards/{state-normalized}/` |
| `/scrap-metal-prices/` | 1 | `/scrap-metal-prices/` |
| `/blog/{slug}/` | 2 | preserve as-is — emit no redirect row |
| Misc / depth ≤ 2 / `https://scrapyards.io//` | 16 | one-off, manual review file |

### §R3 — `legacy_redirects` rows from dedupe losers

For every loser merged into a winner during §C3.3, emit:

```
source_path = "/services/united-states/{old_state_slug}/{old_city_slug}/{loser_primary_cat}/{loser_raw_slug}/"
target_path = "/scrap-yards/{state-normalized}/{city-normalized}/{winner-deduped-slug}/"
```

### §R4 — Synthetic per-yard redirect (always emit)

For every surviving yard whose `legacy_url` is not already in the GSC list, also emit a `legacy_redirects` row from `yards.legacy_url` to `/scrap-yards/{state}/{city}/{slug}/`. This guarantees that any deep link in the wild — not just the GSC top-1000 — resolves.

### §R5 — Rules

- `status_code` = `301`
- Lowercase `source_path` before insert
- Always end paths with `/`
- Primary key collision: keep the row with the more-specific target (longer `target_path` wins)

**Estimated final `legacy_redirects` row count:** ~9,000 (~830 from GSC + 8,200 synthetic per-yard + dedupe-loser rows).

---

## §V — Validation Rules (report-only; do not abort)

Validity per yard:

- `name` non-empty
- `state_code` ∈ §B1
- `city_id` resolves
- `slug` matches `^[a-z0-9-]+$`
- Either (`lat` AND `lng`) OR (`address` AND `zip`)
- `phone` non-empty (100% of source has it — flag any miss)

Counts to write to `migration/output/03-validation-report.md` in Phase 3:
- yards inserted; yards skipped per N1–N14
- yards merged by §C3.3 dedupe (count, top-10 examples)
- cities inserted (per state)
- redirects inserted vs skipped per reason
- websites filtered as placeholders (count + sample list)
- business_hours that fell back to `{"raw": ...}` (count)
- yards routed to `'draft'` for missing geo (count + sample)

---

## §J — Join Graph

```
posts (gd_place, publish)
  ├─ id ──── geodir_gd_place_detail.post_id          (1:1, 8,296)
  ├─ id ──── geodir_post_locations.post_id           (0..1, 5,119)
  └─ id ──── term_relationships.object_id ── term_taxonomy ── terms
                                            (taxonomy='gd_placecategory')

posts (metal, publish) [optional, 245]
  └─ id ──── postmeta.post_id   (meta_key IN ('metal_price','last_update'))
```

---

## §Z — Open DECISIONS Summary

| ID | Topic | Default |
|---|---|---|
| **D1** | METAL/SERVICE/DROP category split (§B2) | Use the proposed lists |
| **D2** | Import all 245 `metal` posts? (§M) | **No** — keep the 22 seeded |
| **D3** | `yards.hours` JSONB shape (§H) | `{day:[{open,close}\|"closed"]}` per day |
| **D4** | Yards with no category → `services: ['scrap-metals']`? | **Yes** |
| **D5** | Drop yards with `pd.country != 'United States'`? | **Yes** (count is 0 anyway) |
| **D6** | "~6,000 yards" expected, dump has 8,296 — migrate all? | **Yes** |
| **D7** | Drop yards' references to orphan TT IDs `3684`/`3686`? | **Yes**, silently |
| **D8** | `bronze` → `brass` (vs. drop)? | **Map to `brass`** |
| **D9** | `'closed'` status detection heuristics (§C3.5) | Use the substring rules |

**Confirm D1–D9 (or override) before Phase 3 begins.**

**Confirmed:** 2026-05-09 — D1–D9 accepted as proposed (D2 = Option A; D5 trivially holds with 0 non-US yards). Phase 3+ ETL is gated on this line via `migration/etl/src/preflight.ts`; see `MIGRATION_DECISIONS_CONFIRMED=1` for testing override.
