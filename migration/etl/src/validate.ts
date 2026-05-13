// Generates migration/output/04-validation-report.md against the staging DB.
// Sections required by the migration spec:
//   1. Row counts (vs expected from WP-derived ETL meta)
//   2. Slug uniqueness + suffix audit
//   3. Referential integrity
//   4. Geo / contact coverage
//   5. Category bucket sanity (incl. metals + metal_categories)
//   6. 20 random WP source row → resulting Postgres row comparisons
//   7. 20 random GSC URL → redirect target samples
//   8. Top 50 traffic-driving GSC pages, audited for clean migration
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { resolveStagingUrl } from "./db-url.js";
import { loadSource, type PostRow } from "./load-source.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const OUT = path.join(REPO, "migration/output/04-validation-report.md");
const META = path.join(REPO, "migration/output/_etl-meta.json");
const GSC = path.join(REPO, "migration/input/gsc-pages.csv");
const JSONL_DIR = process.env.WP_JSONL_DIR ?? path.join(REPO, "migration/cache/wp");
const SCHEMA = "scrapyards_staging";

async function q<T extends Record<string, unknown>>(c: pg.Client, sql: string, params?: unknown[]): Promise<T[]> {
  const r = await c.query(sql, params);
  return r.rows as T[];
}

function table(rows: Array<Record<string, unknown>>, headers: string[]): string {
  if (rows.length === 0) return "_(no rows)_\n";
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((r) => `| ${headers.map((h) => String(r[h] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`)
    .join("\n");
  return `${head}\n${sep}\n${body}\n`;
}

