# Scrapyards.io

A Next.js 15 (App Router) directory and price reference site for scrap metal yards across the United States.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed-scrapyards` — seed states, cities, metals, prices, and sample yards
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `CRON_KEY` — secret for the `/api/cron/update-prices` endpoint

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Front-end: Next.js 15 App Router (ISR), React 19
- API routes: Next.js Route Handlers
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: Next.js (esbuild under the hood)

## Where things live

- `lib/db/src/schema/` — DB schema (states, cities, yards, metals, metal_prices, price_reports, legacy_redirects)
- `artifacts/scrapyards/app/` — Next.js App Router pages
- `artifacts/scrapyards/lib/` — db.ts (pool singleton), geo.ts (Haversine), seo.ts (JSON-LD helpers)
- `scripts/src/seed-scrapyards.ts` — seed script (all 50 states, sample cities, 15 metals, prices, 8 yards)

## URL structure

| Path | Description |
|---|---|
| `/` | Homepage — hero, today's prices, state grid |
| `/scrap-yards/` | All states directory |
| `/scrap-yards/[state]/` | Cities in a state |
| `/scrap-yards/[state]/[city]/` | Yard listings in a city |
| `/scrap-yards/[state]/[city]/[slug]/` | Individual yard page (hours, prices, nearby) |
| `/scrap-prices/` | All metals hub |
| `/scrap-prices/[metal]/` | Metal price page — national + per-state table |
| `/scrap-prices/[metal]/[state]/` | Metal price in a specific state |
| `/calculator/` | Garage Scrap Calculator — pick items, enter ZIP, see range + nearby yards |
| `/calculator/api/prices/` | GET ?state=XX — current price map for a region |
| `/calculator/api/find-yards/` | POST — yards near ZIP that buy your materials |
| `/what-is-it-worth/` | Index — 50 common items grouped by category, current value range each |
| `/what-is-it-worth/[slug]/` | Item page — hero, what's inside, prep, 30/90-day chart, find yards, embedded Calculator, related items, FAQ |

## Architecture decisions

- Next.js App Router with ISR (revalidate: 900s for prices, 3600s for yards) for SEO + performance
- All 7 DB tables defined in `lib/db/src/schema/` as Drizzle schema, exported from `@workspace/db`
- Scrapyards app imports `@workspace/db` directly (server components only — no API layer needed)
- Legacy URL redirects handled at two levels: static `next.config.ts` redirects + dynamic DB-backed middleware fallback
- Price cron (`/api/cron/update-prices`) blends national spot prices with user-reported yard prices (weighted by recency and volume)
- Schema-level JSON-LD (LocalBusiness, UnitPriceSpecification) on every yard and price page for rich results

## Product

- Scrap yard directory: find yards by state → city → individual yard with hours, accepted materials, nearby yards
- Scrap metal prices: national and per-state averages for 15 metals, updated daily
- User price reports: POST `/api/price-report` to submit what you got paid at a yard
- Legacy URL redirects: migrates old `/services/united-states/...` and `/blog/metal/...` URLs automatically

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Migration

- **Date completed:** 2026-05-09
- **Source:** WordPress GeoDirectory dump (8,296 `gd_place` posts, dedup → 7,722 winners + 574 losers)
- **Result loaded into `public`:** 51 states, 9 metal_categories, 22 metals, 3,493 cities, 7,722 active yards, 8,989 legacy_redirects, 0 unverified/closed yards
- **Top 5 states by yard count:** TX 609, CA 505, PA 461, FL 452, OH 430
- **Click-weighted yard-level redirect resolution:** 77.8% (vs ~45% pre-fix; smoke-tested against 50 random GSC URLs)
- **Slug normalization rules in middleware** (`app/api/legacy-redirect/route.ts::tryNormalize`, called by `middleware.ts`):
  1. State alias map (9 entries — `delaware-2`, `indiana-1`, `kansas-1`, `michigan-1`, `nevada-2`, `north-dakota-1`, `south-dakota-1`, `virginia-2`, `washington-7`); other `-N` state slugs are NOT stripped.
  2. City segment: always strip `/-\d+$/`.
  3. Yard slug: strip `/-\d+$/` only if the cleaned slug exists for that (state, city); otherwise keep the suffix.
- **Rollback snapshot:** pre-migration `public.yards`, `public.cities`, `public.legacy_redirects`, `public.metal_prices`, `public.price_reports` are preserved in schema `public_pre_migration`.
- **Known caveat:** `public.metal_prices` was wiped by the migration (the WP source had no price data; staging contains no metal_prices). Cron `/api/cron/update-prices` repopulates it on next run. Pre-migration prices (1,122 rows) are in `public_pre_migration.metal_prices` for rollback if needed.
- **Verification scripts:**
  - `pnpm --filter @workspace/scripts run smoke-test-gsc` — 50-URL random sample histogram against the live dev server.
  - `pnpm --filter @workspace/scripts run test-slug-normalization` — black-box assertions on the runtime middleware.

## Calculator (`/calculator/`)

- **Pure compute lives in `lib/calculator-core.ts`** (no DB imports — safe for client bundles). DB loaders + re-exports in `lib/calculator.ts` (server-only).
- **`pct` in `items.components` is a recoverable-fraction**, not a percent-of-value. e.g. fridge `light-iron` pct=0.78 means 78% of the unit's weight is recovered as light iron.
- **Yard payout multipliers**: 50–70% of spot price (constants `YARD_PAYOUT_LOW/HIGH` in calc core).
- **Ton→lb conversion**: when `metals.unit='ton'` (light-iron, steel-heavy-melt), price is divided by 2000 before applying multipliers.
- **Unit-priced items**: when `items.avg_weight_lb IS NULL` and the only component's metal has `unit='each'` or `'oz'` (car-battery, catalytic-converter), value scales by quantity, not weight.
- **ZIP → coords** lookup is in `lib/zip-coords-server.ts` (server-only) and reads `lib/data/zip-coords.json` (~1.3 MB, 40,979 ZIPs from GeoNames). Falls back to the SCF state-prefix table + state centroid in `lib/zip-to-state.ts` when a ZIP isn't in the dataset (PO-box-only, retired, brand-new). The `lib/zip-to-state.ts` file is intentionally lightweight (no JSON dep) so it can be imported by client components.
- **`lib/data/zip-coords.json` is a committed data asset — do not delete as bloat.** Source: GeoNames `US.zip` (`https://download.geonames.org/export/zip/US.zip`), parsed to `{zip: [lat, lng, state]}`. Refresh annually (new ZIPs are issued each year): re-download, run the parser used to build it, replace the file. Licensed **CC BY 4.0** — credit line "ZIP code coordinates: GeoNames (CC BY 4.0)" must appear in the footer or About page before launch.
- **API routes are under `/calculator/api/*`**, NOT `/api/*` — the shared proxy routes `/api/*` to the api-server artifact, so scrapyards-owned API routes for the calculator must be nested under a path scrapyards owns.
- **Yard accepted-array gotcha**: ~89% of yards have empty `accepted` arrays. Find-yards endpoint treats empty as "accepts all" with a UI note ("Accepted materials list not on file — call ahead").
- **URL state**: `?i=slug:qty,slug:qty&z=ZIP`. Server pre-renders initial result for SEO/share-link round-trip; client recomputes on every change.
- **JSON-LD**: `WebApplication` (free tool) + `FAQPage` (4 Q&As) on the calculator page.

