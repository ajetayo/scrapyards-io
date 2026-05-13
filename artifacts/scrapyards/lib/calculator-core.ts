// Pure calculation core. NO DB imports — safe for client bundles.

import type { ItemComponent } from "@workspace/db";

export const YARD_PAYOUT_LOW = 0.5;
export const YARD_PAYOUT_HIGH = 0.7;

export type CalcMetal = {
  slug: string;
  name: string;
  category: string;
  unit: "lb" | "ton" | "each" | "oz";
};

export type CalcItem = {
  slug: string;
  name: string;
  category: string;
  unit: "each" | "ft" | "lb";
  avgWeightLb: number | null;
  components: ItemComponent[];
  isFeatured: boolean;
};

export type PriceMap = Record<string, number>;

export type CalcContext = {
  items: CalcItem[];
  metals: CalcMetal[];
  prices: PriceMap;
  regionUsed: "national" | string;
  pricesAsOf: string | null;
};

export type CartLine = { slug: string; quantity: number };

export type ComponentBreakdown = {
  metal_slug: string;
  metal_name: string;
  metal_category: string;
  lb_or_units: number;
  unit_price_low: number;
  unit_price_high: number;
  value_low: number;
  value_high: number;
  price_unit: "lb" | "each" | "oz" | "ton";
};

export type ItemResult = {
  slug: string;
  name: string;
  unit: "each" | "ft" | "lb";
  quantity: number;
  total_weight_lb: number | null;
  components: ComponentBreakdown[];
  item_value_low: number;
  item_value_high: number;
  notes: string[];
};

export type CalcResult = {
  items: ItemResult[];
  total_value_low: number;
  total_value_high: number;
  region_used: "national" | string;
  prices_as_of: string | null;
  metals_needed: string[];
  warnings: string[];
};

export function computeCalc(cart: CartLine[], ctx: CalcContext): CalcResult {
  const itemsBySlug = new Map(ctx.items.map((i) => [i.slug, i]));
  const metalsBySlug = new Map(ctx.metals.map((m) => [m.slug, m]));
  const warnings: string[] = [];
  const metalsNeeded = new Set<string>();
  const out: ItemResult[] = [];
  let totalLow = 0;
  let totalHigh = 0;

  for (const line of cart) {
    const item = itemsBySlug.get(line.slug);
    if (!item) {
      warnings.push(`Unknown item "${line.slug}" was ignored.`);
      continue;
    }
    const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));

    const firstCompMetal =
      item.components.length === 1 ? metalsBySlug.get(item.components[0].metal_slug) : undefined;
    const isUnitPriced =
      item.avgWeightLb == null &&
      item.components.length === 1 &&
      (firstCompMetal?.unit === "each" || firstCompMetal?.unit === "oz");

    const totalWeight = item.avgWeightLb != null ? item.avgWeightLb * qty : null;
    const breakdowns: ComponentBreakdown[] = [];
    const itemNotes: string[] = [];
    let itemLow = 0;
    let itemHigh = 0;

    for (const comp of item.components) {
      const metal = metalsBySlug.get(comp.metal_slug);
      if (!metal) {
        itemNotes.push(`Unknown metal "${comp.metal_slug}" skipped`);
        continue;
      }
      metalsNeeded.add(metal.category);

      const rawPrice = ctx.prices[metal.slug];
      if (rawPrice == null) {
        itemNotes.push(`No current price for ${metal.name}`);
        continue;
      }

      let perUnitPrice = rawPrice;
      let priceUnit: ComponentBreakdown["price_unit"] = "lb";
      let lbOrUnits: number;

      if (metal.unit === "each" || metal.unit === "oz") {
        lbOrUnits = qty * comp.pct;
        priceUnit = metal.unit === "each" ? "each" : "oz";
      } else {
        if (totalWeight == null) {
          itemNotes.push(`${item.name} has no weight set; skipped ${metal.name}`);
          continue;
        }
        lbOrUnits = totalWeight * comp.pct;
        if (metal.unit === "ton") {
          perUnitPrice = rawPrice / 2000;
          priceUnit = "lb";
        } else {
          priceUnit = "lb";
        }
      }

      const unitLow = perUnitPrice * YARD_PAYOUT_LOW;
      const unitHigh = perUnitPrice * YARD_PAYOUT_HIGH;
      const valueLow = lbOrUnits * unitLow;
      const valueHigh = lbOrUnits * unitHigh;
      itemLow += valueLow;
      itemHigh += valueHigh;

      breakdowns.push({
        metal_slug: metal.slug,
        metal_name: metal.name,
        metal_category: metal.category,
        lb_or_units: lbOrUnits,
        unit_price_low: unitLow,
        unit_price_high: unitHigh,
        value_low: valueLow,
        value_high: valueHigh,
        price_unit: priceUnit,
      });
    }

    if (
      item.slug === "refrigerator" ||
      item.slug === "window-ac-unit" ||
      item.slug === "central-ac-condenser"
    ) {
      itemNotes.push(
        "Refrigerant must be removed by an EPA-certified technician before scrapping.",
      );
    }
    if (item.slug === "catalytic-converter") {
      itemNotes.push(
        "Cat prices vary widely by PGM (platinum/palladium/rhodium) content. Estimate is a rough national average.",
      );
    }
    if (item.slug === "car-battery") {
      itemNotes.push("Battery price is per-unit and reflects current core/lead value.");
    }
    if (isUnitPriced) {
      itemNotes.push("Unit-priced item — value scales by quantity, not weight.");
    }
    if (item.avgWeightLb == null && !isUnitPriced) {
      itemNotes.push(
        "Weight not estimated for this item; pick a specific gauge/size for a better estimate.",
      );
    }

    out.push({
      slug: item.slug,
      name: item.name,
      unit: item.unit,
      quantity: qty,
      total_weight_lb: totalWeight,
      components: breakdowns,
      item_value_low: itemLow,
      item_value_high: itemHigh,
      notes: itemNotes,
    });

    totalLow += itemLow;
    totalHigh += itemHigh;
  }

  if (out.some((i) => i.total_weight_lb == null && i.components.length > 0)) {
    warnings.push("Some items are priced per unit, not per pound.");
  }

  return {
    items: out,
    total_value_low: totalLow,
    total_value_high: totalHigh,
    region_used: ctx.regionUsed,
    prices_as_of: ctx.pricesAsOf,
    metals_needed: Array.from(metalsNeeded).sort(),
    warnings,
  };
}

export function encodeCart(cart: CartLine[]): string {
  return cart
    .filter((l) => l.slug && l.quantity > 0)
    .map((l) => `${l.slug}:${l.quantity}`)
    .join(",");
}

export function decodeCart(s: string | null | undefined): CartLine[] {
  if (!s) return [];
  return s
    .split(",")
    .map((part) => {
      const [slug, q] = part.split(":");
      const quantity = Math.max(1, Math.floor(Number(q) || 1));
      return slug ? { slug: slug.trim(), quantity } : null;
    })
    .filter((x): x is CartLine => x !== null);
}

export function formatMoney(n: number): string {
  if (!isFinite(n)) return "$0";
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function formatRange(low: number, high: number): string {
  return `${formatMoney(low)} – ${formatMoney(high)}`;
}

// Locale-stable date formatter for SSR/CSR consistency.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatPriceDate(iso: string | null | undefined): string {
  if (!iso) return "";
  // iso is "YYYY-MM-DD" from drizzle date column — parse explicitly to avoid TZ shifts.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const year = m[1];
  const month = MONTHS[parseInt(m[2], 10) - 1];
  const day = String(parseInt(m[3], 10));
  return `${month} ${day}, ${year}`;
}
