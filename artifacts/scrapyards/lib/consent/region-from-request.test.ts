/**
 * Region resolution unit tests.
 *
 * The single most important assertion lives in the test named
 *   "regression: stale sy_region=opt-in cookie does NOT override live US edge header"
 * — that is the exact bug the production tester hit (Chrome with stale
 * dev-override cookie kept seeing the EEA modal in the US). If that
 * assertion ever flips, cookie-before-live-detection has been
 * reintroduced.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { determineRegion } from "./region-from-request";

vi.mock("./geo", () => ({
  lookupCountry: vi.fn(async () => null),
}));

import { lookupCountry } from "./geo";

type MockReq = {
  headers: Headers;
  cookies: { get(name: string): { value: string } | undefined };
  nextUrl: URL & { searchParams: URLSearchParams };
};

function mkReq(opts: {
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  url?: string;
}): MockReq {
  const url = new URL(opts.url ?? "https://scrapyards.io/");
  const headers = new Headers(opts.headers ?? {});
  const cookies = opts.cookies ?? {};
  return {
    headers,
    cookies: {
      get: (name: string) =>
        cookies[name] !== undefined ? { value: cookies[name] } : undefined,
    },
    nextUrl: url as URL & { searchParams: URLSearchParams },
  };
}

beforeEach(() => {
  vi.mocked(lookupCountry).mockReset();
  vi.mocked(lookupCountry).mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("determineRegion priority chain", () => {
  it("GPC: 1 → opt-out, persisted, regardless of region", async () => {
    const d = await determineRegion(
      mkReq({ headers: { "sec-gpc": "1", "cf-ipcountry": "DE" } }) as never,
    );
    expect(d).toMatchObject({ region: "opt-out", gpc: true, source: "gpc", persist: true });
  });

  it("dev override is respected but NOT persisted", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const d = await determineRegion(
      mkReq({ url: "https://scrapyards.io/?region=opt-in" }) as never,
    );
    expect(d).toMatchObject({ region: "opt-in", source: "dev-override", persist: false });
  });

  it("dev override is ignored in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const d = await determineRegion(
      mkReq({
        url: "https://scrapyards.io/?region=opt-in",
        headers: { "cf-ipcountry": "US" },
      }) as never,
    );
    expect(d).toMatchObject({ region: "opt-out", source: "edge-header", country: "US" });
  });

  it("edge header US → opt-out, persisted", async () => {
    const d = await determineRegion(
      mkReq({ headers: { "cf-ipcountry": "US" } }) as never,
    );
    expect(d).toMatchObject({ region: "opt-out", source: "edge-header", country: "US", persist: true });
  });

  it("edge header DE → opt-in, persisted", async () => {
    const d = await determineRegion(
      mkReq({ headers: { "x-vercel-ip-country": "DE" } }) as never,
    );
    expect(d).toMatchObject({ region: "opt-in", source: "edge-header", country: "DE", persist: true });
  });

  it("country.is success → uses lookup, persisted", async () => {
    vi.mocked(lookupCountry).mockResolvedValue("FR");
    const d = await determineRegion(
      mkReq({ headers: { "x-forwarded-for": "8.8.8.8" } }) as never,
    );
    expect(d).toMatchObject({ region: "opt-in", source: "geo-lookup", country: "FR", persist: true });
  });

  it("country.is timeout (returns null) → falls through to default, NOT persisted", async () => {
    vi.mocked(lookupCountry).mockResolvedValue(null);
    const d = await determineRegion(
      mkReq({ headers: { "x-forwarded-for": "8.8.8.8" } }) as never,
    );
    expect(d).toMatchObject({ region: "opt-in", source: "default", persist: false });
  });

  it("cookie used only when live signals fail; NOT persisted (already cached)", async () => {
    const d = await determineRegion(
      mkReq({ cookies: { sy_region: "opt-out" } }) as never,
    );
    expect(d).toMatchObject({ region: "opt-out", source: "cookie", persist: false });
  });

  it("regression: stale sy_region=opt-in cookie does NOT override live US edge header", async () => {
    // This is the production bug. A US tester whose Chrome had a
    // stale sy_region=opt-in cookie (from a prior ?region=opt-in dev
    // hit, or from a country.is timeout falling to safe-default
    // opt-in) used to keep seeing the EEA opt-in modal for an hour
    // because the cookie was checked BEFORE live detection. After the
    // fix, the live edge header (CF-IPCountry: US) wins, and the
    // cookie is overwritten with the correct value.
    const d = await determineRegion(
      mkReq({
        headers: { "cf-ipcountry": "US" },
        cookies: { sy_region: "opt-in" },
      }) as never,
    );
    expect(d.region).toBe("opt-out");
    expect(d.source).toBe("edge-header");
    expect(d.persist).toBe(true);
  });

  it("safe default opt-in when nothing resolves, NOT persisted", async () => {
    const d = await determineRegion(mkReq({}) as never);
    expect(d).toMatchObject({ region: "opt-in", source: "default", persist: false });
  });

  it("GPC overrides cookie", async () => {
    const d = await determineRegion(
      mkReq({
        headers: { "sec-gpc": "1" },
        cookies: { sy_region: "opt-in" },
      }) as never,
    );
    expect(d).toMatchObject({ region: "opt-out", source: "gpc", gpc: true });
  });
});

describe("determineRegion: deterministic banner choice per (region, gpc, bot) tuple", () => {
  // For a fixed (region, gpc) the resolved region should be a pure
  // function of the inputs — no randomness, no time dependency.
  // (Bot-gating is enforced separately at the ConsentSlot layer.)
  const tuples: Array<{
    name: string;
    headers: Record<string, string>;
    cookies?: Record<string, string>;
    expectedRegion: "opt-in" | "opt-out";
    expectedGpc: boolean;
  }> = [
    { name: "US no-gpc", headers: { "cf-ipcountry": "US" }, expectedRegion: "opt-out", expectedGpc: false },
    { name: "US gpc", headers: { "cf-ipcountry": "US", "sec-gpc": "1" }, expectedRegion: "opt-out", expectedGpc: true },
    { name: "DE no-gpc", headers: { "cf-ipcountry": "DE" }, expectedRegion: "opt-in", expectedGpc: false },
    { name: "DE gpc", headers: { "cf-ipcountry": "DE", "sec-gpc": "1" }, expectedRegion: "opt-out", expectedGpc: true },
    { name: "Unknown no-gpc (default)", headers: {}, expectedRegion: "opt-in", expectedGpc: false },
  ];

  for (const t of tuples) {
    it(`${t.name} → region=${t.expectedRegion} gpc=${t.expectedGpc} (deterministic)`, async () => {
      const runs = await Promise.all(
        Array.from({ length: 5 }, () =>
          determineRegion(mkReq({ headers: t.headers, cookies: t.cookies }) as never),
        ),
      );
      for (const d of runs) {
        expect(d.region).toBe(t.expectedRegion);
        expect(d.gpc).toBe(t.expectedGpc);
      }
    });
  }
});
