import { db } from "@/lib/db";
import { metalsTable, metalPricesTable, priceUpdatesTable } from "@workspace/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// ─── formula table ────────────────────────────────────────────────────────────

type SpotFormula  = { type: "spot";  metal: string; multiplier: number };
type BlendFormula = { type: "blend"; parts: Array<{ metal: string; weight: number }>; multiplier: number };
type FixedFormula = { type: "fixed"; price: number };
type Formula = SpotFormula | BlendFormula | FixedFormula;

const FORMULAS: Record<string, Formula> = {
  "bare-bright-copper":    { type: "spot",  metal: "copper",   multiplier: 0.96 },
  "copper-1":              { type: "spot",  metal: "copper",   multiplier: 0.92 },
  "copper-2":              { type: "spot",  metal: "copper",   multiplier: 0.82 },
  "copper-pipe":           { type: "spot",  metal: "copper",   multiplier: 0.89 },
  "insulated-copper-wire": { type: "spot",  metal: "copper",   multiplier: 0.45 },
  "aluminum-mixed":        { type: "spot",  metal: "aluminum", multiplier: 0.55 },
  "aluminum-cans":         { type: "spot",  metal: "aluminum", multiplier: 0.75 },
  "aluminum-extrusion":    { type: "spot",  metal: "aluminum", multiplier: 0.78 },
  "brass-yellow": {
    type: "blend",
    parts: [{ metal: "copper", weight: 0.65 }, { metal: "zinc", weight: 0.35 }],
    multiplier: 0.85,
  },
  "brass-red": {
    type: "blend",
    parts: [{ metal: "copper", weight: 0.85 }, { metal: "zinc", weight: 0.15 }],
    multiplier: 0.85,
  },
  "lead-soft":           { type: "spot",  metal: "lead",     multiplier: 0.92 },
  "lead-wheel-weights":  { type: "spot",  metal: "lead",     multiplier: 0.65 },
  "zinc-die-cast":       { type: "spot",  metal: "zinc",     multiplier: 0.70 },
  "stainless-steel":     { type: "fixed", price: 0.62  },
  "steel-heavy-melt":    { type: "fixed", price: 285   },
  "light-iron":          { type: "fixed", price: 215   },
  "cast-iron":           { type: "fixed", price: 0.18  },
  "low-grade-board":     { type: "fixed", price: 0.85  },
  "high-grade-board":    { type: "fixed", price: 8.20  },
  "silver":              { type: "spot",  metal: "silver",   multiplier: 1.0 },
  "gold":                { type: "spot",  metal: "gold",     multiplier: 1.0 },
  "car-battery":         { type: "fixed", price: 8.50  },
  "catalytic-converter": { type: "fixed", price: 95    },
};

// MetalpriceAPI symbol → base-metal name.
// API returns both {symbol} (troy-oz per USD) and USD{symbol} (USD per troy-oz).
// We use the USD{symbol} keys — already in USD/troy-oz, no inversion needed.
const SYMBOL_TO_METAL: Record<string, string> = {
  XCU: "copper",   // copper    → USDXCU
  ALU: "aluminum", // aluminum  → USDALU
  XPB: "lead",     // lead      → USDXPB
  ZNC: "zinc",     // zinc      → USDZНC
  XAU: "gold",     // gold      → USDXAU
  XAG: "silver",   // silver    → USDXAG
};

// Precious metals stay as USD/troy-oz; base metals convert troy-oz → lb.
const PRECIOUS = new Set(["gold", "silver"]);
const TROY_OZ_PER_LB = 14.5833;

// ─── helpers ──────────────────────────────────────────────────────────────────

function roundPrice(price: number, unit: string): number {
  if (unit === "ton") return Math.round(price);
  return Math.round(price * 100) / 100;
}

function computePrice(
  formula: Formula,
  spot: Record<string, number>,
  unit: string,
): number | null {
  if (formula.type === "fixed") return formula.price;

  if (formula.type === "spot") {
    const base = spot[formula.metal];
    if (base == null) return null;
    return roundPrice(base * formula.multiplier, unit);
  }

  // blend
  let blended = 0;
  for (const { metal, weight } of formula.parts) {
    const base = spot[metal];
    if (base == null) return null;
    blended += base * weight;
  }
  return roundPrice(blended * formula.multiplier, unit);
}

