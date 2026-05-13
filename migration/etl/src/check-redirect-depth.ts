// Reads all GSC URLs and classifies their redirect-target depth by simulating
// the runtime redirect chain:
//   1. next.config.ts static patterns (P1-P7)
//   2. middleware DB lookup against scrapyards_staging.legacy_redirects
//   3. yards.legacy_url canonical lookup
//   4. self (URL is already a canonical app path)
// then verifies the destination actually resolves to a real row in
// yards/cities/states/metals/metal_categories. If the most-specific destination
// doesn't exist, walks up (yard -> city -> state -> root) and reports the
// deepest level that DOES resolve.
//
// Outputs migration/output/06-redirect-depth-histogram.md with two histograms
// (by URL count, by click weight) plus diagnostic samples.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { resolveStagingUrl } from "./db-url.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const GSC = path.join(REPO, "migration/input/gsc-pages.csv");
const OUT = path.join(REPO, "migration/output/06-redirect-depth-histogram.md");

type Depth = "yard" | "city" | "state" | "metal-page" | "root" | "self" | "404";
const DEPTH_ORDER: Depth[] = ["yard", "city", "state", "metal-page", "root", "self", "404"];

interface Row {
  source: string;
  clicks: number;
  target: string;
  depth: Depth;
  via: string;
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    let p = u.pathname || "/";
    if (!p.endsWith("/")) p += "/";
    return p;
  } catch {
    return url.endsWith("/") ? url : url + "/";
  }
}

function readGsc(): { source: string; clicks: number }[] {
  const txt = fs.readFileSync(GSC, "utf8");
  const out: { source: string; clicks: number }[] = [];
  for (const ln of txt.split(/\r?\n/)) {
    const t = ln.trim();
    if (!t) continue;
    if (t.toLowerCase().startsWith("top pages")) continue;
    const cells = t.split(",");
    const url = cells[0]!.replace(/^"|"$/g, "");
    const clicks = Number(cells[1] ?? "0") || 0;
    out.push({ source: pathOf(url), clicks });
  }
  return out;
}

// Apply the 9 redirect rules from artifacts/scrapyards/next.config.ts.
// Returns the rewritten path, or null if no static rule matches.
// State slug aliases per spec §B1 — must mirror the middleware exactly.
const STATE_SLUG_ALIASES: Record<string, string> = {
  "delaware-2": "delaware",
  "indiana-1": "indiana",
  "kansas-1": "kansas",
  "michigan-1": "michigan",
  "nevada-2": "nevada",
  "north-dakota-1": "north-dakota",
  "south-dakota-1": "south-dakota",
  "virginia-2": "virginia",
  "washington-7": "washington",
};
function stripSuffix(s: string): string { return s.replace(/-\d+$/, ""); }

// Mirrors the runtime middleware tryNormalize for /scrap-yards/<state>/<city>/<yard>/.
function applySlugNormalization(
  p: string,
  yardsByPath: Set<string>,
  citiesByPath: Set<string>,
  statesByPath: Set<string>,
): string | null {
  const m = p.match(/^\/scrap-yards\/([^/]+)\/?(?:([^/]+)\/?(?:([^/]+)\/?)?)?$/);
  if (!m) return null;
  const stateRaw = m[1]!;
  const cityRaw = m[2];
  const yardRaw = m[3];
  const stateNorm = STATE_SLUG_ALIASES[stateRaw] ?? stateRaw;
  if (!statesByPath.has(`/scrap-yards/${stateNorm}/`)) return null;
  if (!cityRaw) return stateNorm !== stateRaw ? `/scrap-yards/${stateNorm}/` : null;
  const cityNorm = stripSuffix(cityRaw);
  if (!citiesByPath.has(`/scrap-yards/${stateNorm}/${cityNorm}/`)) {
    return stateNorm !== stateRaw ? `/scrap-yards/${stateNorm}/` : null;
  }
  if (!yardRaw) {
    return stateNorm !== stateRaw || cityNorm !== cityRaw
      ? `/scrap-yards/${stateNorm}/${cityNorm}/` : null;
  }
  let yardNorm = yardRaw;
  const litPath = `/scrap-yards/${stateNorm}/${cityNorm}/${yardRaw}/`;
  if (!yardsByPath.has(litPath)) {
    const cleaned = stripSuffix(yardRaw);
    if (cleaned !== yardRaw && yardsByPath.has(`/scrap-yards/${stateNorm}/${cityNorm}/${cleaned}/`)) {
      yardNorm = cleaned;
    }
  }
  if (stateNorm === stateRaw && cityNorm === cityRaw && yardNorm === yardRaw) return null;
  return `/scrap-yards/${stateNorm}/${cityNorm}/${yardNorm}/`;
}

