// scripts/smoke-test-gsc.ts
// Picks 50 random GSC URLs from the migration's source CSV, fetches each
// against the local scrapyards dev server (following up to 3 redirects),
// and prints a histogram + per-URL detail. See spec §4 of the verification
// task. Pass criteria: zero 4xx/5xx and ≥75% click-weighted yard rate.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type GscRow = { source: string; clicks: number };
type Depth = "yard" | "city" | "state" | "category" | "metal-grade" | "root" | "self" | "other";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:80";
const GSC_CSV = resolve(process.cwd(), "../migration/input/gsc-pages.csv");
const SAMPLE_SIZE = 50;
const MAX_HOPS = 3;
const SEED = Number(process.env.SMOKE_SEED ?? 42);

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = r + Math.imul(r ^ (r >>> 7), 61 | r) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function loadGsc(): GscRow[] {
  const raw = readFileSync(GSC_CSV, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines.shift()!;
  const cols = header.split(",").map((c) => c.trim().toLowerCase());
  const pathIdx = cols.findIndex((c) => c === "page" || c === "url" || c === "path" || c === "top pages");
  const clickIdx = cols.findIndex((c) => c.includes("click"));
  if (pathIdx < 0 || clickIdx < 0) throw new Error(`unexpected GSC header: ${header}`);
  const rows: GscRow[] = [];
  for (const line of lines) {
    const cells = line.split(",");
    const raw = (cells[pathIdx] ?? "").trim();
    let path = raw;
    try { path = new URL(raw).pathname; } catch { /* already a path */ }
    if (!path.startsWith("/")) continue;
    const clicks = Number(cells[clickIdx] ?? 0) || 0;
    rows.push({ source: path, clicks });
  }
  return rows;
}

function classify(p: string): Depth {
  if (p === "/" || p === "") return "root";
  const sy = p.match(/^\/scrap-yards(\/([^/]+)(\/([^/]+)(\/([^/]+))?)?)?\/?$/);
  if (sy) {
    if (sy[6]) return "yard";
    if (sy[4]) return "city";
    if (sy[2]) return "state";
    return "root";
  }
  if (p.startsWith("/scrap-metal-prices/")) {
    const segs = p.replace(/\/$/, "").split("/").filter(Boolean);
    if (segs.length >= 2) return "metal-grade";
    return "category";
  }
  return "other";
}

async function followChain(path: string): Promise<{ status: number; finalPath: string; hops: number }> {
  let current = new URL(path, BASE);
  let hops = 0;
  while (hops <= MAX_HOPS) {
    const res = await fetch(current.toString(), { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { status: res.status, finalPath: current.pathname, hops };
      current = new URL(loc, current);
      hops++;
      continue;
    }
    return { status: res.status, finalPath: current.pathname, hops };
  }
  return { status: 999, finalPath: current.pathname, hops };
}

async function main() {
  const all = loadGsc();
  const rng = mulberry32(SEED);
  const shuffled = all.map((r) => ({ r, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.r);
  const sample = shuffled.slice(0, SAMPLE_SIZE);

  const results: Array<{ source: string; clicks: number; status: number; finalPath: string; hops: number; depth: Depth }> = [];
  let i = 0;
  for (const row of sample) {
    i++;
    try {
      const { status, finalPath, hops } = await followChain(row.source);
      const depth = status >= 200 && status < 300 ? classify(finalPath) : "other";
      results.push({ ...row, status, finalPath, hops, depth });
    } catch (e: any) {
      results.push({ ...row, status: 0, finalPath: "", hops: 0, depth: "other" });
      console.error(`[${i}/${SAMPLE_SIZE}] ERROR ${row.source}: ${e.message}`);
    }
  }

  // Histogram
  const totalClicks = results.reduce((s, r) => s + r.clicks, 0);
  const buckets: Record<Depth, { urls: number; clicks: number }> = {
    yard: { urls: 0, clicks: 0 }, city: { urls: 0, clicks: 0 }, state: { urls: 0, clicks: 0 },
    category: { urls: 0, clicks: 0 }, "metal-grade": { urls: 0, clicks: 0 },
    root: { urls: 0, clicks: 0 }, self: { urls: 0, clicks: 0 }, other: { urls: 0, clicks: 0 },
  };
  let bad = 0;
  for (const r of results) {
    if (r.status < 200 || r.status >= 400) bad++;
    buckets[r.depth].urls++;
    buckets[r.depth].clicks += r.clicks;
  }

  console.log("\n=== GSC SMOKE TEST ===");
  console.log(`Base: ${BASE}  Sample: ${SAMPLE_SIZE}/${all.length}  Seed: ${SEED}`);
  console.log(`Total clicks in sample: ${totalClicks}`);
  console.log(`Non-2xx/3xx responses: ${bad}\n`);
  console.log("Depth        | URLs | Clicks | %URLs  | %Clicks");
  console.log("-------------|------|--------|--------|--------");
  for (const k of Object.keys(buckets) as Depth[]) {
    const b = buckets[k];
    const pu = ((b.urls / SAMPLE_SIZE) * 100).toFixed(1);
    const pc = totalClicks ? ((b.clicks / totalClicks) * 100).toFixed(1) : "0.0";
    console.log(`${k.padEnd(13)}| ${String(b.urls).padStart(4)} | ${String(b.clicks).padStart(6)} | ${pu.padStart(5)}% | ${pc.padStart(6)}%`);
  }

  console.log("\n=== PER-URL DETAIL ===");
  for (const r of results.sort((a, b) => b.clicks - a.clicks)) {
    console.log(`${String(r.status).padEnd(3)} clicks=${String(r.clicks).padStart(3)} hops=${r.hops} ${r.depth.padEnd(11)} ${r.source}  ->  ${r.finalPath}`);
  }

  const yardClickPct = totalClicks ? (buckets.yard.clicks / totalClicks) * 100 : 0;
  console.log(`\nYard click-weight: ${yardClickPct.toFixed(1)}% (target ≥75%)`);
  if (bad > 0 || yardClickPct < 75) {
    console.log("STATUS: FAIL");
    process.exitCode = 1;
  } else {
    console.log("STATUS: PASS");
  }
}

void main();
