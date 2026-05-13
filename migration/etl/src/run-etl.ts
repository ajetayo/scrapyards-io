// Entry point: read JSONL → transform → emit 03-staging-import.sql + skipped.csv.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { loadSource } from "./load-source.js";
import { transformAll } from "./transform.js";
import { writeStagingSql, writeSkippedCsv } from "./sql-writer.js";
import { assertDecisionsConfirmed } from "./preflight.js";
import { prepareJsonl } from "./prepare-jsonl.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const DEFAULT_JSONL_DIR = path.join(REPO, "migration/cache/wp");
const JSONL_DIR = process.env.WP_JSONL_DIR ?? DEFAULT_JSONL_DIR;
const DUMP = path.join(REPO, "migration/input/wp-dump.sql");
const PARSER = path.join(REPO, "migration/scripts/parse-dump.mjs");
const OUT_DIR = path.join(REPO, "migration/output");
const META_OUT = path.join(OUT_DIR, "_etl-meta.json");

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  assertDecisionsConfirmed(REPO);

  // Self-contained: derive JSONL directly from migration/input/wp-dump.sql
  // unless the operator overrides WP_JSONL_DIR. Idempotent — re-uses cache.
  if (!process.env.WP_JSONL_DIR) {
    prepareJsonl(DUMP, JSONL_DIR, PARSER);
  } else {
    console.log(`[etl] using user-supplied WP_JSONL_DIR=${JSONL_DIR}`);
  }

  console.log(`[etl] reading JSONL from ${JSONL_DIR}`);
  const src = loadSource(JSONL_DIR);
  console.log(`[etl] posts(gd_place,publish)=${src.posts.length}, pd=${src.pdByPostId.size}, locations=${src.locByPostId.size}, gd_placecategory_terms=${src.catTermBySlug.size}`);

  const result = transformAll(src);
  console.log(`[etl] cities=${result.cities.length}, yards=${result.yards.length}, skipped=${result.skipped.length}`);
  console.log(`[etl] counts: ${JSON.stringify(result.counts)}`);

  const sqlOut = path.join(OUT_DIR, "03-staging-import.sql");
  const skippedOut = path.join(OUT_DIR, "skipped.csv");
  writeStagingSql(sqlOut, result.cities, result.yards);
  writeSkippedCsv(skippedOut, result.skipped);
  console.log(`[etl] wrote ${sqlOut}`);
  console.log(`[etl] wrote ${skippedOut}`);

  fs.writeFileSync(
    META_OUT,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        counts: result.counts,
        city_count: result.cities.length,
        yard_count: result.yards.length,
        skipped_count: result.skipped.length,
      },
      null,
      2
    )
  );
}

main();
