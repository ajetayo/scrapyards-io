// Phase-1 gate: refuse to run ETL/import while §Z DECISIONS in
// 02-mapping-spec.md are unresolved.
//
// "Resolved" means either:
//   (a) the §Z table is followed by a "**Confirmed:** YYYY-MM-DD ..." line, OR
//   (b) the operator sets MIGRATION_DECISIONS_CONFIRMED=1 in the env.
import fs from "node:fs";
import path from "node:path";

export function assertDecisionsConfirmed(repoRoot: string): void {
  if (process.env.MIGRATION_DECISIONS_CONFIRMED === "1") {
    console.log("[preflight] MIGRATION_DECISIONS_CONFIRMED=1 — bypassing §Z gate");
    return;
  }
  const file = path.join(repoRoot, "migration/output/02-mapping-spec.md");
  if (!fs.existsSync(file)) {
    throw new Error(`[preflight] cannot find ${file} — run Phase 1/2 first`);
  }
  const txt = fs.readFileSync(file, "utf8");
  const idx = txt.indexOf("§Z");
  if (idx < 0) throw new Error(`[preflight] §Z section missing in 02-mapping-spec.md`);
  const tail = txt.slice(idx);
  if (!/\*\*Confirmed:\*\*\s*\d{4}-\d{2}-\d{2}/.test(tail)) {
    throw new Error(
      `[preflight] §Z DECISIONS not confirmed.\n` +
        `  Add a "**Confirmed:** YYYY-MM-DD <signoff>" line at the end of §Z in\n` +
        `  migration/output/02-mapping-spec.md, OR set MIGRATION_DECISIONS_CONFIRMED=1\n` +
        `  to bypass (testing only).`
    );
  }
  console.log("[preflight] §Z DECISIONS confirmed — proceeding");
}
