# Maps

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

## Pre-deploy: lock the Mapbox token

Lock the token in the Mapbox account → Access tokens settings to URL allowlist `scrapyards.io/*` + `*.replit.dev/*` before VPS cutover. Token works without it but is unrestricted until then.

**TODO (manual, pre-DNS-cutover — requires Tunde's Mapbox account access):** in [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens/), edit the production token and set the URL allowlist to:

- `https://scrapyards.io/*`
- `https://*.scrapyards.io/*`
- `https://*.replit.dev/*` (ongoing dev)
- `http://localhost:3000/*` (local dev)

## Verification

Lighthouse cannot run in the Replit env (no Chromium). Run via PageSpeed Insights (`pagespeed.web.dev`) on the deployed URL post-publish; expect Performance ≥ 80, SEO ≥ 95, LCP = H1 (not map).