## What-Is-It-Worth (`/what-is-it-worth/`)

- **Index + 50 item pages.** All pre-rendered via `generateStaticParams` with `dynamicParams=false`. ISR `revalidate=900s`.
- **Per-item value range** computed via the same `computeCalc()` used by the calculator (qty=1, US prices). Unit-priced items (car-battery, catalytic-converter) handled correctly — value scales by quantity, no weight column.
- **Price chart**: server-rendered SVG sparkline of the 90-day spot price for the item's dominant metal (highest weight share), via `lib/item-history.ts::loadMetalHistory + projectItemValueSeries`. Falls back to "Not enough price history" message when `metal_prices` is sparse (post-migration state until cron repopulates).
- **JSON-LD per item page (5 blocks)**: BreadcrumbList, Article, FAQPage (4 Q&As), HowTo (prep steps), Product+Offers (low/high). NO aggregateRating.
- **Embedded `<Calculator>`** uses `syncUrl={false}` to disable the hardcoded `router.replace("/calculator/?...")` URL sync — otherwise the host item page would navigate away on hydration. The "Use the full calculator" footer link points to `/calculator/?i={slug}:1` for the share-link round-trip.
- **Internal linking**: homepage Popular items section (6 featured items) + "Learn more about {name}" link in each Calculator cart line.
- **Sitemap**: `/what-is-it-worth/` adds 51 entries (1 index + 50 items).

