// Server-only DB loaders. Re-exports the pure core for convenience on the server.
import { db } from "@/lib/db";
import {
  itemsTable,
  metalsTable,
  metalPricesTable,
  type ItemComponent,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import type { CalcContext, CalcItem, CalcMetal, PriceMap } from "@/lib/calculator-core";

export * from "@/lib/calculator-core";

export async function loadCalcBase(): Promise<{ items: CalcItem[]; metals: CalcMetal[] }> {
  const [itemRows, metalRows] = await Promise.all([
    db
      .select({
        slug: itemsTable.slug,
        name: itemsTable.name,
        category: itemsTable.category,
        unit: itemsTable.unit,
        avgWeightLb: itemsTable.avgWeightLb,
        components: itemsTable.components,
        isFeatured: itemsTable.isFeatured,
        displayOrder: itemsTable.displayOrder,
      })
      .from(itemsTable)
      .orderBy(itemsTable.displayOrder),
    db
      .select({
        slug: metalsTable.slug,
        name: metalsTable.name,
        category: metalsTable.category,
        unit: metalsTable.unit,
      })
      .from(metalsTable)
      .orderBy(metalsTable.displayOrder),
  ]);

  const items: CalcItem[] = itemRows.map((r) => ({
    slug: r.slug,
    name: r.name,
    category: r.category,
    unit: r.unit as "each" | "ft" | "lb",
    avgWeightLb: r.avgWeightLb == null ? null : Number(r.avgWeightLb),
    components: (r.components ?? []) as ItemComponent[],
    isFeatured: !!r.isFeatured,
  }));

  const metals: CalcMetal[] = metalRows.map((r) => ({
    slug: r.slug,
    name: r.name,
    category: r.category,
    unit: r.unit as CalcMetal["unit"],
  }));

  return { items, metals };
}

export async function loadPricesForRegion(
  regionCode: string,
): Promise<{ prices: PriceMap; regionUsed: "national" | string; pricesAsOf: string | null }> {
  const wanted = regionCode.toUpperCase();
  const fallback = "US";

  const [{ maxDate: regionMax } = { maxDate: null }] = await db
    .select({ maxDate: sql<string | null>`max(recorded_on)` })
    .from(metalPricesTable)
    .where(eq(metalPricesTable.regionCode, wanted));

  const useRegion = regionMax ? wanted : fallback;
  const [{ maxDate: useMax } = { maxDate: null }] =
    useRegion === wanted
      ? [{ maxDate: regionMax }]
      : await db
          .select({ maxDate: sql<string | null>`max(recorded_on)` })
          .from(metalPricesTable)
          .where(eq(metalPricesTable.regionCode, fallback));

  if (!useMax) return { prices: {}, regionUsed: "national", pricesAsOf: null };

  const rows = await db
    .select({ metalSlug: metalPricesTable.metalSlug, price: metalPricesTable.price })
    .from(metalPricesTable)
    .where(and(eq(metalPricesTable.regionCode, useRegion), eq(metalPricesTable.recordedOn, useMax)));

  const prices: PriceMap = {};
  for (const r of rows) prices[r.metalSlug] = Number(r.price);
  return {
    prices,
    regionUsed: useRegion === fallback ? "national" : useRegion,
    pricesAsOf: useMax,
  };
}

export async function loadCalcContext(regionCode: string = "US"): Promise<CalcContext> {
  const [{ items, metals }, priceData] = await Promise.all([
    loadCalcBase(),
    loadPricesForRegion(regionCode),
  ]);
  return { items, metals, ...priceData };
}