function applyStaticRedirects(p: string): string | null {
  let m: RegExpMatchArray | null;
  // P1: /services/united-states/:state/:city/:cat/:slug/
  if ((m = p.match(/^\/services\/united-states\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/$/))) {
    return `/scrap-yards/${m[1]}/${m[2]}/${m[4]}/`;
  }
  // P2: /services/united-states/:state/:city/
  if ((m = p.match(/^\/services\/united-states\/([^/]+)\/([^/]+)\/$/))) {
    return `/scrap-yards/${m[1]}/${m[2]}/`;
  }
  // P3: /services/united-states/:state/
  if ((m = p.match(/^\/services\/united-states\/([^/]+)\/$/))) {
    return `/scrap-yards/${m[1]}/`;
  }
  // P4: /services/category/:cat/united-states/:state/:city/
  if ((m = p.match(/^\/services\/category\/([^/]+)\/united-states\/([^/]+)\/([^/]+)\/$/))) {
    return `/scrap-yards/${m[2]}/${m[3]}/`;
  }
  // P5: /services/category/:cat/united-states/:state/
  if ((m = p.match(/^\/services\/category\/([^/]+)\/united-states\/([^/]+)\/$/))) {
    return `/scrap-yards/${m[2]}/`;
  }
  // /blog/metal/:metal/
  if ((m = p.match(/^\/blog\/metal\/([^/]+)\/$/))) {
    return `/scrap-metal-prices/${m[1]}/`;
  }
  // /scrap-prices/ family
  if (p === "/scrap-prices/") return "/scrap-metal-prices/";
  if ((m = p.match(/^\/scrap-prices\/([^/]+)\/$/))) return `/scrap-metal-prices/${m[1]}/`;
  if ((m = p.match(/^\/scrap-prices\/([^/]+)\/([^/]+)\/$/))) return `/scrap-metal-prices/${m[1]}/${m[2]}/`;
  return null;
}

// Verify a path resolves and return the deepest valid sub-path.
function verifyAndDegrade(
  target: string,
  yardsByPath: Set<string>,
  citiesByPath: Set<string>,
  statesByPath: Set<string>,
  metalSlugs: Set<string>,
  categorySlugs: Set<string>,
): { resolved: string; depth: Depth } {
  // /scrap-metal-prices/ family
  if (target === "/scrap-metal-prices/") return { resolved: target, depth: "metal-page" };
  let m: RegExpMatchArray | null;
  if ((m = target.match(/^\/scrap-metal-prices\/([^/]+)\/$/))) {
    const slug = m[1]!;
    if (metalSlugs.has(slug) || categorySlugs.has(slug)) return { resolved: target, depth: "metal-page" };
    return { resolved: "/scrap-metal-prices/", depth: "metal-page" };
  }
  if ((m = target.match(/^\/scrap-metal-prices\/([^/]+)\/([^/]+)\/$/))) {
    const slug = m[1]!;
    if (metalSlugs.has(slug) || categorySlugs.has(slug)) return { resolved: target, depth: "metal-page" };
    return { resolved: "/scrap-metal-prices/", depth: "metal-page" };
  }
  // /scrap-yards/ family
  if (target === "/scrap-yards/") return { resolved: target, depth: "root" };
  if ((m = target.match(/^\/scrap-yards\/([^/]+)\/([^/]+)\/([^/]+)\/$/))) {
    const yardPath = target;
    const cityPath = `/scrap-yards/${m[1]}/${m[2]}/`;
    const statePath = `/scrap-yards/${m[1]}/`;
    if (yardsByPath.has(yardPath)) return { resolved: yardPath, depth: "yard" };
    if (citiesByPath.has(cityPath)) return { resolved: cityPath, depth: "city" };
    if (statesByPath.has(statePath)) return { resolved: statePath, depth: "state" };
    return { resolved: "/scrap-yards/", depth: "root" };
  }
  if ((m = target.match(/^\/scrap-yards\/([^/]+)\/([^/]+)\/$/))) {
    const cityPath = target;
    const statePath = `/scrap-yards/${m[1]}/`;
    if (citiesByPath.has(cityPath)) return { resolved: cityPath, depth: "city" };
    if (statesByPath.has(statePath)) return { resolved: statePath, depth: "state" };
    return { resolved: "/scrap-yards/", depth: "root" };
  }
  if ((m = target.match(/^\/scrap-yards\/([^/]+)\/$/))) {
    if (statesByPath.has(target)) return { resolved: target, depth: "state" };
    return { resolved: "/scrap-yards/", depth: "root" };
  }
  if (target === "/") return { resolved: "/", depth: "self" };
  return { resolved: target, depth: "404" };
}

