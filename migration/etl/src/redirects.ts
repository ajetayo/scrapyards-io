// Builds migration/output/05-legacy-redirects.csv (1 row per GSC URL).
// The full redirect set (synthetic + canonical + losers + GSC) is now embedded
// in 03-staging-import.sql, so this script no longer touches the DB.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSource } from "./load-source.js";
import { transformAll } from "./transform.js";
import { buildRedirects, readGscPaths } from "./build-redirects.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const GSC = path.join(REPO, "migration/input/gsc-pages.csv");
const OUT = path.join(REPO, "migration/output/05-legacy-redirects.csv");
const JSONL_DIR = process.env.WP_JSONL_DIR ?? path.join(REPO, "migration/cache/wp");

function main() {
  const src = loadSource(JSONL_DIR);
  const t = transformAll(src);
  const gscPaths = readGscPaths(GSC);
  const { all, gscOnly } = buildRedirects({ cities: t.cities, yards: t.yards, gscPaths });

  if (gscOnly.length !== new Set(gscPaths).size) {
    throw new Error(`[redirects] FATAL: csv rows (${gscOnly.length}) != GSC URLs (${new Set(gscPaths).size})`);
  }

  const lines = ["source_path,target_path,status_code"];
  for (const r of gscOnly.sort((a, b) => a.source.localeCompare(b.source))) {
    lines.push(`"${r.source}","${r.target}",${r.status}`);
  }
  fs.writeFileSync(OUT, lines.join("\n") + "\n");
  console.log(
    `[redirects] wrote ${OUT} (${gscOnly.length} rows = 1 per GSC URL; ` +
    `${all.length - gscOnly.length} additional comprehensive redirects already loaded into DB by 03-staging-import.sql)`
  );
}

main();
