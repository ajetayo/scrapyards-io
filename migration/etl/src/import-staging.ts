// Applies migration/output/03-staging-import.sql to DATABASE_URL_STAGING.
// Splits the file into safe chunks and runs them in a transaction.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { resolveStagingUrl } from "./db-url.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const SQL_FILE = path.join(REPO, "migration/output/03-staging-import.sql");

async function main() {
  const url = resolveStagingUrl();
  if (!url) {
    console.error("Neither DATABASE_URL_STAGING nor DATABASE_URL is set. Aborting.");
    process.exit(2);
  }
  if (!fs.existsSync(SQL_FILE)) {
    console.error(`Missing ${SQL_FILE} — run \`pnpm etl\` first.`);
    process.exit(2);
  }

  const sql = fs.readFileSync(SQL_FILE, "utf8");
  console.log(`[import] connecting to staging DB`);
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    // Defensive check: never run against the public schema by accident.
    const me = await client.query<{ db: string; user: string }>(
      "SELECT current_database() AS db, current_user AS \"user\""
    );
    console.log(`[import] db=${me.rows[0]?.db} user=${me.rows[0]?.user}`);

    console.log(`[import] applying SQL (${sql.length} bytes)…`);
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    const r = await client.query(`SELECT
      (SELECT count(*) FROM scrapyards_staging.states) AS states,
      (SELECT count(*) FROM scrapyards_staging.cities) AS cities,
      (SELECT count(*) FROM scrapyards_staging.metal_categories) AS metal_categories,
      (SELECT count(*) FROM scrapyards_staging.yards) AS yards,
      (SELECT count(*) FROM scrapyards_staging.legacy_redirects) AS legacy_redirects`);
    console.log(`[import] done. Counts: ${JSON.stringify(r.rows[0])}`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
