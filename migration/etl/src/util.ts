// Shared text/path helpers (spec §B4).
const STREET_ABBR: Array<[RegExp, string]> = [
  [/\bSTREET\b/g, "ST"],
  [/\bAVENUE\b/g, "AVE"],
  [/\bROAD\b/g, "RD"],
  [/\bDRIVE\b/g, "DR"],
  [/\bBOULEVARD\b/g, "BLVD"],
  [/\bLANE\b/g, "LN"],
  [/\bHIGHWAY\b/g, "HWY"],
  [/\bCIRCLE\b/g, "CIR"],
  [/\bCOURT\b/g, "CT"],
  [/\bPLACE\b/g, "PL"],
  [/\bPARKWAY\b/g, "PKWY"],
  [/\bNORTH\b/g, "N"],
  [/\bSOUTH\b/g, "S"],
  [/\bEAST\b/g, "E"],
  [/\bWEST\b/g, "W"],
];

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function stripSlugSuffix(s: string): string {
  return s.replace(/-\d+$/, "");
}

export function normalizeAddress(s: string | null | undefined): string {
  if (!s) return "";
  let t = s.trim().toUpperCase().replace(/\s+/g, " ").replace(/[.,;:]+$/, "");
  for (const [re, rep] of STREET_ABBR) t = t.replace(re, rep);
  return t.toLowerCase();
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&#038;": "&",
  "&#039;": "'",
  "&apos;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&ndash;": "–",
  "&mdash;": "—",
  "&hellip;": "…",
};
export function htmlDecode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&[a-zA-Z#0-9]+;/g, (m) => HTML_ENTITIES[m] ?? m);
}

const WEBSITE_PLACEHOLDERS = new Set([
  "sell your scrap here",
  "n/a", "na", "none", "not available", "-", "tbd",
]);
export function cleanWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (WEBSITE_PLACEHOLDERS.has(t.toLowerCase())) return null;
  if (!t.includes(".")) return null;
  if (/^(mailto|tel):/i.test(t)) return null;
  let url = t;
  if (!/^https?:\/\//i.test(url)) url = "http://" + url;
  // lowercase host, strip trailing slash
  try {
    const u = new URL(url);
    let s = `${u.protocol}//${u.host.toLowerCase()}${u.pathname}${u.search}${u.hash}`;
    s = s.replace(/\/+$/, "");
    // Drop tracking-redirect URLs (citygrid, doubleclick, etc.) that overflow our column.
    if (s.length > 255) return null;
    return s;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function cleanEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  return EMAIL_RE.test(t) ? t : null;
}

export function cleanZip(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = String(raw).trim();
  if (!t) return null;
  // observed format: "53057.0" — parse as float, truncate, zero-pad to 5
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  const z = String(Math.trunc(n)).padStart(5, "0");
  return /^\d{5}$/.test(z) ? z : null;
}

export function cleanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let t = raw.trim();
  if (!t) return null;
  if (t.length > 20) t = t.slice(0, 20);
  return t;
}

export function cleanLatLng(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(6);
}

// SQL escaping: we always quote with $tag$...$tag$ dollar quoting where needed,
// or single-quote with doubled '' for short strings.
export function sqlString(s: string | null | undefined): string {
  if (s == null) return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

export function sqlJsonb(v: unknown | null): string {
  if (v == null) return "NULL";
  const s = JSON.stringify(v);
  return sqlString(s) + "::jsonb";
}

export function sqlTextArray(arr: string[] | null | undefined): string {
  if (!arr) return "NULL";
  if (arr.length === 0) return "ARRAY[]::text[]";
  return "ARRAY[" + arr.map((x) => sqlString(x)).join(",") + "]::text[]";
}

export function sqlNumeric(s: string | null | undefined): string {
  if (s == null) return "NULL";
  const t = String(s).trim();
  if (!t) return "NULL";
  return t;
}
