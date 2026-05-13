# WordPress Dump Inspection Report

**Dump:** `migration/input/wp-dump.sql` (57 MB, MySQL 8.0.43, DB `scrapyards_wp_6fz24`)
**Table prefix:** `80TdVe_`
**Tooling:** `migration/scripts/parse-dump.mjs` (custom Node streaming SQL parser — `mariadb-install-db` cannot initialize in the sandbox; see `migration/README.md`) + `migration/scripts/analyze.mjs`
**Raw machine-readable detail:** `migration/output/inspection-final.json`

---

## §1 — Headline Numbers

| Item | Count |
|---|---:|
| **Yards (real, publish, non-dummy)** | **8,296** |
| States covered | 51 (all 50 + DC) |
| Distinct city slugs in `geodir_post_locations` | 5,119 |
| Yards with phone | 8,296 (100%) |
| Yards with lat/lng | 8,296 (100%) |
| Yards with street address | 7,683 (92.6%) |
| Yards with ZIP | 7,993 (96.3%) |
| Yards with business hours (inline) | 5,997 (72.3%) |
| Yards with website | 4,736 (57.1%) |
| Yards with email | 3,898 (47.0%) |
| Yards with at least one category | 7,046 (84.9%) |
| Yards with photos in `geodir_attachments` | **0** |
| Metal price-page posts (`post_type='metal'`) | 245 |

> Note: original task said "~6,000 yards"; actual recoverable yard count is **~8,300**. Plan/scope accordingly (DECISION D6 in mapping spec).

---

## §2 — Where the Real Yards Live (CRITICAL)

The dump contains **two unrelated directory systems** in the same database. An earlier inspection pass sampled the wrong post type and was misleading.

### Use this — GeoDirectory (`post_type='gd_place'`)

- **8,296 published `gd_place` posts** (post IDs 38392–49042).
- Detail rows in `80TdVe_geodir_gd_place_detail` — 1:1 join on `post_id` = `posts.ID`, **0 orphans** when filtered to `post_status='publish' AND post_dummy IN ('0','')`.
- Categories via `term_relationships` → `term_taxonomy` (taxonomy `gd_placecategory`, 75 terms).
- City/state slugs in `80TdVe_geodir_post_locations` (5,119 rows; lookup by `post_id`).

### Ignore — ListingPro (`post_type='listing'`)