## Yard description generation

**Status (2026-05-10): Pivoted to slot-filling templates.** v1/v2/v3 free-form
LLM pilots all hit the spec's stop conditions (v1 retro 69% reject under v3
rules > 50% STOP threshold, v3 first-try 68% < 80% target). The class of
problem (model-side hallucinations of comparative/region/time language) does
not survive any reasonable rate at 7,700-yard AdSense scale. Switched
architectures rather than continuing to harden the prompt+validator loop.

### Templated pipeline (`scripts/src/generate-yard-descriptions-templated.ts` + `scripts/src/yard-desc-templates.ts`)

- **Architecture:** pre-screened sentence templates × deterministic
  slot-filling. No LLM, no inference, no creative latitude. Output is
  identical for the same yard on every re-run (md5(slug) → xorshift32 PRNG).
- **Template library:** 30 openings × 35 materials (15 with-data + 20 no-data) ×
  15 operations × 16 closers (8 general + 4 auto + 4 industrial). Closer
  pool is filtered by `service_focus` so auto yards get auto-flavored
  closers, etc. Combinations: ~30 × 35 × 15 × 16 = 252,000 unique
  permutations across ~7,700 yards (any reader-detectable pattern is
  effectively impossible). The no-data pool was expanded 5→20 in pilot v2
  to drop top-share at sparse-yard production scale (~89% of yards have
  empty `accepted[]`).
- **Slot variables:** `{yard_name}` (used 1× total — opening only),
  `{city}`, `{state_name}` (50-state lookup), `{primary_category}` (mapped
  from `service_focus`: auto-salvage / industrial steel and scrap /
  scrap metal recycling / etc.), `{accepted_list}` (Oxford-comma format,
  capped at 8, slug→human label via 38-entry MATERIAL_LABELS map),
  `{county_phrase}` (only when `county_known=true`, else expands to ""),
  `{hours_phrase}` and `{contact_phrase}` (derived from
  hours_structured/has_phone/has_website/has_email; lowercased so they read
  cleanly mid-sentence — renderer auto-capitalizes sentence-starts in
  post-process), `{pronoun_subject}` ("the yard" / "the business" /
  "the operation" / "the team" / "this site" — varies by yard seed).
