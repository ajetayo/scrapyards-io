// Business hours parser (spec §H). Two observed shapes:
//   1. Free-form English: "Mon - Fri: 7:00 am - 5:00 pm Sat: 7:00 am - 1:30 pm Sun Closed"
//   2. Schema.org-ish CSV: "Mo,Tu 09:00-17:00 ; Sa 10:00-14:00 ; Su Closed"
//
// On any parse failure we still produce a row but with shape { raw: <original> }.

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type HoursValue =
  | { raw: string }
  | Partial<Record<DayKey, "closed" | Array<{ open: string; close: string }>>>;

const DAYS: readonly DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const DAY_TOKENS: Record<string, DayKey> = {
  mo: "mon", mon: "mon", monday: "mon",
  tu: "tue", tue: "tue", tues: "tue", tuesday: "tue",
  we: "wed", wed: "wed", weds: "wed", wednesday: "wed",
  th: "thu", thu: "thu", thur: "thu", thurs: "thu", thursday: "thu",
  fr: "fri", fri: "fri", friday: "fri",
  sa: "sat", sat: "sat", saturday: "sat",
  su: "sun", sun: "sun", sunday: "sun",
};

function dayIndex(d: DayKey): number {
  return DAYS.indexOf(d);
}

function expandRange(a: DayKey, b: DayKey): DayKey[] {
  const ai = dayIndex(a);
  const bi = dayIndex(b);
  if (ai < 0 || bi < 0) return [];
  if (bi < ai) return [];
  const out: DayKey[] = [];
  for (let i = ai; i <= bi; i++) {
    const day = DAYS[i];
    if (day) out.push(day);
  }
  return out;
}

function normalizeTime(h: number, m: number, ap?: string | null): string | null {
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    if (ap) {
      // try with am/pm
    } else return null;
  }
  let hh = h;
  if (ap) {
    const a = ap.toLowerCase();
    if (a === "pm" && hh < 12) hh += 12;
    if (a === "am" && hh === 12) hh = 0;
  }
  if (hh < 0 || hh > 23) return null;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTimeSpan(s: string): { open: string; close: string } | null {
  const t = s.trim().toLowerCase();
  // "7:00 am - 5:00 pm" or "09:00-17:00" or "9 am - 5 pm"
  const m = t.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/
  );
  if (!m) return null;
  const o = normalizeTime(parseInt(m[1]!, 10), m[2] ? parseInt(m[2], 10) : 0, m[3] ?? null);
  const c = normalizeTime(parseInt(m[4]!, 10), m[5] ? parseInt(m[5], 10) : 0, m[6] ?? null);
  if (!o || !c) return null;
  return { open: o, close: c };
}

export function parseBusinessHours(raw: string | null | undefined): HoursValue | null {
  if (!raw) return null;
  let str = raw.trim();
  if (!str) return null;

  // Drop GeoDirectory's trailing "[\"UTC\":\"-5\",\"Timezone\":\"...\"]" tail if present.
  str = str.replace(/,\s*\[[^\]]*"Timezone"[^\]]*\]\s*$/i, "");

  const out: Partial<Record<DayKey, "closed" | Array<{ open: string; close: string }>>> = {};

  // Try schema.org-ish JSON-array form: ["Mo 09:00-17:00","Tu 09:00-17:00",...]
  if (str.startsWith("[")) {
    try {
      // Some dumps have malformed trailing brackets — try to parse up to the matching ].
      const last = str.lastIndexOf("]");
      const arr = JSON.parse(str.slice(0, last + 1)) as unknown;
      if (Array.isArray(arr)) {
        for (const it of arr) {
          if (typeof it !== "string") continue;
          const piece = it.trim();
          // "Mo 09:00-17:00" or "Mo,Tu 09:00-17:00" or "Mo Closed"
          const m = piece.match(/^([A-Za-z,\s\-–]+?)\s+(.+)$/);
          if (!m) continue;
          const days = parseDaysToken(m[1]!);
          const rest = m[2]!.trim();
          if (/closed/i.test(rest)) {
            for (const d of days) out[d] = "closed";
            continue;
          }
          const span = parseTimeSpan(rest);
          if (span) for (const d of days) {
            const cur = out[d];
            if (cur === "closed" || cur === undefined) out[d] = [span];
            else cur.push(span);
          }
        }
        if (Object.keys(out).length > 0) return out;
      }
    } catch { /* fall through to free-form */ }
  }

  // Free-form: split on ";" first (CSV form), else parse English form sequentially.
  const segments = str.includes(";") ? str.split(/\s*;\s*/) : splitFreeform(str);
  for (const seg of segments) {
    const piece = seg.trim();
    if (!piece) continue;
    // "Mo,Tu 09:00-17:00" or "Mon - Fri: 7:00 am - 5:00 pm" or "Sun Closed"
    const m = piece.match(/^([A-Za-z][A-Za-z,\s\-–]*?)\s*[:\-]?\s*(.+)$/);
    if (!m) continue;
    const days = parseDaysToken(m[1]!);
    if (days.length === 0) continue;
    const rest = m[2]!.trim();
    if (/^closed$/i.test(rest) || /closed/i.test(rest) && !/\d/.test(rest)) {
      for (const d of days) out[d] = "closed";
      continue;
    }
    const span = parseTimeSpan(rest);
    if (span) {
      for (const d of days) {
        const cur = out[d];
        if (cur === "closed" || cur === undefined) out[d] = [span];
        else cur.push(span);
      }
    }
  }

  if (Object.keys(out).length === 0) return { raw };
  return out;
}

function parseDaysToken(tok: string): DayKey[] {
  const t = tok.trim().toLowerCase().replace(/[.\s]+$/, "");
  // Range: "Mon - Fri" or "Mo-Fr"
  const r = t.match(/^([a-z]+)\s*[-–]\s*([a-z]+)$/);
  if (r) {
    const a = DAY_TOKENS[r[1]!];
    const b = DAY_TOKENS[r[2]!];
    if (a && b) return expandRange(a, b);
  }
  // Comma list: "Mo,Tu,We" or "mon, tue"
  if (t.includes(",")) {
    const out: DayKey[] = [];
    for (const p of t.split(/[, ]+/)) {
      const d = DAY_TOKENS[p.trim()];
      if (d) out.push(d);
    }
    return out;
  }
  // Single
  const d = DAY_TOKENS[t];
  return d ? [d] : [];
}

// Split "Mon - Fri: 7:00 am - 5:00 pm Sat: 7:00 am - 1:30 pm Sun Closed"
// into segments at day-token boundaries.
function splitFreeform(s: string): string[] {
  // Insert a separator before every recognized day token (case-insensitive), then split.
  const dayPattern = /\b(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|mo|tu|we|th|fr|sa|su)\b/gi;
  // First, normalize multiple spaces.
  const norm = s.replace(/\s+/g, " ");
  const parts = norm.split(dayPattern);
  // re-stitch: dayPattern split keeps the matched group, so parts alternates
  // [pre, day, between, day, ...]. Rebuild segments as day + following text.
  const segs: string[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const day = parts[i] ?? "";
    const rest = (parts[i + 1] ?? "").trim();
    segs.push(`${day} ${rest}`.trim());
  }
  return segs.length > 0 ? segs : [norm];
}

export function isPermanentlyClosed(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /permanently\s+closed/i.test(raw);
}
