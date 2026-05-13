// scripts/test-slug-normalization.ts
// Black-box tests for the runtime slug-normalization fallback in
// artifacts/scrapyards/app/api/legacy-redirect/route.ts (tryNormalize).
// Hits the real /api/legacy-redirect endpoint against the local dev server
// so the assertions reflect what production middleware will do.

// The shared proxy on :80 routes /api/* to the api-server artifact, not to
// scrapyards. Hit scrapyards' Next.js port directly (default 22232 — see
// artifacts/scrapyards/.replit-artifact/artifact.toml).
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:22232";

type Case = {
  name: string;
  path: string;
  expect: { status: number; targetPath?: string | null; allow404?: boolean };
};

const cases: Case[] = [
  // --- State-alias normalization (positive) -----------------------------
  { name: "michigan-1 state strips to michigan",
    path: "/scrap-yards/michigan-1/",
    expect: { status: 200, targetPath: "/scrap-yards/michigan/" } },
  { name: "indiana-1 state strips to indiana",
    path: "/scrap-yards/indiana-1/",
    expect: { status: 200, targetPath: "/scrap-yards/indiana/" } },
  { name: "kansas-1 state strips to kansas",
    path: "/scrap-yards/kansas-1/",
    expect: { status: 200, targetPath: "/scrap-yards/kansas/" } },
  { name: "virginia-2 state strips to virginia",
    path: "/scrap-yards/virginia-2/",
    expect: { status: 200, targetPath: "/scrap-yards/virginia/" } },
  { name: "washington-7 state strips to washington",
    path: "/scrap-yards/washington-7/",
    expect: { status: 200, targetPath: "/scrap-yards/washington/" } },

  // --- State-alias normalization (negative) -----------------------------
  // ohio-1 is not in §B1 alias map: there is no such state, must NOT
  // synthesize a redirect.
  { name: "ohio-1 is not an alias — 404",
    path: "/scrap-yards/ohio-1/",
    expect: { status: 404, allow404: true } },
  { name: "texas-3 is not an alias — 404",
    path: "/scrap-yards/texas-3/",
    expect: { status: 404, allow404: true } },

  // --- City-suffix stripping --------------------------------------------
  // Tested earlier in the GSC sample: tennessee/livingston-5 → livingston.
  { name: "tennessee/livingston-5 city suffix stripped",
    path: "/scrap-yards/tennessee/livingston-5/",
    expect: { status: 200, targetPath: "/scrap-yards/tennessee/livingston/" } },
  { name: "michigan-1/imlay-city normalizes both segments",
    path: "/scrap-yards/michigan-1/imlay-city/",
    expect: { status: 200, targetPath: "/scrap-yards/michigan/imlay-city/" } },

  // --- Yard-suffix conditional stripping --------------------------------
  // From the smoke test: oklahoma/carney/american-scrap-3 → american-scrap.
  { name: "yard suffix stripped when cleaned slug exists",
    path: "/scrap-yards/oklahoma/carney/american-scrap-3/",
    expect: { status: 200, targetPath: "/scrap-yards/oklahoma/carney/american-scrap/" } },

  // --- Already-canonical path: no-op ------------------------------------
  // The middleware should NOT issue a self-redirect for paths that are
  // already canonical — tryNormalize returns null, the API answers 404,
  // and middleware passes through to render the page.
  { name: "canonical state path is left alone",
    path: "/scrap-yards/texas/",
    expect: { status: 404, allow404: true } },

  // --- /blog/metal/<slug>/ resolution -----------------------------------
  // Valid grade slug → grade page (NOT the hub). Guards against the
  // middleware fallback silently swallowing real grades.
  { name: "/blog/metal/bare-bright-copper resolves to grade page",
    path: "/blog/metal/bare-bright-copper/",
    expect: { status: 200, targetPath: "/scrap-metal-prices/bare-bright-copper/" } },
  { name: "/blog/metal/aluminum-cans resolves to grade page",
    path: "/blog/metal/aluminum-cans/",
    expect: { status: 200, targetPath: "/scrap-metal-prices/aluminum-cans/" } },
  // Unknown slug: kovar already has a DB redirect to the hub from the GSC
  // build sweep. Other unknown slugs not in legacy_redirects would 404 from
  // the API and be caught by the middleware /blog/metal/* fallback.
  { name: "/blog/metal/kovar (DB redirect) goes to hub",
    path: "/blog/metal/kovar/",
    expect: { status: 200, targetPath: "/scrap-metal-prices/" } },
  { name: "/blog/metal/totally-unknown-grade-xyz returns 404 (middleware fallback handles it)",
    path: "/blog/metal/totally-unknown-grade-xyz/",
    expect: { status: 404, allow404: true } },
];

async function callApi(path: string): Promise<{ status: number; body: any }> {
  const url = new URL("/api/legacy-redirect/", BASE);
  url.searchParams.set("path", path);
  const res = await fetch(url.toString());
  let body: any = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

async function main() {
  console.log(`\n=== SLUG NORMALIZATION TESTS ===`);
  console.log(`Base: ${BASE}\n`);
  let passed = 0, failed = 0;
  for (const c of cases) {
    const { status, body } = await callApi(c.path);
    const want = c.expect;
    const ok = want.allow404
      ? status === 404
      : status === 200 && body?.targetPath === want.targetPath;
    const tag = ok ? "PASS" : "FAIL";
    if (ok) passed++; else failed++;
    const got = status === 200 ? `200 → ${body?.targetPath ?? "(no target)"}` : `${status}`;
    const exp = want.allow404 ? "404" : `200 → ${want.targetPath}`;
    console.log(`[${tag}] ${c.name}`);
    console.log(`        path=${c.path}`);
    console.log(`        expect=${exp}`);
    console.log(`        got=${got}`);
  }
  console.log(`\n${passed}/${cases.length} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

void main();
