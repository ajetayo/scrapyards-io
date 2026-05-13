# WordPress → Postgres Migration

This folder contains the scaffolding to migrate the legacy `scrapyards.io` WordPress dump (`wp-dump.sql`) to the Postgres schema in `lib/db/src/schema/`.

## Layout

```
migration/
├── README.md                       # this file
├── input/
│   ├── wp-dump.sql                 # 57 MB MySQL dump (table prefix 80TdVe_)
│   └── gsc-pages.csv               # 999 URLs from Google Search Console
├── output/
│   ├── 01-inspection-report.md     # Phase 1 deliverable
│   ├── 02-mapping-spec.md          # Phase 2 deliverable
│   └── inspection-final.json       # raw machine-readable inspection
└── scripts/
    ├── parse-dump.mjs              # streaming MySQL dump parser
    └── analyze.mjs                 # produces inspection-final.json
```

## Phases

| Phase | Status | Output |
|---|---|---|
| 1 — Inspect the dump | ✅ done | `output/01-inspection-report.md` + `output/inspection-final.json` |
| 2 — Map source → target | ✅ done | `output/02-mapping-spec.md` |
| 3 — Generate load SQL/scripts | ⏸ paused for human review | n/a |
| 4 — Run the load against Postgres | ⏸ blocked on Phase 3 | n/a |

**Phase 3 is paused until DECISIONS D1–D7 in `02-mapping-spec.md §Z` are confirmed.**

## How the dump was loaded

The Replit sandbox's seccomp policy blocks `mariadb-install-db` (it fails on an `openat` syscall during initdb), so a real MariaDB server cannot be brought up. Instead we built a **streaming SQL dump parser** (`migration/scripts/parse-dump.mjs`) that reads the dump byte-by-byte without buffering the whole 57 MB file:

- It recognizes `CREATE TABLE` statements and per-row `INSERT INTO ... VALUES (...), (...);` chunks.
- For each row it emits a single JSON line on stdout, mapping column name → string value.
- It correctly handles MySQL's quoted-string escapes (`\\`, `\'`, `\"`, `\n`, `\r`, `\t`, `\0`, `\Z`, hex-encoded blobs).

This means the dump is queryable as JSONL without ever loading into a real database. All inspection numbers in `01-inspection-report.md` are derived from this path.

## Re-run inspection from scratch

If you change the dump or want to refresh `inspection-final.json`:

```bash
# 1. Dump the tables we care about to JSONL (one file per table).
#    analyze.mjs reads from /tmp/<basename>.jsonl, where <basename> is the
#    table name with the 80TdVe_ prefix stripped — except for
#    geodir_gd_place_detail, which it expects at /tmp/pd.jsonl (legacy
#    short name).
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql rows 80TdVe_posts                       > /tmp/posts.jsonl
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql rows 80TdVe_geodir_gd_place_detail      > /tmp/pd.jsonl
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql rows 80TdVe_geodir_post_locations       > /tmp/geodir_post_locations.jsonl
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql rows 80TdVe_term_relationships          > /tmp/term_relationships.jsonl
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql rows 80TdVe_term_taxonomy               > /tmp/term_taxonomy.jsonl
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql rows 80TdVe_terms                       > /tmp/terms.jsonl
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql rows 80TdVe_postmeta                    > /tmp/postmeta.jsonl
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql rows 80TdVe_geodir_attachments          > /tmp/geodir_attachments.jsonl
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql rows 80TdVe_geodir_business_hours       > /tmp/geodir_business_hours.jsonl
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql rows 80TdVe_redirection_items           > /tmp/redirection_items.jsonl

# 2. Run the analyzer.
node migration/scripts/analyze.mjs
# → writes migration/output/inspection-final.json
```

## Useful one-off commands

```bash
# List every table in the dump and its row count.
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql tables

# Dump the CREATE TABLE for a single table.
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql schema 80TdVe_geodir_gd_place_detail

# Stream rows for a single table (one JSON object per row, on stdout).
node migration/scripts/parse-dump.mjs migration/input/wp-dump.sql rows 80TdVe_posts | head -3
```

## Loading into a real MySQL (optional, off-Replit)

If you want to verify our findings against a real database (e.g. on a workstation):

```bash
mysql -u root -p -e "CREATE DATABASE scrapyards_wp_6fz24 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci;"
mysql -u root -p scrapyards_wp_6fz24 < migration/input/wp-dump.sql
```

Then sanity-check the headline numbers:

```sql
SELECT COUNT(*) FROM `80TdVe_posts` WHERE post_type='gd_place' AND post_status='publish';
-- expected: 8296

SELECT COUNT(*) FROM `80TdVe_geodir_gd_place_detail` WHERE post_status='publish' AND post_dummy=0;
-- expected: 8296

SELECT region, COUNT(*) FROM `80TdVe_geodir_gd_place_detail`
WHERE post_status='publish' AND post_dummy=0 GROUP BY region ORDER BY 2 DESC LIMIT 5;
-- expected top 5: Texas 651, California 552, Pennsylvania 494, Florida 487, Ohio 470
```

## After Phase 3 (planned)

Phase 3 will produce:

- `output/03-load.sql` — idempotent SQL inserts for `states`, `cities`, `yards`, `metal_prices`, `legacy_redirects`.
- `output/03-validation-report.md` — counts of inserts/skips/errors with reasons.
- `scripts/load.mjs` — Node loader that runs the SQL against `DATABASE_URL`.

Run order will be: `seed-scrapyards` → `load.mjs`.
