/**
 * Smoke-test for scrapyards.io redirects.
 *
 * Hits each URL on $TEST_HOST (default http://localhost:22232 — the Next.js
 * dev server port for this artifact) and asserts a 301 with the expected
 * Location header.
 */

const HOST = process.env.TEST_HOST ?? "http://localhost:22232";

type Case = {
  name: string;
  source: string;
  expectStatus: number;
  expectLocationPath: string;
};

const CASES: Case[] = [
  // Pattern 1: /services/united-states/:state/:city/:cat/:slug/
  { name: "P1 PA Philly metal-recycling Keystone", source: "/services/united-states/pennsylvania/pittsburgh/metal-recycling/steel-city-scrap/", expectStatus: 308, expectLocationPath: "/scrap-yards/pennsylvania/pittsburgh/steel-city-scrap/" },
  { name: "P1 TX Houston salvage Lone-Star", source: "/services/united-states/texas/houston/salvage/lone-star-recycling/", expectStatus: 308, expectLocationPath: "/scrap-yards/texas/houston/lone-star-recycling/" },
  { name: "P1 NC Charlotte recycling Queen-City", source: "/services/united-states/north-carolina/charlotte/recycling/queen-city-scrap/", expectStatus: 308, expectLocationPath: "/scrap-yards/north-carolina/charlotte/queen-city-scrap/" },

  // Pattern 2: /services/united-states/:state/:city/
  { name: "P2 PA Pittsburgh", source: "/services/united-states/pennsylvania/pittsburgh/", expectStatus: 308, expectLocationPath: "/scrap-yards/pennsylvania/pittsburgh/" },
  { name: "P2 KY La Grange", source: "/services/united-states/kentucky/la-grange/", expectStatus: 308, expectLocationPath: "/scrap-yards/kentucky/la-grange/" },
  { name: "P2 WI Nekoosa", source: "/services/united-states/wisconsin/nekoosa/", expectStatus: 308, expectLocationPath: "/scrap-yards/wisconsin/nekoosa/" },

  // Pattern 3: /services/united-states/:state/
  { name: "P3 PA", source: "/services/united-states/pennsylvania/", expectStatus: 308, expectLocationPath: "/scrap-yards/pennsylvania/" },
  { name: "P3 TX", source: "/services/united-states/texas/", expectStatus: 308, expectLocationPath: "/scrap-yards/texas/" },

  // Pattern 4: /services/category/:cat/united-states/:state/:city/
  { name: "P4 copper PA Pittsburgh", source: "/services/category/copper/united-states/pennsylvania/pittsburgh/", expectStatus: 308, expectLocationPath: "/scrap-yards/pennsylvania/pittsburgh/" },
  { name: "P4 aluminum NC Charlotte", source: "/services/category/aluminum/united-states/north-carolina/charlotte/", expectStatus: 308, expectLocationPath: "/scrap-yards/north-carolina/charlotte/" },

  // Pattern 5: /services/category/:cat/united-states/:state/
  { name: "P5 copper PA", source: "/services/category/copper/united-states/pennsylvania/", expectStatus: 308, expectLocationPath: "/scrap-yards/pennsylvania/" },
  { name: "P5 steel TX", source: "/services/category/steel/united-states/texas/", expectStatus: 308, expectLocationPath: "/scrap-yards/texas/" },

  // Pattern 6: ?sort_by=* stripping (middleware → 301)
  { name: "P6 sort_by on yards page", source: "/scrap-yards/?sort_by=name", expectStatus: 301, expectLocationPath: "/scrap-yards/" },
  { name: "P6 sort_by on prices page", source: "/scrap-metal-prices/?sort_by=price", expectStatus: 301, expectLocationPath: "/scrap-metal-prices/" },
  { name: "P6 sort_by on state page", source: "/scrap-yards/pennsylvania/?sort_by=rating", expectStatus: 301, expectLocationPath: "/scrap-yards/pennsylvania/" },

  // Pattern 7: /blog/metal/:metal/
  { name: "P7 blog copper-1", source: "/blog/metal/copper-1/", expectStatus: 308, expectLocationPath: "/scrap-metal-prices/copper-1/" },
  { name: "P7 blog aluminum-mixed", source: "/blog/metal/aluminum-mixed/", expectStatus: 308, expectLocationPath: "/scrap-metal-prices/aluminum-mixed/" },

  // DB-backed legacy_redirect fallback
  { name: "DB tag/copper", source: "/tag/copper/", expectStatus: 301, expectLocationPath: "/scrap-metal-prices/copper/" },
  { name: "DB old-yard-finder", source: "/old-yard-finder/", expectStatus: 301, expectLocationPath: "/scrap-yards/" },
  { name: "DB test-db-redirect", source: "/test-db-redirect/", expectStatus: 301, expectLocationPath: "/scrap-yards/pennsylvania/" },
];

type Result = { name: string; source: string; pass: boolean; got: string; expected: string };

async function run() {
  const results: Result[] = [];
  for (const c of CASES) {
    const url = `${HOST}${c.source}`;
    let got = "";
    let pass = false;
    try {
      const res = await fetch(url, { redirect: "manual" });
      const loc = res.headers.get("location") || "";
      const locPath = loc.startsWith("http") ? new URL(loc).pathname + new URL(loc).search : loc;
      got = `${res.status} ${locPath}`;
      pass = res.status === c.expectStatus && locPath === c.expectLocationPath;
    } catch (e) {
      got = `ERROR ${(e as Error).message}`;
    }
    results.push({ name: c.name, source: c.source, pass, got, expected: `${c.expectStatus} ${c.expectLocationPath}` });
  }

  const passCount = results.filter((r) => r.pass).length;
  console.log("\n=== SMOKE-TEST REDIRECTS ===");
  console.log(`Host: ${HOST}\n`);
  for (const r of results) {
    const tag = r.pass ? "PASS" : "FAIL";
    console.log(`[${tag}] ${r.name}`);
    console.log(`        source:   ${r.source}`);
    console.log(`        expected: ${r.expected}`);
    console.log(`        got:      ${r.got}`);
  }
  console.log(`\n${passCount}/${results.length} passed.`);
  if (passCount !== results.length) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