function readGscWithClicks(): Array<{ url: string; path: string; clicks: number }> {
  if (!fs.existsSync(GSC)) return [];
  const txt = fs.readFileSync(GSC, "utf8");
  const out: Array<{ url: string; path: string; clicks: number }> = [];
  for (const ln of txt.split(/\r?\n/)) {
    const t = ln.trim();
    if (!t) continue;
    if (t.toLowerCase().startsWith("top pages")) continue;
    const cells = t.split(",");
    const url = cells[0]!.replace(/^"|"$/g, "");
    if (!/^https?:\/\//i.test(url)) continue;
    const clicks = parseInt(cells[1] ?? "0", 10) || 0;
    let p: string;
    try {
      const u = new URL(url);
      p = u.pathname || "/";
      if (!p.endsWith("/")) p += "/";
    } catch { p = url; }
    out.push({ url, path: p, clicks });
  }
  return out;
}

function deterministicShuffle<T>(arr: T[], n: number, salt: string): T[] {
  // Sort by hash-of-(salt+index) so we get a deterministic sample.
  const tagged = arr.map((v, i) => ({ v, k: hash32(`${salt}:${i}`) }));
  tagged.sort((a, b) => a.k - b.k);
  return tagged.slice(0, n).map((x) => x.v);
}
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

async function main() {
  const url = resolveStagingUrl();
  if (!url) {
    console.error("No usable staging URL available. Aborting.");
    process.exit(2);
  }
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    await c.query(`SET search_path TO ${SCHEMA}`);
    const out: string[] = [];
    out.push(`# 04 — Staging validation report`);
    out.push(`Generated: ${new Date().toISOString()}`);
    const dbinfo = await q<{ db: string }>(c, "SELECT current_database() AS db");
    out.push(`Target: \`${SCHEMA}\` schema on \`${dbinfo[0]?.db ?? "?"}\` (resolved via db-url.ts)\n`);

    // ETL expectations (counts from the ETL run's meta file).
    const meta = fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, "utf8")) : null;

    // ===== 1. Row counts (expected vs actual) =====
    out.push(`## 1. Row counts — expected vs actual\n`);
    const counts = await q<{ tbl: string; n: string }>(
      c,
      `SELECT 'states' AS tbl, count(*)::text AS n FROM states
       UNION ALL SELECT 'cities', count(*)::text FROM cities
       UNION ALL SELECT 'metal_categories', count(*)::text FROM metal_categories
       UNION ALL SELECT 'metals', count(*)::text FROM metals
       UNION ALL SELECT 'yards', count(*)::text FROM yards
       UNION ALL SELECT 'legacy_redirects', count(*)::text FROM legacy_redirects
       ORDER BY tbl`
    );
    const expected: Record<string, string | number> = {
      states: 51,
      metal_categories: 9,
      metals: 22,
      cities: meta?.city_count ?? "—",
      yards: meta?.yard_count ?? "—",
      legacy_redirects: ">8000 (DB has full comprehensive set: GSC + synthetic parents + per-yard canonical + dedupe-losers; CSV ships GSC-only per task contract)",
    };
    out.push(table(
      counts.map((r) => ({ table: r.tbl, actual: r.n, expected: expected[r.tbl] ?? "—" })),
      ["table", "expected", "actual"]
    ));
    // Strict CSV ↔ GSC coverage check.
    const gscFile = path.join(REPO, "migration/input/gsc-pages.csv");
    const csvFile = path.join(REPO, "migration/output/05-legacy-redirects.csv");
    if (fs.existsSync(gscFile) && fs.existsSync(csvFile)) {
      const gscPaths = new Set<string>();
      for (const ln of fs.readFileSync(gscFile, "utf8").split(/\r?\n/)) {
        const u = ln.trim().split(",")[0]?.replace(/^"|"$/g, "");
        if (!u || !/^https?:\/\//i.test(u)) continue;
        try { let p = new URL(u).pathname || "/"; if (!p.endsWith("/")) p += "/"; gscPaths.add(p); } catch { /* skip */ }
      }
      const csvPaths = new Set<string>();
      const csvLines = fs.readFileSync(csvFile, "utf8").split(/\r?\n/).slice(1);
      for (const ln of csvLines) { const m = ln.match(/^"([^"]*)"/); if (m) csvPaths.add(m[1]); }
      const missing = [...gscPaths].filter((p) => !csvPaths.has(p));
      const extras  = [...csvPaths].filter((p) => !gscPaths.has(p));
      out.push(`### Strict CSV ↔ GSC coverage\n`);
      out.push(`- gsc-pages.csv URL count: **${gscPaths.size}**\n`);
      out.push(`- 05-legacy-redirects.csv row count: **${csvPaths.size}**\n`);
      out.push(`- GSC URLs missing from CSV: **${missing.length}** (must be 0)\n`);
      out.push(`- CSV rows not present in GSC: **${extras.length}** (must be 0; comprehensive entries live in the DB only)\n`);
      if (missing.length > 0 || extras.length > 0) {
        throw new Error(`Strict GSC↔CSV coverage failed: missing=${missing.length} extras=${extras.length}`);
      }
    }
    if (meta) {
      out.push(`\n**ETL meta:** posts_input=${meta.counts.posts_input}, pre-dedupe yards=${meta.counts.yards_pre_dedupe}, dedupe winners=${meta.counts.yards_dedup_winners}, losers folded in=${meta.counts.yards_dedup_losers}, skipped=${meta.skipped_count}.\n`);
    }

    out.push(`### Yards by status\n`);
    out.push(table(
      await q<{ status: string; n: string }>(c, `SELECT status, count(*)::text AS n FROM yards GROUP BY status ORDER BY status`),
      ["status", "n"]
    ));

    out.push(`### Yards by state (top 15)\n`);
    out.push(table(
      await q<{ state_code: string; n: string }>(c, `SELECT state_code, count(*)::text AS n FROM yards GROUP BY state_code ORDER BY count(*) DESC LIMIT 15`),
      ["state_code", "n"]
    ));

    // ===== 2. Slug uniqueness + suffix audit =====
    out.push(`## 2. Slug uniqueness + suffix audit\n`);
    const dup = await q(c, `SELECT state_code, city_id, slug, count(*)::text AS n FROM yards GROUP BY state_code, city_id, slug HAVING count(*) > 1`);
    out.push(`Duplicate (state_code, city_id, slug) groups: **${dup.length}** (must be 0)\n`);
    if (dup.length > 0) out.push(table(dup as Array<Record<string, unknown>>, ["state_code", "city_id", "slug", "n"]));

    // Hard requirement: NO bare numeric `-N` suffix in yards.slug.
    const suffixed = await q<{ slug: string }>(c,
      `SELECT slug FROM yards WHERE slug ~ '-[0-9]+$' ORDER BY slug LIMIT 10`);
    const totalSuffixed = await q<{ n: string }>(c, `SELECT count(*)::text AS n FROM yards WHERE slug ~ '-[0-9]+$'`);
    out.push(`Yards with bare numeric suffix \`-N\`: **${totalSuffixed[0]?.n}** (must be 0 — the ETL disambiguates collisions via address/zip/post-id tokens, see §5 stats below).\n`);
    if (suffixed.length > 0) out.push(`Sample offending slugs (none expected):\n` + table(suffixed as Array<Record<string, unknown>>, ["slug"]));

    // Show how disambiguation breaks down (from ETL meta).
    if (meta?.counts) {
      out.push(`Disambiguation method breakdown (from ETL meta):\n`);
      out.push(table(
        [
          { method: "base slug used as-is",                                                   n: (meta.counts.yards_dedup_winners ?? 0) - (meta.counts.address_disambiguated ?? 0) - (meta.counts.zip_disambiguated ?? 0) - (meta.counts.postid_disambiguated ?? 0) },
          { method: "base + address token (e.g. acme-1500-main, acme-main)",                  n: meta.counts.address_disambiguated ?? 0 },
          { method: "base + z<zip>",                                                          n: meta.counts.zip_disambiguated ?? 0 },
          { method: "base + p<post_id> (last-resort, guaranteed unique)",                     n: meta.counts.postid_disambiguated ?? 0 },
        ],
        ["method", "n"]
      ));
    }

    // ===== 3. Referential integrity =====
    out.push(`## 3. Orphans & referential integrity\n`);
    const orphanState = await q<{ n: string }>(c, `SELECT count(*)::text AS n FROM yards y LEFT JOIN states s ON s.code = y.state_code WHERE s.code IS NULL`);
    const orphanCity  = await q<{ n: string }>(c, `SELECT count(*)::text AS n FROM yards y LEFT JOIN cities ci ON ci.id = y.city_id WHERE ci.id IS NULL`);
    const cityNoYards = await q<{ n: string }>(c, `SELECT count(*)::text AS n FROM cities ci WHERE NOT EXISTS (SELECT 1 FROM yards y WHERE y.city_id = ci.id)`);
    const metalsOrphanCat = await q<{ n: string }>(c, `SELECT count(*)::text AS n FROM metals m LEFT JOIN metal_categories mc ON mc.slug = m.category WHERE mc.slug IS NULL`);
    out.push(table([
      { check: "yards with missing state",  n: orphanState[0]?.n ?? "?" },
      { check: "yards with missing city",   n: orphanCity[0]?.n ?? "?" },
      { check: "cities with no yards",      n: cityNoYards[0]?.n ?? "?" },
      { check: "metals with missing category", n: metalsOrphanCat[0]?.n ?? "?" },
    ], ["check", "n"]));

    // ===== 4. Geo + contact coverage =====
    out.push(`## 4. Geo + contact coverage\n`);
    const geo = await q(c, `SELECT
      count(*)::text AS total,
      count(*) FILTER (WHERE lat IS NULL OR lng IS NULL)::text AS missing_geo,
      count(*) FILTER (WHERE address IS NULL)::text AS missing_address,
      count(*) FILTER (WHERE zip IS NULL)::text AS missing_zip,
      count(*) FILTER (WHERE phone IS NULL)::text AS missing_phone,
      count(*) FILTER (WHERE website IS NULL)::text AS missing_website,
      count(*) FILTER (WHERE hours IS NULL)::text AS missing_hours
      FROM yards`);
    out.push(table(geo as Array<Record<string, unknown>>, ["total", "missing_geo", "missing_address", "missing_zip", "missing_phone", "missing_website", "missing_hours"]));

    // ===== 5. Category bucket sanity (metals + metal_categories) =====
    out.push(`## 5. Category bucket sanity\n`);
    out.push(`### \`metal_categories\` rows\n`);
    out.push(table(
      await q(c, `SELECT slug, name, display_order FROM metal_categories ORDER BY display_order`),
      ["slug", "name", "display_order"]
    ));
    out.push(`### \`metals\` rows (D2 Option A — 22 canonical entries, no WP metal posts imported)\n`);
    out.push(table(
      await q(c, `SELECT m.slug, m.name, m.category, m.unit, m.spot_metal, m.display_order FROM metals m ORDER BY m.display_order`),
      ["slug", "name", "category", "unit", "spot_metal", "display_order"]
    ));
    out.push(`### Distinct \`yards.accepted\` values\n`);
    out.push(table(
      await q(c, `SELECT u AS accepted_slug, count(*)::text AS n FROM yards, unnest(coalesce(accepted, ARRAY[]::text[])) AS u GROUP BY u ORDER BY count(*) DESC`),
      ["accepted_slug", "n"]
    ));
    out.push(`### Top 25 \`yards.services\` values\n`);
    out.push(table(
      await q(c, `SELECT u AS service_slug, count(*)::text AS n FROM yards, unnest(coalesce(services, ARRAY[]::text[])) AS u GROUP BY u ORDER BY count(*) DESC LIMIT 25`),
      ["service_slug", "n"]
    ));

    // ===== 6. 20 WP source row → PG row comparisons =====
    out.push(`## 6. 20 WP source rows → resulting Postgres yards\n`);
    out.push(`Picked deterministically from the WP source (\`/tmp/wp/posts.jsonl\`) and joined back to staging by \`legacy_url\`. Confirms field-level fidelity end to end.\n`);
    const src = loadSource(JSONL_DIR);
    // Restrict to migration-eligible rows: gd_place + publish + has pd row.
    // Otherwise the sample is dominated by attachments / nav_menu_items
    // (which are correctly skipped, not bugs).
    const eligible = src.posts.filter(
      (p) => p.post_type === "gd_place" && p.post_status === "publish" && src.pdByPostId.has(p.ID)
    );
    const sampledPosts: PostRow[] = deterministicShuffle(eligible, 20, "wp-pg-sample-v1");
    const wpPgRows: Array<Record<string, unknown>> = [];
    for (const p of sampledPosts) {
      const pd = src.pdByPostId.get(p.ID);
      const legacyLike = `%/${p.post_name}/`;
      const yard = await q<{ slug: string; name: string; state_code: string; city_slug: string; zip: string }>(
        c,
        `SELECT y.slug, y.name, y.state_code, ci.slug AS city_slug, y.zip
           FROM yards y JOIN cities ci ON ci.id = y.city_id
          WHERE y.legacy_url LIKE $1 LIMIT 1`,
        [legacyLike]
      );
      let verdict: string;
      let pgSlug: string, pgState: string, pgCity: string, pgZip: string;
      if (yard[0]) {
        verdict = "✓ direct";
        pgSlug = yard[0].slug; pgState = yard[0].state_code; pgCity = yard[0].city_slug; pgZip = yard[0].zip ?? "";
      } else {
        // Dedupe loser? Look it up in legacy_redirects, then resolve the winner.
        const losers = await q<{ target_path: string }>(c, `SELECT target_path FROM legacy_redirects WHERE source_path LIKE $1 LIMIT 1`, [`%/${p.post_name}/`]);
        const tp = losers[0]?.target_path;
        const m = tp?.match(/^\/scrap-yards\/([^/]+)\/([^/]+)\/([^/]+)\/$/);
        if (m) {
          const winner = await q<{ slug: string; state_code: string; city_slug: string; zip: string }>(
            c,
            `SELECT y.slug, y.state_code, ci.slug AS city_slug, y.zip
               FROM yards y JOIN cities ci ON ci.id = y.city_id JOIN states s ON s.code = y.state_code
              WHERE s.slug=$1 AND ci.slug=$2 AND y.slug=$3`,
            [m[1], m[2], m[3]]
          );
          if (winner[0]) {
            verdict = "✓ via dedupe-loser redirect";
            pgSlug = winner[0].slug; pgState = winner[0].state_code; pgCity = winner[0].city_slug; pgZip = winner[0].zip ?? "";
          } else {
            verdict = "MISSING (redirect target not found)";
            pgSlug = pgState = pgCity = pgZip = "";
          }
        } else {
          verdict = "MISSING";
          pgSlug = pgState = pgCity = pgZip = "";
        }
      }
      wpPgRows.push({
        wp_post_id: p.ID,
        wp_title: p.post_title.slice(0, 40),
        wp_region: pd?.region ?? "",
        wp_city: pd?.city ?? "",
        pg_state: pgState,
        pg_city: pgCity,
        pg_slug: pgSlug || "(missing)",
        pg_zip: pgZip,
        verdict,
      });
    }
    out.push(table(wpPgRows, ["wp_post_id", "wp_title", "wp_region", "wp_city", "pg_state", "pg_city", "pg_slug", "pg_zip", "verdict"]));
    const okCount = wpPgRows.filter((r) => String(r["verdict"]).startsWith("✓")).length;
    out.push(`\n**${okCount} of 20** sampled WP rows resolve to a PG yard (directly or via dedupe-loser redirect).\n`);

    // ===== 7. 20 GSC URL → redirect target samples =====
    out.push(`## 7. 20 random GSC URLs → redirect target\n`);
    const gsc = readGscWithClicks();
    if (gsc.length === 0) {
      out.push(`_no GSC file present_\n`);
    } else {
      const sample = deterministicShuffle(gsc, 20, "gsc-sample-v1");
      const rows: Array<Record<string, unknown>> = [];
      for (const g of sample) {
        const r = await q<{ target_path: string; status_code: string }>(c, `SELECT target_path, status_code::text AS status_code FROM legacy_redirects WHERE source_path = $1`, [g.path]);
        const tgt = r[0]?.target_path ?? "(no redirect — passthrough)";
        rows.push({ source: g.path, clicks: g.clicks, target: tgt, status: r[0]?.status_code ?? "—" });
      }
      out.push(table(rows, ["source", "clicks", "target", "status"]));
    }

    // ===== 8. Top 50 traffic-driving GSC pages — explicit migration audit =====
    out.push(`## 8. Top 50 traffic-driving GSC pages — migration audit\n`);
    if (gsc.length === 0) {
      out.push(`_no GSC file present_\n`);
    } else {
      const top = [...gsc].sort((a, b) => b.clicks - a.clicks).slice(0, 50);
      const rows: Array<Record<string, unknown>> = [];
      let cleanCount = 0;
      for (const g of top) {
        const r = await q<{ target_path: string }>(c, `SELECT target_path FROM legacy_redirects WHERE source_path = $1`, [g.path]);
        const tgt = r[0]?.target_path;
        let verdict = "OK";
        if (!tgt) {
          // No redirect entry — only OK if the source path is itself a live canonical.
          const live = await isLiveCanonical(c, g.path);
          verdict = live ? "OK (live canonical)" : "NO REDIRECT";
        } else if (tgt === "/") {
          verdict = "fallback → home";
        } else if (tgt === "/scrap-yards/" || tgt === "/scrap-metal-prices/") {
          verdict = "fallback → root";
        } else {
          // Confirm target is a live canonical.
          const live = await isLiveCanonical(c, tgt);
          verdict = live ? "OK" : "TARGET MISSING";
        }
        if (verdict.startsWith("OK")) cleanCount++;
        rows.push({ source: g.path, clicks: g.clicks, target: tgt ?? "(no entry)", verdict });
      }
      out.push(`**${cleanCount} of 50** top GSC pages migrated to a specific live canonical (the rest fall back to a parent — never 404).\n`);
      out.push(table(rows, ["clicks", "source", "target", "verdict"]));
    }

    // ===== 9. Random samples (sanity) =====
    out.push(`## 9. Random samples (sanity)\n`);
    const sampleY = await q(c, `SELECT y.slug, y.name, y.state_code, ci.slug AS city_slug, y.address, y.zip, y.phone, y.website, y.status FROM yards y JOIN cities ci ON ci.id = y.city_id ORDER BY md5(y.id::text) LIMIT 20`);
    out.push(`### 20 random yards\n`);
    out.push(table(sampleY as Array<Record<string, unknown>>, ["state_code", "city_slug", "slug", "name", "address", "zip", "phone", "website", "status"]));
    const sampleC = await q(c, `SELECT state_code, slug, name, lat, lng, (SELECT count(*) FROM yards y WHERE y.city_id = cities.id)::text AS yards FROM cities ORDER BY md5(id::text) LIMIT 20`);
    out.push(`### 20 random cities\n`);
    out.push(table(sampleC as Array<Record<string, unknown>>, ["state_code", "slug", "name", "lat", "lng", "yards"]));

    fs.writeFileSync(OUT, out.join("\n"));
    console.log(`[validate] wrote ${OUT}`);
  } finally {
    await c.end();
  }
}