- 3,083 published `listing` posts. **100% agriculture / livestock / veterinary businesses** (Hartman's Butcher Shop, Tammany Veterinary Hospital, Zeller Harvesting Co, St. Lucie Cattle LLC, Hillis Custom Processing, …).
- Top title words: *veterinary (434), equipment (333), clinic (311), trucking (271), processing (260), custom (257), meat (245), harvesting (235), animal (216), hospital (161)*.
- Use `lp_listingpro_options`, `fave_*` postmeta, `listing-category` and `location` taxonomies — none of which map to scrap yards.
- **Skip entirely.**

### Other relevant post types

| Post type | Count | Decision |
|---|---:|---|
| `gd_place` | 8,296 | **Migrate** → `yards` |
| `metal` | 245 | Optional — see §6 |
| `attachment` | 783 | Skip (none belong to gd_place yards) |
| `page` | 60 | Skip |
| `revision` | 470 | Skip |
| All others (`product`, `listingpro_agent`, `nav_menu_item`, `wp_navigation`, `wp_block`, `wpforms`, `wpi_*`, `simple-pay`, `lp-*`, `oembed_cache`, `elementor_library`, `custom_css`, `wpcode`, `adstxt`, `wp_global_styles`, `post`) | <100 each | Skip |

---

## §3 — Full Source Schemas (for the tables we will read)

### §3.1 — `80TdVe_posts` (read with `post_type='gd_place'`)

| Column | Type | Notes |
|---|---|---|
| `ID` | `bigint unsigned NOT NULL AUTO_INCREMENT` | Primary key |
| `post_author` | `bigint unsigned NOT NULL DEFAULT 0` | Ignored |
| `post_date` | `datetime NOT NULL` | Local time; we use `post_date_gmt` |
| `post_date_gmt` | `datetime NOT NULL` | → `yards.created_at` |
| `post_content` | `longtext NOT NULL` | **Empty** for most gd_place posts; not migrated |
| `post_title` | `text NOT NULL` | → `yards.name` (HTML-decode `&amp;` etc.) |
| `post_excerpt` | `text NOT NULL` | Empty; ignored |
| `post_status` | `varchar(20) NOT NULL DEFAULT 'publish'` | Filter to `publish`. See §4 status table |
| `comment_status` | `varchar(20)` | Ignored |
| `ping_status` | `varchar(20)` | Ignored |
| `post_password` | `varchar(255)` | Ignored |
| `post_name` | `varchar(200) NOT NULL` | Source for `yards.slug` (after `-N` suffix strip — see mapping spec §C3) |
| `to_ping`, `pinged` | `text` | Ignored |
| `post_modified` | `datetime` | Ignored (use `post_modified_gmt`) |
| `post_modified_gmt` | `datetime NOT NULL` | → `yards.updated_at` |
| `post_content_filtered` | `longtext` | Ignored |
| `post_parent` | `bigint unsigned NOT NULL DEFAULT 0` | Ignored |
| `guid` | `varchar(255)` | Ignored |
| `menu_order` | `int NOT NULL DEFAULT 0` | Ignored |
| `post_type` | `varchar(20) NOT NULL DEFAULT 'post'` | Filter key |
| `post_mime_type` | `varchar(100)` | Ignored |
| `comment_count` | `bigint NOT NULL DEFAULT 0` | Ignored |

Indexes: `PRIMARY (ID)`, `post_name(191)`, `(post_type, post_status, post_date, ID)`, `post_parent`, `post_author`, `(post_type, post_status, post_author)`. AUTO_INCREMENT=49799.

### §3.2 — `80TdVe_geodir_gd_place_detail` (1:1 join)

| Column | Type | Used as | Notes |
|---|---|---|---|
| `post_id` | `bigint NOT NULL` | join key | PK; matches `posts.ID` |
| `post_title` | `text` | (cross-check vs `posts.post_title`) | Matches in 100% of cases |
| `_search_title` | `text NOT NULL` | — | Search index; ignored |
| `post_status` | `varchar(20)` | filter | Must equal `publish` |
| `post_tags` | `text` | — | Mostly empty; ignored |
| `post_category` | `text` | helper only | CSV of `term_taxonomy_id`s, but **unreliable** (contains orphan IDs `3683`, `3684`). Use `term_relationships` instead. |
| `default_category` | `int` | — | Same caveat as `post_category` |
| `featured` | `tinyint(1) NOT NULL DEFAULT 0` | — | All `0` for our set; ignored (do **not** map to `is_premium`) |
| `featured_image` | `varchar(254)` | — | All NULL/empty for our 8,296 yards; ignored |
| `submit_ip` | `varchar(100)` | — | Ignored |
| `overall_rating` | `float DEFAULT 0` | — | All `0`; ignored |
| `rating_count` | `int DEFAULT 0` | — | All `0`; ignored |
| **`street`** | `varchar(254)` | → `yards.address` | 92.6% filled |
| `street2` | `varchar(254)` | (append to `address` if non-empty) | <1% filled |
| **`city`** | `varchar(50)` | → `cities.name` (display) | 100% |
| **`region`** | `varchar(50)` | → state name → 2-letter `state_code` | 100% (full state names like "New York") |
| `country` | `varchar(50)` | filter | 100% "United States"; reject anything else |
| **`zip`** | `varchar(50)` | → `yards.zip` | 96.3% — stored as float string (e.g. `"53057.0"`); needs reformat |
| **`latitude`** | `varchar(22)` | → `yards.lat` (numeric 9,6) | 100% |
| **`longitude`** | `varchar(22)` | → `yards.lng` (numeric 9,6) | 100% |
| `mapview`, `mapzoom` | `varchar` | — | UI hints; ignored |
| `post_dummy` | `tinyint(1) DEFAULT 0` | filter | Drop `1` (30 demo rows) |
| **`phone`** | `varchar(254)` | → `yards.phone` | 100% — free-form; preserve raw |
| **`email`** | `varchar(254)` | → `yards.email` | 47%; lowercase + parse-validate |
| **`website`** | `text` | → `yards.website` | 57% — but ~30% are placeholder strings (e.g. "Sell your scrap here") that must be filtered |
| `facebook` | `text` | — | All empty for our set; ignored |
| **`business_hours`** | `text` | → `yards.hours` (JSONB) | 72%; GeoDirectory string format — see mapping spec §H |
| `package_id` | `int DEFAULT 0` | — | Ignored |
| `expire_date` | `date` | — | NULL for our set; ignored |
| `neighbourhood` | `varchar(50)` | — | Mostly empty; ignored |
| `claimed` | `int DEFAULT 0` | — | All `0`; ignored |

Indexes: `PRIMARY (post_id)`, `country`, `region`, `city`.

### §3.3 — `80TdVe_geodir_post_locations` (0..1 per yard)

| Column | Type | Used as |
|---|---|---|
| `location_id` | `int NOT NULL AUTO_INCREMENT` | PK |
| `country` | `varchar(50) NOT NULL` | (filter `United States`) |
| `region` | `varchar(50) NOT NULL` | sanity check vs `pd.region` |
| `city` | `varchar(50) NOT NULL` | sanity check vs `pd.city` |
| `country_slug` | `varchar(50) NOT NULL` | always `united-states` |
| `region_slug` | `varchar(50) NOT NULL` | → state slug (after dropping `-N` suffix) |
| `city_slug` | `varchar(50) NOT NULL` | → `cities.slug` (preferred over `slugify(city)`) |
| `latitude`, `longitude` | `varchar(22) NOT NULL` | sanity check |
| `is_default` | `tinyint(1) NOT NULL DEFAULT 0` | (no-op — only one row per post) |

Note: row count (5,119) < yard count (8,296). ~3,177 yards have **no** location row; mapping spec §C2 specifies the fallback.

### §3.4 — `80TdVe_terms`, `80TdVe_term_taxonomy`, `80TdVe_term_relationships`

Standard WordPress shape. Filter to `term_taxonomy.taxonomy='gd_placecategory'` (75 terms in use). `term_relationships.object_id` = `posts.ID`.

### §3.5 — `80TdVe_postmeta` (only for the optional metal-price import)

Read only: `meta_key IN ('metal_price', 'last_update')` for `post_id` in the 245 `metal` posts.

---

## §3.6 — Custom-Field Architecture: where each "field" actually lives

GeoDirectory does NOT store yard fields the way standard WordPress plugins do. Three storage locations are in play and the boundaries matter for Phase 3 — there is **zero useful yard data in `wp_postmeta`** for our 8,296 yards.

### A) `geodir_custom_fields` — schema definitions only (15 rows for `gd_place`)

This table defines **what fields a `gd_place` post type accepts** (it's a form-builder spec, not user data). All 15 rows are listed below. Each row tells GeoDirectory which physical column of `geodir_gd_place_detail` to render and how:

| `htmlvar_name` | `field_type` | `admin_title` | Storage location |
|---|---|---|---|
| `post_title` | text | Title | `posts.post_title` |
| `post_content` | textarea | Description | `posts.post_content` (empty for our yards) |
| `post_tags` | tags | Tags | `geodir_gd_place_detail.post_tags` (empty) |
| `post_category` | categories | Category | `term_relationships` (taxonomy `gd_placecategory`) |
| `address` | address | Address | `geodir_gd_place_detail.{street,street2,city,region,country,zip,latitude,longitude,mapview,mapzoom,neighbourhood}` |
| `post_images` | images | Images | `geodir_attachments` (0 rows for our yards) |
| `phone` | phone | Phone | `geodir_gd_place_detail.phone` |
| `email` | email | Email | `geodir_gd_place_detail.email` |
| `website` | url | Website | `geodir_gd_place_detail.website` |
| `facebook` | url | Facebook | `geodir_gd_place_detail.facebook` (empty) |
| `business_hours` | business_hours | Business Hours | **`geodir_gd_place_detail.business_hours`** (the standalone `geodir_business_hours` table is only used when this widget is configured to use a separate store; in this dump it is not — see §10) |
| `package_id` | text | Package | `geodir_gd_place_detail.package_id` (=0 for all) |
| `expire_date` | datepicker | Expire Date | `geodir_gd_place_detail.expire_date` (NULL for all) |
| `featured` | checkbox | Featured | `geodir_gd_place_detail.featured` (=0 for all) |
| `claimed` | checkbox | Is Claimed? | `geodir_gd_place_detail.claimed` (=0 for all) |

**Key point:** every yard field maps to a **physical column on `geodir_gd_place_detail`** (or to the standard WP/term tables for title and categories). There are **no extension tables** holding user-visible yard attributes. Phase 3 reads only `posts`, `geodir_gd_place_detail`, `geodir_post_locations`, and the term triple — nothing else carries data for our 8,296 yards.

### B) `wp_postmeta` (`80TdVe_postmeta`) — top keys by row count

```
11370 _wp_page_template      (page templates — pages, not yards)
 8331 _adv_ads               (ad-plugin internal data)
 3104 lp_listingpro_options  (the agriculture listings; not migrated)
 3084 post_views_count       (view counter; ignored)
 3064 fave_agents            (real-estate-theme leftovers; ignored)
 3064 fave_property_map_address  (same)
 3064 fave_property_location     (same)
 1571 _yoast_wpseo_metadesc      (SEO meta-descriptions for various post types)
 1511 _yoast_wpseo_focuskw_text_input
 1145 _wp_old_date
  784 _wp_attached_file
  782 _wp_attachment_metadata
  375 _edit_lock
  345 _edit_last
  277 _kad_post_content_style    (Kadence theme)
  277 _kad_post_vertical_padding
  277 _kad_post_layout
  276 _kad_post_transparent
  273 _kad_post_title
  252 _metaseo_metadesc
  245 metal_price                ← USED (only if D2 = "Option B")
  245 last_update                ← USED (only if D2 = "Option B")
  226 _yoast_wpseo_content_score
  218 wp-smpro-smush-data
  …
```

**Direct counts for our 8,296 `gd_place` yards in `postmeta`:**

| Key | Yards with row | Useful? |
|---|---:|---|
| `_thumbnail_id` | 0 of 8,296 | **No** — not even one yard has a featured-image meta row (and `geodir_gd_place_detail.featured_image` is also empty for all 8,296). |
| `_yoast_wpseo_metadesc` | <50 of 8,296 | **No** — too sparse to be worth importing |
| `_yoast_wpseo_focuskw_text_input` | <50 of 8,296 | No |
| `_kad_*` | 0 of 8,296 | No (Kadence theme metadata applies to pages/posts, not gd_place) |
| All others | 0 of 8,296 | No |

Conclusion: **we do not read `wp_postmeta` for yards at all**. The only `postmeta` access is the optional 245 `metal` posts' `metal_price` + `last_update` keys (§M).

### C) `geodir_gd_place_detail` (place-detail columns)

The full per-row data for each yard. Documented in §3.2 — all useful yard data lives here (and in `geodir_post_locations` for canonical slugs).

### D) Putting it all together

For any given yard field, here is the **canonical lookup**:

| Conceptual yard field | Read from |
|---|---|
| Yard ID | `posts.ID` |
| Slug | `posts.post_name` (then strip `-N` per spec §C3.1) |
| Name | `posts.post_title` |
| State, city, address, ZIP, lat/lng | `geodir_gd_place_detail.{region, city, street, zip, latitude, longitude}` |
| Canonical state/city slugs | `geodir_post_locations.{region_slug, city_slug}` (preferred) → fallback `slugify(pd.city)` |
| Phone, email, website | `geodir_gd_place_detail.{phone, email, website}` |
| Business hours | `geodir_gd_place_detail.business_hours` (string — not the `geodir_business_hours` table) |
| Categories (`accepted` + `services`) | `term_relationships` (filtered to `taxonomy='gd_placecategory'`) — **not** `pd.post_category` (the CSV is unreliable) |
| Photos | none available (`geodir_attachments` has 0 rows for our yards; `_thumbnail_id` postmeta has 0 rows for our yards) |
| Created/updated | `posts.post_date_gmt` / `posts.post_modified_gmt` |

---

## §4 — Field-Level Completeness on Real Yards (8,296 rows)

| Field | Filled | % | Notes |
|---|---:|---:|---|
| `post_title` | 8,296 | 100% | |
| `street` | 7,683 | 92.6% | |
| `city` | 8,296 | 100% | |
| `region` | 8,296 | 100% | Full state name |
| `country` | 8,296 | 100% | All "United States" |
| `zip` | 7,993 | 96.3% | Float-string format |
| `latitude` / `longitude` | 8,296 | 100% | |
| `phone` | 8,296 | 100% | Mostly `(NNN) NNN-NNNN` |
| `email` | 3,898 | 47.0% | |
| `website` | 4,736 | 57.1% | Includes placeholders to filter |
| `business_hours` | 5,997 | 72.3% | Inline string in `pd`; standalone `geodir_business_hours` table has **0** rows for our yards |
| `post_category` (CSV) | 8,296 | 100% | But unreliable — see §3.2 |
| `default_category` | 7,046 | 84.9% | |
| `facebook` / `twitter` / `video` / `special_offers` | 0 | 0% | All empty |
| Photos (`geodir_attachments`) | 0 | 0% | None reference our 8,296 yards |

**Status distribution on `gd_place` posts:** 8,296 publish, 0 draft, 0 pending, 0 trash.
(There is no "closed" status in WordPress core; legacy ListingPro had `expired` but that does not apply to `gd_place`.)

---

## §5 — Categories (taxonomy `gd_placecategory`, 75 terms)

7,046 yards (84.9%) have at least one category. Top 25 by usage (from `term_relationships`):

| TT ID | Slug | Name | Yards |
|---:|---|---|---:|
| 2572 | scrap-metals | Scrap Metals | 7,045 |
| 2600 | recycling-centers | Recycling Centers | 3,457 |
| 2601 | surplus-salvage-merchandise | Surplus & Salvage Merchandise | 1,747 |
| 2587 | metals | Metals | 1,545 |
| 2573 | scrap-metals-wholesale | Scrap Metals-Wholesale | 1,260 |
| 2672 | automobile-salvage | Automobile Salvage | 969 |
| 2669 | junk-dealers | Junk Dealers | 817 |
| 2575 | aluminum | Aluminum | 749 |
| 2582 | copper | Copper | 656 |
| 2718 | recycling-equipment-services | Recycling Equipment & Services | 619 |
| 2834 | automobile-parts-supplies | Automobile Parts & Supplies | 526 |
| 2694 | used-rebuilt-auto-parts | Used & Rebuilt Auto Parts | 510 |
| 2577 | brass | Brass | 497 |
| 2596 | smelters-refiners-precious-metals | Smelters & Refiners-Precious Metals | 495 |
| 2583 | lead | Lead | 458 |
| 2578 | bronze | Bronze | 454 |
| 2593 | professional-engineers | Professional Engineers | 449 |
| 2580 | construction-engineers | Construction Engineers | 448 |
| 2597 | structural-engineers | Structural Engineers | 448 |
| 2869 | automobile-parts-supplies-used-rebuilt-wholesale-manufacturers | … | 339 |
| 2676 | steel-distributors-warehouses | Steel Distributors & Warehouses | 323 |
| 2755 | steel-processing | Steel Processing | 308 |
| 2840 | truck-wrecking | Truck Wrecking | 298 |
| 2671 | waste-recycling-disposal-service-equipment | Waste Recycling & Disposal Service & Equipment | 270 |
| 2730 | garbage-collection | Garbage Collection | 260 |

Other metal-related: `iron`(167), `aluminum-products`(27), `copper-products`(40), `precious-metals`(28), `base-metals`(23), `alloys`(15), `plastics-scrap`(35), `waste-paper`(34), `farm-equipment`(10).

**Orphan TT IDs:** `3684` and `3686` appear in `pd.post_category` CSVs (1,026 yards) but have no matching `term_taxonomy` rows. Drop silently.

**Noise terms:** `professional-engineers`, `construction-engineers`, `structural-engineers` all share count `448` — auto-imported from a Yellow Pages-style scrape and not relevant to scrap recycling. Drop. (See spec §B2.)

---

## §6 — Metals Catalog (245 `metal` posts)

The current Postgres seed (`scripts/src/seed-scrapyards.ts`) has **22 metals** across **9 metal_categories**: `copper`, `aluminum`, `steel`, `brass`, `lead`, `zinc`, `electronics`, `precious-metals`, `auto-parts`.

The dump's 245 `metal` posts are a granular catalog: `1-bare-bright-copper-wire`, `1-copper-tubing`, `1-flashing-copper`, `1-heavy-melting-steel`, `2-3-mix-copper`, `3-roofing-copper`, `17-4-stainless-steel`, `bare-bright-copper`, `aluminum-cans`, etc. Each has `metal_price` (USD/lb) and `last_update` postmeta.

**Recommended posture (default):** keep the 22 seeded metals, do **not** import the 245. The seeded set already includes `bare-bright-copper`, `copper-1`, `copper-2`, `aluminum-cans`, `aluminum-extrusion`, `aluminum-mixed`, `steel-heavy-melt`, `light-iron`, `cast-iron`, `stainless-steel`, `brass-yellow`, `brass-red`, `lead-soft`, `lead-wheel-weights`, `zinc-die-cast`, etc. — covering the same ground in a tighter, schema-aligned way (`replit.md` Gotchas already says "metal slugs in the DB are granular"). Importing 245 would dilute and require a separate normalization pass. Mapping spec §M provides this as DECISION D2 (default = "keep 22 seeded").

---

## §7 — State & City Slugs

All 50 states + DC are present in `geodir_post_locations.region_slug`. **9 states have GeoDirectory disambiguation suffixes** that must be normalized at load time:

| GeoDirectory slug | Maps to |
|---|---|
| `delaware-2` | `delaware` |
| `indiana-1` | `indiana` |
| `kansas-1` | `kansas` |
| `michigan-1` | `michigan` |
| `nevada-2` | `nevada` |
| `north-dakota-1` | `north-dakota` |
| `south-dakota-1` | `south-dakota` |
| `virginia-2` | `virginia` |
| `washington-7` | `washington` |

**Yard slugs:** 1,310 of 8,296 (~16%) end in a numeric suffix (`-1` … `-7`). **No exact-duplicate yard slugs exist** in the source. After stripping the suffix (mapping spec §C3) and re-disambiguating against `(state_code, city_id)`, ≤ a few dozen collisions are expected — those get the suffix re-applied at the new uniqueness scope.

---

## §8 — Five Representative Sample Yards (end-to-end traces)

These five yards exercise different combinations of join shapes (with/without locations row, with/without email/website, with/without "noise" categories, with `-N` slug suffix, with multi-state and multi-category data). Used by Phase 3 for spot-check validation.

### Sample A — Irving Rubber & Metal Co (Brooklyn, NY) — minimal categories, placeholder website

```yaml
posts.ID: 40749
posts.post_name: "irving-rubber-metal-co"
posts.post_status: publish
posts.post_type: gd_place
posts.post_date_gmt: 2023-11-29 13:49:44
posts.post_title: "Irving Rubber & Metal Co"

geodir_gd_place_detail:
  street: "9525 Ditmas Ave"
  city: "Brooklyn"
  region: "New York"
  country: "United States"
  zip: "11236.0"          # → reformat to "11236"
  latitude: "40.65106"
  longitude: "-73.91043"
  phone: "(718) 346-4434"
  email: ""
  website: "Sell your scrap here"   # → must be filtered (placeholder, not a URL)
  business_hours: "Mon - Fri: 7:00 am - 5:00 pm Sat: 7:00 am - 1:30 pm"
  post_category: "3683"             # → orphan TT ID; ignored
  default_category: "2571"           # → ignored

geodir_post_locations: <none>       # falls back to slugify(city) = "brooklyn"

term_relationships → gd_placecategory:
  - {ttId: 2572, slug: scrap-metals,             name: "Scrap Metals"}
  - {ttId: 2573, slug: scrap-metals-wholesale,   name: "Scrap Metals-Wholesale"}

geodir_attachments: <none>

→ target row:
  yards.slug:       "irving-rubber-metal-co"
  yards.name:       "Irving Rubber & Metal Co"
  yards.state_code: "NY"
  yards.city_id:    <FK to (NY, "brooklyn")>
  yards.address:    "9525 Ditmas Ave"
  yards.zip:        "11236"
  yards.lat/lng:    40.651060 / -73.910430
  yards.phone:      "(718) 346-4434"
  yards.website:    NULL              # placeholder filtered out
  yards.email:      NULL
  yards.hours:      {mon-fri:[7:00-17:00], sat:[7:00-13:30], sun:closed}
  yards.accepted:   []                # no METAL-bucket cats
  yards.services:   ["scrap-metals", "scrap-metals-wholesale"]
  yards.legacy_url: "https://scrapyards.io/services/united-states/new-york/brooklyn/scrap-metals/irving-rubber-metal-co/"
```

### Sample B — ABC Salvage & Scrap Metal (Little Rock, AR) — multi-service, no website

```yaml
posts.ID: 40751
posts.post_name: "abc-salvage-scrap-metal"
posts.post_title: "ABC Salvage & Scrap Metal"

geodir_gd_place_detail:
  street: "8116 Stagecoach Rd", city: "Little Rock", region: "Arkansas"
  zip: "72210.0", lat: "34.67809", lng: "-92.41131"
  phone: "(501) 455-2225", email: "", website: ""
  business_hours: "Mon - Fri: 7:00 am - 5:00 pm Sat: 7:00 am - 11:30 am"

term_relationships → gd_placecategory:
  - 2572 scrap-metals
  - 2587 metals
  - 2600 recycling-centers
  - 2601 surplus-salvage-merchandise

→ target row:
  yards.slug:       "abc-salvage-scrap-metal"
  yards.state_code: "AR"
  yards.accepted:   []                # all four are SERVICE-bucket
  yards.services:   ["scrap-metals", "metals", "recycling-centers", "surplus-salvage-merchandise"]
```

### Sample C — Foltz Manufacturing & Supply Company (Hagerstown, MD) — many cats including "noise"

```yaml
posts.ID: 40752
posts.post_name: "foltz-manufacturing-supply-company"
posts.post_title: "Foltz Manufacturing & Supply Company"

geodir_gd_place_detail:
  street: "63 E Washington St", city: "Hagerstown", region: "Maryland"
  zip: "21740.0", lat: "39.64095", lng: "-77.71817"
  phone: "(301) 739-1076"
  email: "foltzsales@myactv.net"
  website: "http://foltzcompany.com"
  business_hours: "Mon - Fri: 7:00 am - 5:00 pm Sat - Sun Closed"
  post_category: "3684"               # → orphan; ignored

term_relationships → gd_placecategory (14 total):
  METAL bucket → ["aluminum", "brass", "bronze", "copper", "lead"]
  SERVICE bucket → ["scrap-metals", "metals", "smelters-refiners-precious-metals",
                    "plastics", "building-materials", "strip"]
  DROP bucket → ["construction-engineers", "professional-engineers", "structural-engineers"]

→ target row:
  yards.slug:       "foltz-manufacturing-supply-company"
  yards.state_code: "MD"
  yards.email:      "foltzsales@myactv.net"
  yards.website:    "http://foltzcompany.com"
  yards.accepted:   ["aluminum", "brass", "copper", "lead"]   # bronze→ no metal_categories slug; mapped to brass-family per spec §B3 ⇒ optionally dropped
  yards.services:   ["scrap-metals", "metals", "smelters-refiners-precious-metals",
                     "plastics", "building-materials", "strip"]
```

### Sample D — American Implement (Mount Calvary, WI) — `-N` slug suffix from GeoDirectory

```yaml
posts.ID: 38392
posts.post_name: "american-implement-2"        # ← strip suffix → "american-implement"
posts.post_title: "American Implement"

geodir_gd_place_detail:
  street: "N6503 Pit Rd", city: "Mount Calvary", region: "Wisconsin"
  zip: "53057.0", lat: "43.77688", lng: "-88.22077"
  phone: "(920) 922-9966", website: "http://americanimplementinc.com"
  business_hours: "Mon - Fri: 8:00 am - 5:00 pm Sat: 8:00 am - 12:00 pm Sun Closed"

term_relationships → gd_placecategory:
  - 2572 scrap-metals (SERVICE)
  - 2575 aluminum (METAL)
  - 2577 brass (METAL)
  - 2740 farm-equipment (SERVICE)
  - 2793 steel-erectors (SERVICE)

→ target row:
  yards.slug:       "american-implement"   # suffix stripped; unique within (WI, mount-calvary)
  yards.state_code: "WI"
  yards.accepted:   ["aluminum", "brass"]
  yards.services:   ["scrap-metals", "farm-equipment", "steel-erectors"]
  yards.legacy_url: "https://scrapyards.io/services/united-states/wisconsin/mount-calvary/scrap-metals/american-implement-2/"
```

### Sample E — The Gold Nook (Paris, TN) — jeweler/precious-metals oddball

```yaml
posts.ID: 40753
posts.post_name: "the-gold-nook"
posts.post_title: "The Gold Nook"

geodir_gd_place_detail:
  street: "1027 Mineral Wells Ave", city: "Paris", region: "Tennessee"
  zip: "38242.0", lat: "36.2891", lng: "-88.31158"
  phone: "(731) 644-9151"
  website: "https://www.facebook.com/TheGoldNook/?hc_ref=PAGES_TIMELINE"   # → social URL; keep as-is
  business_hours: "Mon - Fri: 10:00 am - 5:30 pm Sat: 10:00 am - 3:00 pm Sun Closed"
  post_category: "2627,2628,2629,2630,2631,2632,2587,2572"

term_relationships → gd_placecategory:
  - 2572 scrap-metals
  - 2587 metals
  - 2631 jewelers

→ target row:
  yards.slug:       "the-gold-nook"
  yards.state_code: "TN"
  yards.accepted:   []                       # no direct metal_categories match (gold lives in seeded metals, not metal_categories)
  yards.services:   ["scrap-metals", "metals", "jewelers"]
```

---

## §9 — Legacy URLs (for `legacy_redirects` table)

### From `80TdVe_redirection_items` (existing WP redirects)

42 enabled rows, **all 42 are agriculture-themed** (`/pork-processing/`, `/simmental-cattle/`, `/tractor-implements-list/`, `/custom-harvesting-companies-list/`, `/3-point-hitch/`, etc.) targeting `/blog/*`. They were defined for the previous incarnation of the site. **Do not import.**

### From `migration/input/gsc-pages.csv` (Google Search Console — 999 URLs)

| Pattern | Count | Maps to (new schema) |
|---|---:|---|
| `/services/united-states/[state]/[city]/[cat]/[slug]/` (yard) | 639 | `/scrap-yards/[state]/[city]/[slug]/` |
| `/services/united-states/[state]/[city]/[cat]/` | 123 | `/scrap-yards/[state]/[city]/` |
| `/services/united-states/[state]/[city]/` | 4 | `/scrap-yards/[state]/[city]/` |
| `/services/category/...` (multiple depths) | 157 | `/scrap-metal-prices/` (catch-all) |
| `/blog/metal/[metal-slug]/` | 49 | `/scrap-metal-prices/[metal]/` |
| `/scrap-yards-[state]/` | 8 | `/scrap-yards/[state]/` |
| `/scrap-metal-prices/` | 1 | `/scrap-metal-prices/` |
| `/blog/[post-slug]/` | 2 | preserve as-is (no redirect) |
| Misc / depth ≤ 2 | 16 | one-off |

GSC URLs include the legacy state-slug suffixes (`-1`, `-2`, …) and the category segment that the new schema does not include — both must be normalized in the redirect mapper (see mapping spec §R).

---

## §10 — Other Tables — Full Inventory

### §10.1 — Every `80TdVe_geodir_*` table (exact row counts)

The dump contains **22** GeoDirectory tables. Listed in row-count order with the read/skip decision:

| Table | Rows | Decision |
|---|---:|---|
| `80TdVe_geodir_gd_place_detail` | 11,572 | **READ** — source of truth (filter publish + non-dummy → 8,296) |
| `80TdVe_geodir_term_meta` | 7,368 | **SKIP** — per-term icon/color settings; not user data |
| `80TdVe_geodir_post_locations` | 5,119 | **READ** — authoritative city/state slug source (lookup by `post_id`) |
| `80TdVe_geodir_attachments` | 341 | **SKIP** — none reference our 8,296 yards (verified) |
| `80TdVe_geodir_pricemeta` | 201 | **SKIP** — package/pricing metadata for theme paywall; out of scope |
| `80TdVe_geodir_business_hours` | 35 | **SKIP** — none reference our 8,296 yards; we use inline `pd.business_hours` instead |
| `80TdVe_geodir_custom_fields` | 15 | **SKIP for data, READ for documentation** — schema-defs only (see §3.6) |
| `80TdVe_geodir_price` | 12 | **SKIP** — listing-package definitions |
| `80TdVe_geodir_post_packages` | 7 | **SKIP** — joins gd_place to packages; all 7 belong to demo posts |
| `80TdVe_geodir_tabs_layout` | 4 | **SKIP** — UI tab layout |
| `80TdVe_geodir_custom_sort_fields` | 2 | **SKIP** — sort UI config |
| `80TdVe_geodir_claim` | 1 | **SKIP** — single demo "claim this listing" record |
| `80TdVe_geodir_custom_advance_search_fields` | 1 | **SKIP** — advanced-search UI config |
| `80TdVe_geodir_api_keys` | 0 | **SKIP** (empty) |
| `80TdVe_geodir_cp_link_posts` | 0 | **SKIP** (empty) |
| `80TdVe_geodir_location_seo` | 0 | **SKIP** (empty) — we synthesize SEO copy in the new app |
| `80TdVe_geodir_post_neighbourhood` | 0 | **SKIP** (empty) |
| `80TdVe_geodir_post_reports` | 0 | **SKIP** (empty) |
| `80TdVe_geodir_post_review` | 0 | **SKIP** (empty) — no reviews to port |
| `80TdVe_geodir_save_search_emails` | 0 | **SKIP** (empty) |
| `80TdVe_geodir_save_search_fields` | 0 | **SKIP** (empty) |
| `80TdVe_geodir_save_search_subscribers` | 0 | **SKIP** (empty) |

### §10.2 — All other relevant `80TdVe_*` tables

| Table | Rows | Decision |
|---|---:|---|
| `80TdVe_posts` | 13,082 | **READ** `post_type='gd_place'` (8,296) and optionally `post_type='metal'` (245) |
| `80TdVe_postmeta` | 47,016 | **READ** only `meta_key IN ('metal_price','last_update')` for `metal` posts (490 rows); everything else dropped |
| `80TdVe_term_relationships` | 37,985 | **READ** filtered to `gd_placecategory` taxonomy |
| `80TdVe_term_taxonomy` | 2,343 | **READ** filtered to `gd_placecategory` |
| `80TdVe_terms` | 2,343 | **READ** (joined via `term_taxonomy`) |
| `80TdVe_termmeta` | 20 | **SKIP** — term icon/color overrides |
| `80TdVe_redirection_items` | 42 | **SKIP** — all 42 are agriculture-themed legacy redirects |
| `80TdVe_redirection_groups` | 2 | **SKIP** |
| `80TdVe_redirection_404` / `_logs` | 0 / 0 | **SKIP** |
| `80TdVe_options` | 1,339 | **SKIP** — theme/plugin settings |
| `80TdVe_users` | 7 | **SKIP** — admin accounts only |
| `80TdVe_usermeta` | 1,844 | **SKIP** |
| `80TdVe_comments` / `_commentmeta` | 36 / 0 | **SKIP** — no scrap-yard reviews |
| `80TdVe_links` | 0 | **SKIP** |
| `80TdVe_yoast_*` (5 tables) | 17,799 total | **SKIP** — SEO indexable cache; we generate fresh JSON-LD |
| `80TdVe_litespeed_*` (4 tables) | 37,752 total | **SKIP** — page-cache state |
| `80TdVe_actionscheduler_*` (4 tables) | 504 total | **SKIP** — scheduler internals |
| `80TdVe_wpforms_*` (5 tables) | 113 total | **SKIP** — contact-form submissions |
| `80TdVe_wc_*` / `_woocommerce_*` (~20 tables) | 1 row total | **SKIP** — WooCommerce never used |
| `80TdVe_getpaid_*` / `_wpinv_*` (4 tables) | 33 total | **SKIP** — invoicing plugin |
| `80TdVe_nf3_*` (8 tables) | 437 total | **SKIP** — Ninja Forms plugin |
| `80TdVe_pmxi_*` (6 tables) | 11,629 total | **SKIP** — WP All Import staging |
| `80TdVe_kbp_*` / `_kb_*` (7 tables) | 0 total | **SKIP** — Kadence plugin |
| `80TdVe_icwp_wpsf_*` (8 tables) | 0 total | **SKIP** — Shield Security plugin |
| `80TdVe_listing_*` (3 tables) | 0 total | **SKIP** — ListingPro analytics (agriculture-only anyway) |
| `80TdVe_bv_*` (4 tables) | 4,789 total | **SKIP** — BlogVault backup plugin |
| `80TdVe_cmplz_*` (4 tables) | 0 total | **SKIP** — cookie-consent plugin |
| `80TdVe_cp_calculated_fields_form_*` (4 tables) | 0 total | **SKIP** |
| `80TdVe_smush_dir_images`, `_metaseo_images`, `_alm`, `_p2p`/`_p2pmeta`, `_social_users`, `_aepc_*`, `_ezoic_endpoints`, `_wpfm_backup`, `_wpms_links`, `_wpmailsmtp_*`, `_countries`, `_scrap_metal_prices` (orphan empty), `_litespeed_crawler_blacklist` (37,027 entries — anti-bot list, not content) | various | **SKIP** — none contain yard content |

---

## §11 — Tooling & Reproducibility Notes

- `mariadb-install-db` fails in the Replit sandbox due to a `seccomp` `openat` syscall restriction — could not stand up local MariaDB.
- Workaround: streaming SQL parser `migration/scripts/parse-dump.mjs` (no whole-file buffering; correctly handles MySQL string escapes).
- `migration/scripts/analyze.mjs` reads pre-dumped JSONL files (one per WP table) and produces `migration/output/inspection-final.json`. **All numbers in this report come from `analyze.mjs`.**
- See `migration/README.md` for one-shot reproduction commands.
- An earlier `inspect.mjs` undercounted posts (3,494 instead of 13,082) because its in-process spawn consumer dropped data under back-pressure on very large rows; that script has been deleted in favor of the JSONL-based pipeline.