- **Why no website URL or phone in text?** The v3 validator rejects
  any digit-run not present in source facts, and URLs/numbers would
  trip it. Text refers to channels by name only ("a phone line is on
  file") with no actual values; the data appears in structured page
  components, not the description prose.
- **Cost:** $0. Bulk run on ~7,672 remaining yards is single-process,
  one Postgres connection, deterministic per-yard render. Wall-clock
  estimate <2 min.
- **Validator:** uses the same `yard-desc-validator.ts` v3 rules as the
  LLM pipeline. Templates were pre-screened against the v3 stop-list
  (STOP_COMPARATIVE/REGION/TIME, BANNED_PHRASES/OPENERS, no digits, name
  ≤2). Validation is a sanity net, not a retry loop — if a template ever
  fails validation, that's a template-library bug to fix loudly, not
  a per-yard retry.
- **Run:** `pnpm --filter @workspace/scripts run generate-yard-descriptions-templated [-- --mode=pilot|bulk] [--dry-run] [--limit=N]`.
- **Pre-bulk coverage gate** (`scripts/src/yard-desc-templated-coverage-check.ts`,
  registered as `pnpm --filter @workspace/scripts run yard-desc-templated-coverage-check`):
  renders + v3-validates 30 seeds × 58 data shapes = 1,740 combos covering every
  DB-present accepted slug + 8 synthetic at-risk slugs (`copper-1/2/3`,
  `foo-2`, `metal-foo-bar`, `ten-99-test`, etc.), both `county_known` states, both
  `accepted_on_file` states. Required to pass before any bulk run or template-library
  change. Current status: 1,740/1,740 pass.
- **Hardening note (post-pilot):** `MATERIAL_LABELS["copper-1"]/["copper-2"]`
  originally mapped to text with literal digits ("no. 1 copper"); replaced with
  "number one copper" / "number two copper". `humanizeMaterial` fallback for
  unknown slugs now spells out trailing single-digit suffixes and strips embedded
  digits, so any future digit-bearing slug cannot leak digits into rendered text
  (which would fail the v3 unsourced-digits check). Production DB currently has
  only 6 generic accepted slugs (none digit-bearing) so this is future-proofing,
  not an active bug.

### Decision log — exploration history (archival)

> Yard descriptions: explored LLM free-form generation in three iterations
> (v1 with 100 yards, v2 with 50 narrowed-validation, v3 with 50 + retro-
> validation of v1). v3 retro showed 69% reject rate against the v3
> stop-list, hitting both spec stop conditions. Free-form was abandoned.
> Final architecture is slot-filling templates
> (`scripts/src/yard-desc-templates.ts`) — deterministic, $0 API cost,
> 100% validator pass on pilots, 99.25% bulk success.

## Maps

Embedded interactive maps on yard, city, and state pages.

- **Provider:** Mapbox GL JS (v3, `mapbox-gl` + `@types/mapbox-gl`).
- **Token:** `NEXT_PUBLIC_MAPBOX_TOKEN` — public, domain-scoped (Mapbox public tokens are designed to ship to the browser; URL allowlist is the protection mechanism).
- **Components** (`artifacts/scrapyards/app/_components/maps/`):
  - `YardMap.tsx` — single pin on yard pages, popup with name + address, "Open in Google Maps" link below. Mobile (`window.innerWidth < 700`): `dragPan: false` to avoid scroll-fight.
  - `CityMap.tsx` — scatter of all coord-having yards in city, auto-fit bounds (padding 50, maxZoom 14), popup per pin with "View yard →" link.
  - `StateMap.tsx` — top-100 yards by distance from `STATE_CENTROIDS[stateCode]` (computed server-side via `metersBetween`), GeoJSON cluster source (`clusterMaxZoom: 12`, `clusterRadius: 50`), color steps at 10/30 yards. Click cluster to expand.
- **All three:** `"use client"` + IntersectionObserver lazy-init (`rootMargin: 200px`) + `await import("mapbox-gl")` inside `useEffect`. `scrollZoom: false` so map doesn't hijack page scroll. Brand-color (#e85d2e) markers.
- **CSS import:** `mapbox-gl/dist/mapbox-gl.css` is imported **once in `app/layout.tsx`**, NOT in each map component. Importing it inside a `"use client"` component breaks webpack's `__webpack_require__.n` helper intermittently (after HMR or route navigation), causing the page to crash on hydration. Cost: ~30 kB raw / ~6 kB gzipped added to all pages — acceptable trade-off for stability.
- **Why no `dynamic({ ssr: false })`:** Next.js 15 forbids `ssr: false` in server components. Direct import of the `"use client"` component is correct — server pre-renders the empty container `<div>`; mapbox-gl only loads in-browser when the IntersectionObserver fires.
- **State page top-100 query:** parallel SELECT alongside cities query, filters `lat IS NOT NULL AND lng IS NOT NULL`, JS-sorts by haversine to centroid, slices 100. "Showing the 100 yards closest to the {state} center" caption appears when total > 100.
- **Bundle impact:** +1–2 kB to first-load JS per route; mapbox-gl in its own ~1.7 MB unminified chunk (~250–400 kB gzipped) lazy-loaded only when scrolled near viewport.
- **LCP:** unaffected — empty div server-rendered, all JS deferred.
- **Free tier:** Mapbox 50k map loads/month (sufficient for current traffic).
- **Pre-deploy reminder:** **lock the token** in the Mapbox account → Access tokens settings to URL allowlist `scrapyards.io/*` + `*.replit.dev/*` before VPS cutover. Token works without it but is unrestricted until then.
- **TODO (manual, pre-DNS-cutover — requires Tunde's Mapbox account access):** in [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens/), edit the production token and set the URL allowlist to:
  - `https://scrapyards.io/*`
  - `https://*.scrapyards.io/*`
  - `https://*.replit.dev/*` (ongoing dev)
  - `http://localhost:3000/*` (local dev)
- **Verification:** Lighthouse cannot run in the Replit env (no Chromium). Run via PageSpeed Insights (`pagespeed.web.dev`) on the deployed URL post-publish; expect Performance ≥ 80, SEO ≥ 95, LCP = H1 (not map).

## City description generation

**Status (2026-05-10): Bulk complete.** 3,493/3,493 city directory pages have
templated descriptions (60–180 words; observed 64–97). Same slot-filling
architecture as `yard-desc-templates.ts`, $0 API cost, deterministic per-city
(md5(state/slug) → xorshift32).

### Pipeline (`scripts/src/city-desc-templates.ts` + `generate-city-descriptions.ts`)

- **Pools:** 15 openings × (8 rich-materials | 7 sparse-materials) ×
  (5 general | 4 auto | 4 industrial | 4 mixed | 4 singleton) closers.
  Rich-materials fire when `accepted_total_unique ≥ 3 AND empty_accepted_pct ≤ 80`,
  else sparse. Closer pool is selected by `service_focus_majority` + presence
  flags, with a special **singleton pool** for 1-yard cities (62% of all cities).
- **Verb agreement:** `{verb_s}` ("" / "s") and `{verb_be}` ("are" / "is") slots
  conjugate any sentence whose verb directly follows `{yard_noun}`. Required because
  yard counts span 1 (2,181 cities) to 114 (Houston). Same convention for
  `{auto_verb_s}` and `{industrial_verb_s}`.
- **Service-focus classification is exclusive priority** (auto > industrial >
  general). Each yard gets exactly one bucket so city-level
  auto+industrial+general counts sum to yard_count and the >0.5 / ≥0.7 ratio
  math is well-defined. **Pre-fix bug**: yards were counted in multiple buckets
  simultaneously, producing impossible aggregates like
  `{yard_count:1, auto:1, industrial:1, general:1}` and biased majority labels.
- **Singleton closer pool** exists because every multi-yard closer
  ("alongside the general-scrap yards", "{city}'s yards include {auto_count_word}
  {auto_noun}") presupposes ≥2 yards; with 2,181 1-yard cities this would
  collapse into "{city}'s yards include one auto-salvage specialist" prose.
  Three focus variants (general/auto/industrial), 4 templates each (2
  focus-specific + 2 generic shared). Pick by `yard_count <= 1` short-circuit.
- **No county/population data** on cities → all county and population template
  variants dropped; validator rejects any "X County" claim as unsourced.
- **Validator** wraps the same v3 stop-list (`yard-desc-validator.ts`) with
  city-appropriate facts blob and 60–180 word range. Skips name-repetition
  check (city names appear naturally several times).
- **Coverage gate** (`pnpm --filter @workspace/scripts run city-desc-templated-coverage-check`):
  6 representative shapes (3 singleton variants for general/auto/industrial
  focus, plus sparse-3yards-mixed, mid-8-general, mid-12-auto, dense-25-mixed,
  dense-47-industrial) × all template combos = 3,720 renders, all v3-validated
  + grammar-regex-checked. Required to pass before bulk. Current: 3,720/3,720.
- **Run:** `pnpm --filter @workspace/scripts run generate-city-descriptions [-- --mode=pilot|bulk] [--dry-run] [--limit=N] [--slugs=state/city,...]`.

### Page integration

- `artifacts/scrapyards/app/scrap-yards/[state]/[city]/page.tsx` renders
  `ct.descriptionMd` between the yard-count line and CityMap, splitting on
  blank lines into `<p>` tags. Schema field `descriptionMd` (`description_md
  TEXT`) added to `cities`; pure addition, no migration breakage.

### Singleton-city indexability (AdSense thin-content guard)

- **2,181 of 3,493 cities have exactly 1 active yard.** Even with the 80-word
  city description, those pages render at ~138–144 words total (Eagle Pass at
  2 yards is 175; Houston etc. clear comfortably). The lone yard's own
  detail page (~300+ words) already ranks for "scrap yards in {city}",
  so the city directory page is not competing for the same query.
- **Decision: `noindex, follow` for `yard_count === 1` cities; sitemap
  excludes them entirely.** Pages still exist, breadcrumbs work, internal
  link equity flows, legacy redirects resolve — only Google's index drops
  the thin pages.
- **Implementation:**
  - `app/scrap-yards/[state]/[city]/page.tsx::generateMetadata` runs a
    `count(*)::int` aggregate against active yards in the city and sets
    `robots: { index: false, follow: true }` when count === 1, else
    `index: true, follow: true`. Computed per-render (ISR `revalidate=3600s`)
    so a city that gains a 2nd yard auto-becomes indexable on next revalidate.
  - `app/sitemap.ts` builds a `cityId → activeYardCount` map from the same
    yards query and skips cities with count ≤ 1. Sitemap count drops from
    12,984 → 10,803 (verified).
- **Strict threshold:** `=== 1`. The 1→2 cliff is sharp because the second
  yard card adds ~30 rendered words plus the multi-yard prose framing
  (vs singleton-pool prose), putting 2-yard cities comfortably above the
  thin threshold.
- **Verified:** singleton pages emit `<meta name="robots" content="noindex,
  follow">`; multi-yard pages emit `index, follow`; lone yards on singleton
  cities still serve HTTP 200 with default-indexable robots.

## Pre-launch polish (2026-05-10)

- **Info pages**: `/about/`, `/contact/`, `/privacy/`, `/terms/`. Privacy and
  Terms are full production copy (12 and 16 numbered sections respectively),
  effective 2026-05-10, covering server logs, cookies, third parties (GA4,
  AdSense, Mapbox), data subject rights, retention, COPPA, "as is" warranty
  disclaimer, US$100 liability cap, Delaware governing law. Contact email
  `hello@scrapyards.io` is still a placeholder (REPLACE BEFORE LAUNCH if a
  different inbox is preferred). Footer in `app/layout.tsx` links to all 4.
  Sitemap entries at priority 0.3, monthly changefreq.
- **Cookie consent**: `app/_components/CookieBanner.tsx` (~50 lines, cookie-based).
  Sets `sy_consent=all|essential` (1-year, SameSite=Lax, Path=/). "Accept all"
  reloads the page so server-rendered analytics scripts pick up consent.
- **Google Analytics + AdSense**: `app/_components/Analytics.tsx` is a server
  component that reads the `sy_consent` cookie via `next/headers` and **only
  emits the `<Script>` tags when consent === "all"**. GA id: `G-8NB364QEGZ`,
  AdSense client: `ca-pub-4183031888320028`.
- **AdSenseUnit**: `app/_components/AdSenseUnit.tsx` (`"use client"`) renders the
  `<ins class="adsbygoogle">` tag and pushes adsbygoogle on mount, but only after
  reading `sy_consent === "all"` from `document.cookie`. Returns `null` otherwise,
  so non-consenting users get zero ad markup. Default slot `7063973314`,
  responsive auto format.
- **Ads placement (2 per page — AdSense approved for the domain)**: home, yard
  detail, city, state, what-is-it-worth index, item, and metal-slug pages each
  carry two `<AdSenseUnit />` instances (one mid-content, one near the bottom).
  **No ads** on `/calculator/`, `/search/`, or info pages.
- **`ads.txt`**: `public/ads.txt` — `google.com, pub-4183031888320028, DIRECT, f08c47fec0942fa0`.
  Verified served at `/ads.txt` as `text/plain; charset=UTF-8`.
- **Favicon**: `app/icon.tsx` uses Next.js `ImageResponse` to render a
  64×64 PNG with brand color `#c8401a` background and white "S". Replaces
  the prior static `public/favicon.svg` (the SVG file remains but Next's icon
  convention takes precedence).
- **Calculator CSS fix on item pages**: `calculator.css` was previously imported
  only in `app/calculator/page.tsx`, so the embedded `<Calculator>` on
  `/what-is-it-worth/[slug]/` rendered unstyled (raw inputs/buttons). Fix:
  `import "./calculator.css"` is now at the top of `Calculator.tsx` itself, so
  the stylesheet travels with the component wherever it's mounted. The import
  in `app/calculator/page.tsx` is now redundant but harmless. `FindYardsBox`
  uses inline styles + the existing `.wiit-yard-*` classes so it doesn't need
  a separate CSS import.

## Gotchas

- Metal slugs in the DB are granular (`bare-bright-copper`, `copper-1`, `aluminum-cans`, etc.) — do NOT use generic "copper" or "aluminum" as slugs in links
- The DB `@workspace/db` package exports all tables from root; import as `import { yardsTable } from "@workspace/db"`
- `pg` must be in `serverExternalPackages` in `next.config.ts` (native Node module, can't be bundled)
- After schema changes: `pnpm --filter @workspace/db run push`, then re-seed if needed

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details