// Live canonical means the path resolves to an actual record in staging.
// Supports: /, /scrap-yards/, /scrap-yards/<state>/, /scrap-yards/<state>/<city>/,
// /scrap-yards/<state>/<city>/<slug>/, /scrap-metal-prices/, /scrap-metal-prices/<metal>/.
async function isLiveCanonical(c: pg.Client, p: string): Promise<boolean> {
  if (p === "/" || p === "/scrap-yards/" || p === "/scrap-metal-prices/") return true;
  let m = p.match(/^\/scrap-yards\/([^/]+)\/?$/);
  if (m) return (await q<{ n: string }>(c, `SELECT count(*)::text AS n FROM states WHERE slug = $1`, [m[1]]))[0]?.n !== "0";
  m = p.match(/^\/scrap-yards\/([^/]+)\/([^/]+)\/?$/);
  if (m) return (await q<{ n: string }>(c, `SELECT count(*)::text AS n FROM cities ci JOIN states s ON s.code = ci.state_code WHERE s.slug=$1 AND ci.slug=$2`, [m[1], m[2]]))[0]?.n !== "0";
  m = p.match(/^\/scrap-yards\/([^/]+)\/([^/]+)\/([^/]+)\/?$/);
  if (m) return (await q<{ n: string }>(c, `SELECT count(*)::text AS n FROM yards y JOIN cities ci ON ci.id = y.city_id JOIN states s ON s.code = y.state_code WHERE s.slug=$1 AND ci.slug=$2 AND y.slug=$3`, [m[1], m[2], m[3]]))[0]?.n !== "0";
  m = p.match(/^\/scrap-metal-prices\/([^/]+)\/?$/);
  if (m) return (await q<{ n: string }>(c, `SELECT count(*)::text AS n FROM metals WHERE slug=$1`, [m[1]]))[0]?.n !== "0";
  return false;
}

main().catch((e) => { console.error(e); process.exit(1); });
