// Category bucketing per mapping spec §B2 / §B3.
export type Bucket = "metal" | "service" | "drop";

export const METAL_TERMS: ReadonlySet<string> = new Set([
  "aluminum", "aluminum-products",
  "copper", "copper-products",
  "brass", "bronze",
  "lead", "iron",
  "metals", "base-metals", "alloys",
  "precious-metals",
]);

export const DROP_TERMS: ReadonlySet<string> = new Set([
  "professional-engineers",
  "construction-engineers",
  "structural-engineers",
]);

// Crosswalk from `gd_placecategory.slug` to `metal_categories.slug` (spec §B3).
// Generic terms ("metals", "base-metals", "alloys") add no metal_categories entry.
export const METAL_TO_CATEGORY: Record<string, string | null> = {
  "aluminum": "aluminum",
  "aluminum-products": "aluminum",
  "copper": "copper",
  "copper-products": "copper",
  "brass": "brass",
  "bronze": "brass",
  "lead": "lead",
  "iron": "steel",
  "precious-metals": "precious-metals",
  "metals": null,
  "base-metals": null,
  "alloys": null,
};

export function bucketize(slug: string): Bucket {
  if (DROP_TERMS.has(slug)) return "drop";
  if (METAL_TERMS.has(slug)) return "metal";
  return "service";
}
