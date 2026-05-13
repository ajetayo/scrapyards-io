// Self-contained dump → JSONL stage. Reads migration/input/wp-dump.sql
// directly via migration/scripts/parse-dump.mjs and writes one .jsonl per
// source table to a cache dir owned by the ETL package. Idempotent: if every
// expected output already exists and is newer than the dump, this is a no-op.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const TABLE_PREFIX = "80TdVe_";
// (source-table-suffix, output-basename)
const TABLES: Array<[string, string]> = [
  ["posts", "posts"],
  ["geodir_gd_place_detail", "pd"],
  ["geodir_post_locations", "locations"],
  ["term_relationships", "term_relationships"],
  ["term_taxonomy", "term_taxonomy"],
  ["terms", "terms"],
];

export function prepareJsonl(dumpFile: string, outDir: string, parserScript: string): void {
  if (!fs.existsSync(dumpFile)) {
    throw new Error(`[prepare-jsonl] dump not found: ${dumpFile}`);
  }
  if (!fs.existsSync(parserScript)) {
    throw new Error(`[prepare-jsonl] parser not found: ${parserScript}`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const dumpMtime = fs.statSync(dumpFile).mtimeMs;

  for (const [suffix, base] of TABLES) {
    const outFile = path.join(outDir, `${base}.jsonl`);
    if (fs.existsSync(outFile) && fs.statSync(outFile).mtimeMs >= dumpMtime && fs.statSync(outFile).size > 0) {
      console.log(`[prepare-jsonl] skip ${base}.jsonl (up to date)`);
      continue;
    }
    console.log(`[prepare-jsonl] dumping ${TABLE_PREFIX}${suffix} → ${outFile}`);
    const tmp = outFile + ".tmp";
    const fh = fs.openSync(tmp, "w");
    try {
      execFileSync(process.execPath, [parserScript, dumpFile, "rows", `${TABLE_PREFIX}${suffix}`], {
        stdio: ["ignore", fh, "inherit"],
        maxBuffer: 1024 * 1024 * 1024,
      });
    } finally {
      fs.closeSync(fh);
    }
    fs.renameSync(tmp, outFile);
  }
}