async function main() {
  const url = resolveStagingUrl();
  if (!url) {
    console.error("No staging DB URL.");
    process.exit(2);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const [statesRes, citiesRes, yardsRes, metalsRes, catsRes, redirRes] = await Promise.all([
    client.query<{ slug: string }>(`SELECT slug FROM scrapyards_staging.states`),
    client.query<{ state_slug: string; city_slug: string }>(`
      SELECT s.slug AS state_slug, c.slug AS city_slug
      FROM scrapyards_staging.cities c
      JOIN scrapyards_staging.states s ON s.code = c.state_code
    `),
    client.query<{ state_slug: string; city_slug: string; yard_slug: string; legacy_url: string | null }>(`
      SELECT s.slug AS state_slug, c.slug AS city_slug, y.slug AS yard_slug, y.legacy_url
      FROM scrapyards_staging.yards y
      JOIN scrapyards_staging.cities c ON c.id = y.city_id
      JOIN scrapyards_staging.states s ON s.code = y.state_code
    `),
    client.query<{ slug: string }>(`SELECT slug FROM scrapyards_staging.metals`).catch(() => ({ rows: [] as { slug: string }[] })),
    client.query<{ slug: string }>(`SELECT slug FROM scrapyards_staging.metal_categories`),
    client.query<{ source_path: string; target_path: string }>(`SELECT source_path, target_path FROM scrapyards_staging.legacy_redirects`),
  ]);
  await client.end();

  const statesByPath = new Set(statesRes.rows.map((r) => `/scrap-yards/${r.slug}/`));
  const citiesByPath = new Set(citiesRes.rows.map((r) => `/scrap-yards/${r.state_slug}/${r.city_slug}/`));
  const yardsByPath = new Set(
    yardsRes.rows.map((r) => `/scrap-yards/${r.state_slug}/${r.city_slug}/${r.yard_slug}/`),
  );
  const yardByLegacyPath = new Map<string, string>();
  for (const r of yardsRes.rows) {
    if (!r.legacy_url) continue;
    yardByLegacyPath.set(pathOf(r.legacy_url), `/scrap-yards/${r.state_slug}/${r.city_slug}/${r.yard_slug}/`);
  }
  const metalSlugs = new Set(metalsRes.rows.map((r) => r.slug));
  const categorySlugs = new Set(catsRes.rows.map((r) => r.slug));
  const redirBySource = new Map<string, string>();
  for (const r of redirRes.rows) redirBySource.set(r.source_path, r.target_path);

  console.log(`[depth] loaded states=${statesByPath.size} cities=${citiesByPath.size} yards=${yardsByPath.size} metals=${metalSlugs.size} cats=${categorySlugs.size} legacy_redirects=${redirBySource.size}`);

  const gsc = readGsc();
  const rows: Row[] = [];
  for (const { source, clicks } of gsc) {
    let target: string;
    let via: string;

    // Resolution chain mirrors the Next.js runtime order:
    //   1. middleware DB lookup (legacy_redirects exact match)
    //   2. middleware slug normalization fallback (state alias / city/yard
    //      suffix strip — see app/api/legacy-redirect/route.ts::tryNormalize)
    //   3. next.config.ts static patterns (with a re-entry into normalization
    //      because the runtime would re-hit middleware on the rewritten URL)
    //   4. yards.legacy_url canonical (fallback for legacy WP URLs not in
    //      legacy_redirects)
    //   5. self (no rewrite found)
    if (redirBySource.has(source)) {
      target = redirBySource.get(source)!;
      via = "db.legacy_redirects";
    } else {
      const norm = applySlugNormalization(source, yardsByPath, citiesByPath, statesByPath);
      if (norm) {
        target = norm;
        via = "middleware.normalize";
      } else {
        const staticTarget = applyStaticRedirects(source);
        if (staticTarget) {
          // After next.config rewrite the runtime would re-enter middleware on the
          // new path — apply slug normalization to that destination too.
          const renorm = applySlugNormalization(staticTarget, yardsByPath, citiesByPath, statesByPath);
          target = renorm ?? staticTarget;
          via = renorm ? "next.config+normalize" : "next.config";
        } else if (yardByLegacyPath.has(source)) {
          target = yardByLegacyPath.get(source)!;
          via = "yards.legacy_url";
        } else {
          target = source;
          via = "self";
        }
      }
    }

    const { resolved, depth: rawDepth } = verifyAndDegrade(
      target, yardsByPath, citiesByPath, statesByPath, metalSlugs, categorySlugs,
    );
    const depth: Depth = via === "self" && resolved === source && rawDepth !== "404" ? "self" : rawDepth;
    rows.push({ source, clicks, target: resolved, depth, via });
  }

  const byCount = new Map<Depth, number>();
  const byClicks = new Map<Depth, number>();
  for (const d of DEPTH_ORDER) { byCount.set(d, 0); byClicks.set(d, 0); }
  for (const r of rows) {
    byCount.set(r.depth, (byCount.get(r.depth) ?? 0) + 1);
    byClicks.set(r.depth, (byClicks.get(r.depth) ?? 0) + r.clicks);
  }
  const totalUrls = rows.length;
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const fmtPct = (n: number, total: number) => total === 0 ? "0.00%" : ((n / total) * 100).toFixed(2) + "%";

  let md = `# 06 — Redirect Depth Histogram\n\n`;
  md += `Generated by \`migration/etl/src/check-redirect-depth.ts\` against \`scrapyards_staging\`.\n\n`;
  md += `Resolution chain simulated per-URL (matches runtime):\n`;
  md += `1. \`next.config.ts\` static patterns (P1-P7)\n`;
  md += `2. \`scrapyards_staging.legacy_redirects\` DB lookup (middleware fallback)\n`;
  md += `3. \`yards.legacy_url\` canonical lookup\n`;
  md += `4. self (URL is already a canonical app path)\n\n`;
  md += `Each rewritten target is then verified against the staging DB and degraded\n`;
  md += `to the deepest valid sub-path (yard → city → state → root) if the most-\n`;
  md += `specific destination doesn't exist.\n\n`;
  md += `**Total GSC URLs:** ${totalUrls}\n`;
  md += `**Total clicks:** ${totalClicks}\n\n`;

  md += `## A. By URL count\n\n`;
  md += `| Depth | URLs | % of ${totalUrls} |\n|---|---:|---:|\n`;
  for (const d of DEPTH_ORDER) md += `| ${d} | ${byCount.get(d)} | ${fmtPct(byCount.get(d) ?? 0, totalUrls)} |\n`;

  md += `\n## B. By click weight\n\n`;
  md += `| Depth | Clicks | % of ${totalClicks} |\n|---|---:|---:|\n`;
  for (const d of DEPTH_ORDER) md += `| ${d} | ${byClicks.get(d)} | ${fmtPct(byClicks.get(d) ?? 0, totalClicks)} |\n`;

  md += `\n## C. Diagnostic samples\n\n`;

  const fourOhFour = rows.filter((r) => r.depth === "404").slice(0, 10);
  md += `### C1. Unresolved (depth=404)\n\n`;
  if (!fourOhFour.length) md += `_None — every GSC URL resolved to a live page._\n`;
  else {
    md += `| Source | Clicks | Via |\n|---|---:|---|\n`;
    for (const r of fourOhFour) md += `| \`${r.source}\` | ${r.clicks} | ${r.via} |\n`;
  }

  const rootFb = rows.filter((r) => r.depth === "root").sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  md += `\n### C2. Top 10 root-level fallbacks (\`/scrap-yards/\` or \`/\`)\n\n`;
  if (!rootFb.length) md += `_None._\n`;
  else {
    md += `| Source | Clicks | Target | Via |\n|---|---:|---|---|\n`;
    for (const r of rootFb) md += `| \`${r.source}\` | ${r.clicks} | \`${r.target}\` | ${r.via} |\n`;
  }

  const stateFb = rows.filter((r) => r.depth === "state").sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  md += `\n### C3. Top 10 state-level fallbacks\n\n`;
  if (!stateFb.length) md += `_None._\n`;
  else {
    md += `| Source | Clicks | Target | Via |\n|---|---:|---|---|\n`;
    for (const r of stateFb) md += `| \`${r.source}\` | ${r.clicks} | \`${r.target}\` | ${r.via} |\n`;
  }

  const cityFb = rows.filter((r) => r.depth === "city").sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  md += `\n### C4. Top 10 city-level fallbacks\n\n`;
  if (!cityFb.length) md += `_None._\n`;
  else {
    md += `| Source | Clicks | Target | Via |\n|---|---:|---|---|\n`;
    for (const r of cityFb) md += `| \`${r.source}\` | ${r.clicks} | \`${r.target}\` | ${r.via} |\n`;
  }

  fs.writeFileSync(OUT, md, "utf8");
  console.log(`[depth] wrote ${OUT}`);
  console.log(`[depth] urls=${totalUrls} clicks=${totalClicks}`);
  for (const d of DEPTH_ORDER) {
    console.log(`  ${d.padEnd(11)} urls=${byCount.get(d)} clicks=${byClicks.get(d)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
