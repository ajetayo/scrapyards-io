/**
 * IP → country code lookup with in-memory cache.
 *
 * Service: https://api.country.is — free, no API key, returns
 * { "country": "US", "ip": "1.2.3.4" }. The service does not log IPs
 * (per their public statement); disclose the use in the privacy policy.
 *
 * Hard 250ms timeout. On any failure (timeout, network, non-200, JSON
 * parse) the caller's safe default applies — we return null and the
 * consent middleware falls back to opt-in.
 *
 * Cache: 24h TTL, 10,000 entries max. Implemented with a plain Map +
 * insertion-order eviction so the module is safe to import from
 * Next.js Edge-runtime middleware (lru-cache historically has had
 * edge-runtime compatibility issues; the cookie-based per-visitor cache
 * already does most of the work — this is just a fast-path for
 * repeat first-visit traffic from the same IP).
 */

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 10_000;
const FETCH_TIMEOUT_MS = 250;

type Entry = { cc: string; expires: number };
const cache: Map<string, Entry> = new Map();

function cacheGet(ip: string): string | null {
  const e = cache.get(ip);
  if (!e) return null;
  if (e.expires <= Date.now()) {
    cache.delete(ip);
    return null;
  }
  // Refresh insertion order (LRU-ish): re-insert.
  cache.delete(ip);
  cache.set(ip, e);
  return e.cc;
}

function cacheSet(ip: string, cc: string): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(ip, { cc, expires: Date.now() + TTL_MS });
}

export async function lookupCountry(ip: string): Promise<string | null> {
  if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return null; // private / loopback — no public lookup possible
  }

  const hit = cacheGet(ip);
  if (hit) return hit;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { country?: string };
    const cc = (data.country ?? "").toUpperCase();
    if (!cc || cc.length !== 2) return null;
    cacheSet(ip, cc);
    return cc;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
