# Calculator (`/calculator/`)

## Architecture

- **Pure compute lives in `lib/calculator-core.ts`** (no DB imports — safe for client bundles). DB loaders + re-exports in `lib/calculator.ts` (server-only).
- **`pct` in `items.components` is a recoverable-fraction**, not a percent-of-value. e.g. fridge `light-iron` pct=0.78 means 78% of the unit's weight is recovered as light iron.
- **Yard payout multipliers**: 50–70% of spot price (constants `YARD_PAYOUT_LOW/HIGH` in calc core).
- **Ton→lb conversion**: when `metals.unit='ton'` (light-iron, steel-heavy-melt), price is divided by 2000 before applying multipliers.
- **Unit-priced items**: when `items.avg_weight_lb IS NULL` and the only component's metal has `unit='each'` or `'oz'` (car-battery, catalytic-converter), value scales by quantity, not weight.

## ZIP lookup

- **ZIP → coords** lookup is in `lib/zip-coords-server.ts` (server-only) and reads `lib/data/zip-coords.json` (~1.3 MB, 40,979 ZIPs from GeoNames). Falls back to the SCF state-prefix table + state centroid in `lib/zip-to-state.ts` when a ZIP isn't in the dataset (PO-box-only, retired, brand-new). The `lib/zip-to-state.ts` file is intentionally lightweight (no JSON dep) so it can be imported by client components.
- **`lib/data/zip-coords.json` is a committed data asset — do not delete as bloat.** Source: GeoNames `US.zip` (`https://download.geonames.org/export/zip/US.zip`), parsed to `{zip: [lat, lng, state]}`. Refresh annually (new ZIPs are issued each year): re-download, run the parser used to build it, replace the file. Licensed **CC BY 4.0** — credit line "ZIP code coordinates: GeoNames (CC BY 4.0)" must appear in the footer or About page before launch.

## Routing & API

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

## Calculator CSS on item pages

`calculator.css` was previously imported only in `app/calculator/page.tsx`, so the embedded `<Calculator>` on `/what-is-it-worth/[slug]/` rendered unstyled (raw inputs/buttons). Fix: `import "./calculator.css"` is now at the top of `Calculator.tsx` itself, so the stylesheet travels with the component wherever it's mounted. The import in `app/calculator/page.tsx` is now redundant but harmless. `FindYardsBox` uses inline styles + the existing `.wiit-yard-*` classes so it doesn't need a separate CSS import.