// ─── route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const t0 = Date.now();

  // 1. Auth — Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || token !== process.env.CRON_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const errors: string[] = [];
  let baseSpot: Record<string, number> = {};

  // 2. Fetch spot prices from MetalpriceAPI
  try {
    const apiKey = process.env.METALPRICEAPI_KEY;
    if (!apiKey) throw new Error("METALPRICEAPI_KEY not configured");

    const url =
      `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}` +
      `&base=USD&currencies=XCU,ALU,XPB,ZNC,XAU,XAG`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`MetalpriceAPI HTTP ${res.status}: ${await res.text()}`);

    const data = await res.json() as {
      success: boolean;
      rates?: Record<string, number>;
      error?: { statusCode?: number; message?: string };
    };
    if (!data.success) {
      const apiMsg = data.error?.message ?? "unknown error";
      throw new Error(`MetalpriceAPI error: ${apiMsg}`);
    }
    if (!data.rates) throw new Error("MetalpriceAPI: no rates in response");

    // API returns both {symbol} (troy-oz/USD) and USD{symbol} (USD/troy-oz).
    // USD{symbol} is the direct price — no inversion needed.
    // Base metals: USD/troy-oz × 14.5833 troy-oz/lb = USD/lb.
    // Precious: stay as USD/troy-oz.
    for (const [symbol, metalName] of Object.entries(SYMBOL_TO_METAL)) {
      const usdPerTroyOz = data.rates["USD" + symbol];
      if (usdPerTroyOz == null || usdPerTroyOz === 0) continue;
      baseSpot[metalName] = PRECIOUS.has(metalName)
        ? usdPerTroyOz                      // USD/troy-oz — gold, silver
        : usdPerTroyOz * TROY_OZ_PER_LB;   // USD/troy-oz → USD/lb
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`MetalpriceAPI fetch failed: ${msg}`);

    await db.insert(priceUpdatesTable).values({
      source: "cron",
      successCount: 0,
      errorCount: 1,
      errorsJson: errors,
      basePricesJson: {},
    });

    return Response.json(
      { updated: 0, errors, pricesAsOf: today, baseSpot: {}, durationMs: Date.now() - t0 },
      { status: 500 },
    );
  }

  // 3. Load metals (includes manual-override columns)
  const metals = await db.select().from(metalsTable);

  // 4. Compute and upsert prices
  let successCount = 0;

  for (const metal of metals) {
    // Manual override: if pin is still active, leave the existing price untouched
    if (metal.manualOverrideUntil && metal.manualOverrideUntil >= today) {
      continue;
    }

    const formula = FORMULAS[metal.slug];
    if (!formula) {
      errors.push(`No formula for slug: ${metal.slug}`);
      continue;
    }

    const price = computePrice(formula, baseSpot, metal.unit);
    if (price == null) {
      errors.push(`Missing spot data for: ${metal.slug}`);
      continue;
    }

    const source = formula.type === "fixed" ? "fixed" : "spot-derived";

    try {
      await db
        .insert(metalPricesTable)
        .values({
          metalSlug: metal.slug,
          regionCode: "US",
          price: String(price),
          source,
          recordedOn: today,
        })
        .onConflictDoUpdate({
          target: [
            metalPricesTable.metalSlug,
            metalPricesTable.regionCode,
            metalPricesTable.recordedOn,
            metalPricesTable.source,
          ],
          set: { price: String(price) },
        });

      successCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Upsert failed for ${metal.slug}: ${msg}`);
    }
  }

  // 5. Audit row
  await db.insert(priceUpdatesTable).values({
    source: "cron",
    successCount,
    errorCount: errors.length,
    errorsJson: errors.length ? errors : null,
    basePricesJson: baseSpot,
  });

  return Response.json({
    updated: successCount,
    errors,
    pricesAsOf: today,
    baseSpot,
    durationMs: Date.now() - t0,
  });
}
