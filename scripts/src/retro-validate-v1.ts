/**
 * Retro-validate the 100 v1 pilot descriptions against the CURRENT validator
 * rules (shared with the live generator via `./yard-desc-validator.ts`).
 *
 * Reads from migration/output/yard-desc-pilot-log.jsonl. Writes one report:
 *   migration/output/v1-retro-validation.md
 *
 * The same script is used after every validator update — re-running it
 * produces an updated report under the same filename.
 *
 * Run: pnpm --filter @workspace/scripts run retro-validate-v1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDescription, type ValidatorFacts } from "./yard-desc-validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const V1_LOG = path.join(REPO_ROOT, "migration", "output", "yard-desc-pilot-log.jsonl");
const REPORT = path.join(REPO_ROOT, "migration", "output", "v1-retro-validation.md");
const ZIP_COUNTIES_FILE = path.join(REPO_ROOT, "migration", "data", "zip-counties.json");

const ZIP_COUNTIES: Record<string, string> = fs.existsSync(ZIP_COUNTIES_FILE)
  ? (JSON.parse(fs.readFileSync(ZIP_COUNTIES_FILE, "utf8")) as Record<string, string>)
  : {};

type LoggedFacts = ValidatorFacts & {
  zip: string | null;
  county?: string | null;
  county_known?: boolean;
};

function deriveCounty(facts: LoggedFacts): { county: string | null; known: boolean } {
  if (facts.county_known && facts.county) return { county: facts.county, known: true };
  if (facts.zip && ZIP_COUNTIES[facts.zip]) return { county: ZIP_COUNTIES[facts.zip]!, known: true };
  return { county: null, known: false };
}

function main() {
  const lines = fs.readFileSync(V1_LOG, "utf8").split("\n").filter(Boolean);
  // Deduplicate by yard_id (keep latest entry).
  const seen = new Map<
    number,
    { facts: LoggedFacts; description: string; cohort: string; word_count: number }
  >();
  for (const line of lines) {
    const e = JSON.parse(line) as {
      yard_id: number;
      facts: LoggedFacts;
      description: string;
      cohort: string;
      word_count: number;
    };
    if (!e.description) continue;
    seen.set(e.yard_id, e);
  }
  const entries = [...seen.values()];
  console.log(`Validating ${entries.length} v1 descriptions against current rules...`);

  const results = entries.map((e) => {
    // v1 logs may not include county fields — derive from ZIP for the check.
    const { county, known } = deriveCounty(e.facts);
    const factsForValidator: ValidatorFacts = {
      yard_id: e.facts.yard_id,
      name: e.facts.name,
      city: e.facts.city,
      state: e.facts.state,
      zip: e.facts.zip,
      county: e.facts.county ?? county,
      county_known: e.facts.county_known ?? known,
    };
    const v = validateDescription(e.description, factsForValidator);
    return { ...e, ok: v.ok, reasons: v.reasons, hits: v.reasons.length };
  });

  const passed = results.filter((r) => r.ok);
  const rejected = results.filter((r) => !r.ok);

  // Aggregate hits by category.
  const byCat = new Map<string, number>();
  for (const r of rejected) {
    const cats = new Set(r.reasons.map((x) => x.split(":")[0]!));
    for (const c of cats) byCat.set(c, (byCat.get(c) ?? 0) + 1);
  }

  const worst5 = [...rejected].sort((a, b) => b.hits - a.hits).slice(0, 5);

  const out: string[] = [];
  out.push(`# v1 Pilot — Retro-Validation Against Current Rules\n`);
  out.push(`**Validator version:** see \`scripts/src/yard-desc-validator.ts\` (shared)  `);
  out.push(`**Total v1 descriptions checked:** ${entries.length}  `);
  out.push(`**Passed:** ${passed.length} (${((100 * passed.length) / entries.length).toFixed(1)}%)  `);
  out.push(`**Rejected:** ${rejected.length} (${((100 * rejected.length) / entries.length).toFixed(1)}%)  \n`);

  out.push(`## Rejection categories (one yard can hit multiple)\n`);
  out.push(`| Category | Yards |`);
  out.push(`|---|---|`);
  for (const [c, n] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
    out.push(`| ${c} | ${n} |`);
  }
  out.push("");

  for (const cat of [
    "comparative",
    "region",
    "time_period",
    "since",
    "established",
    "quantifier",
    "unsourced_digits",
    "name_repeated",
    "unsourced_county",
    "wrong_county",
    "banned_phrase",
  ]) {
    const termCounts = new Map<string, number>();
    for (const r of rejected) {
      for (const reason of r.reasons) {
        if (!reason.startsWith(cat + ":")) continue;
        const term = reason.slice(cat.length + 1);
        termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
      }
    }
    if (termCounts.size === 0) continue;
    out.push(`### Top ${cat} terms`);
    out.push(`| Term | Hits |`);
    out.push(`|---|---|`);
    for (const [t, n] of [...termCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      out.push(`| \`${t}\` | ${n} |`);
    }
    out.push("");
  }

  out.push(`## Worst 5 (most stop-list hits)\n`);
  for (const r of worst5) {
    out.push(
      `### ${r.facts.name} — ${r.facts.city}, ${r.facts.state}  (yard ${r.facts.yard_id}, cohort \`${r.cohort}\`, **${r.hits} hits**)\n`,
    );
    out.push(`**Reasons:** ${r.reasons.join(" · ")}\n`);
    out.push(`**Description:**\n`);
    out.push("> " + r.description.replace(/\n\n/g, "\n> \n> "));
    out.push("");
  }

  fs.writeFileSync(REPORT, out.join("\n"));
  console.log(`Report → ${REPORT}`);
  console.log(`PASSED: ${passed.length}/${entries.length}, REJECTED: ${rejected.length}/${entries.length}`);
  console.log(
    `Top categories: ${[...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => `${c}=${n}`).join(", ")}`,
  );
}

main();
