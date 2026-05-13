# Migration History

## WordPress → Postgres migration

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

## Yard description generation — decision log (archival)

Yard descriptions: explored LLM free-form generation in three iterations
(v1 with 100 yards, v2 with 50 narrowed-validation, v3 with 50 + retro-
validation of v1). v3 retro showed 69% reject rate against the v3
stop-list, hitting both spec stop conditions. Free-form was abandoned.
Final architecture is slot-filling templates
(`scripts/src/yard-desc-templates.ts`) — deterministic, $0 API cost,
100% validator pass on pilots, 99.25% bulk success.

See `docs/content-templating.md` for the current templated pipeline details.
