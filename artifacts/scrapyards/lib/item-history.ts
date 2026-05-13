// Server-only: load price history for a metal and project to item value.
import { db } from "@/lib/db";
import { metalPricesTable } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  YARD_PAYOUT_LOW,
  YARD_PAYOUT_HIGH,
  type CalcItem,
  type CalcMetal,
} from "@/lib/calculator-core";

export type PricePoint = { date: string; price: number };

export async function loadMetalHistory(
  metalSlug: string,
  days: number,
  region: string = "US",
): Promise<PricePoint[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      date: metalPricesTable.recordedOn,
      price: metalPricesTable.price,
    })
    .from(metalPricesTable)
    .where(
      and(
        eq(metalPricesTable.metalSlug, metalSlug),
        eq(metalPricesTable.regionCode, region),
        gte(metalPricesTable.recordedOn, cutoffStr),
      ),
    )
    .orderBy(metalPricesTable.recordedOn);

  return rows.map((r) => ({ date: r.date, price: Number(r.price) }));
}

/** Pick the component metal with the highest recovered fraction. */
export function dominantMetalSlug(item: CalcItem): string | null {
  if (!item.components || item.components.length === 0) return null;
  let best = item.components[0];
  for (const c of item.components) {
    if (c.pct > best.pct) best = c;
  }
  return best.metal_slug;
}

/** Project an item's value range over time, given history of its component prices.
 *  Falls back to a single-metal projection (the dominant metal) since
 *  cross-metal time-aligned series add cost for marginal accuracy. */
export function projectItemValueSeries(
  item: CalcItem,
  metals: CalcMetal[],
  metalSlug: string,
  series: PricePoint[],
): Array<{ date: string; low: number; high: number }> {
  const metal = metals.find((m) => m.slug === metalSlug);
  if (!metal) return [];
  const comp = item.components.find((c) => c.metal_slug === metalSlug);
  if (!comp) return [];

  return series.map((p) => {
    let perUnit = p.price;
    let lbOrUnits: number;
    if (metal.unit === "each" || metal.unit === "oz") {
      lbOrUnits = comp.pct;
    } else if (item.avgWeightLb == null) {
      return { date: p.date, low: 0, high: 0 };
    } else {
      lbOrUnits = item.avgWeightLb * comp.pct;
      if (metal.unit === "ton") perUnit = p.price / 2000;
    }
    return {
      date: p.date,
      low: lbOrUnits * perUnit * YARD_PAYOUT_LOW,
      high: lbOrUnits * perUnit * YARD_PAYOUT_HIGH,
    };
  });
}

export function summarizeRange(series: Array<{ low: number; high: number }>): {
  min: number;
  max: number;
} | null {
  if (series.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const p of series) {
    if (p.low < min) min = p.low;
    if (p.high > max) max = p.high;
  }
  if (!isFinite(min) || !isFinite(max)) return null;
  return { min, max };
}
