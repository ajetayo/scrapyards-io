// Metals seed (D2 = Option A: 22-row canonical catalog, mirrors
// scripts/src/seed-scrapyards.ts). Source of truth — do not edit lightly.
export interface MetalRow {
  slug: string;
  name: string;
  category: string;
  unit: string;
  spotFactor: string | null;
  spotMetal: string | null;
  displayOrder: number;
}

export const METALS: MetalRow[] = [
  { slug: "bare-bright-copper", name: "Bare Bright Copper", category: "copper", unit: "lb", spotFactor: "0.950", spotMetal: "copper", displayOrder: 1 },
  { slug: "copper-1", name: "#1 Copper", category: "copper", unit: "lb", spotFactor: "0.880", spotMetal: "copper", displayOrder: 2 },
  { slug: "copper-2", name: "#2 Copper", category: "copper", unit: "lb", spotFactor: "0.780", spotMetal: "copper", displayOrder: 3 },
  { slug: "insulated-copper-wire", name: "Insulated Copper Wire", category: "copper", unit: "lb", spotFactor: "0.350", spotMetal: "copper", displayOrder: 4 },
  { slug: "aluminum-mixed", name: "Aluminum (Mixed)", category: "aluminum", unit: "lb", spotFactor: "0.400", spotMetal: "aluminum", displayOrder: 10 },
  { slug: "aluminum-cans", name: "Aluminum Cans", category: "aluminum", unit: "lb", spotFactor: "0.550", spotMetal: "aluminum", displayOrder: 11 },
  { slug: "aluminum-extrusion", name: "Aluminum Extrusion", category: "aluminum", unit: "lb", spotFactor: "0.500", spotMetal: "aluminum", displayOrder: 12 },
  { slug: "steel-heavy-melt", name: "Steel (Heavy Melt)", category: "steel", unit: "ton", spotFactor: "0.600", spotMetal: "steel", displayOrder: 20 },
  { slug: "light-iron", name: "Light Iron / Sheet", category: "steel", unit: "ton", spotFactor: "0.450", spotMetal: "steel", displayOrder: 21 },
  { slug: "cast-iron", name: "Cast Iron", category: "steel", unit: "lb", spotFactor: "0.020", spotMetal: "steel", displayOrder: 22 },
  { slug: "stainless-steel", name: "Stainless Steel (304)", category: "steel", unit: "lb", spotFactor: "0.350", spotMetal: "nickel", displayOrder: 23 },
  { slug: "brass-yellow", name: "Yellow Brass", category: "brass", unit: "lb", spotFactor: "0.700", spotMetal: "copper", displayOrder: 30 },
  { slug: "brass-red", name: "Red Brass", category: "brass", unit: "lb", spotFactor: "0.780", spotMetal: "copper", displayOrder: 31 },
  { slug: "lead-soft", name: "Lead (Soft)", category: "lead", unit: "lb", spotFactor: "0.350", spotMetal: "lead", displayOrder: 40 },
  { slug: "lead-wheel-weights", name: "Lead Wheel Weights", category: "lead", unit: "lb", spotFactor: "0.250", spotMetal: "lead", displayOrder: 41 },
  { slug: "zinc-die-cast", name: "Zinc Die Cast", category: "zinc", unit: "lb", spotFactor: "0.380", spotMetal: "zinc", displayOrder: 50 },
  { slug: "low-grade-board", name: "Low-Grade Circuit Board", category: "electronics", unit: "lb", spotFactor: null, spotMetal: null, displayOrder: 60 },
  { slug: "high-grade-board", name: "High-Grade Circuit Board", category: "electronics", unit: "lb", spotFactor: null, spotMetal: null, displayOrder: 61 },
  { slug: "silver", name: "Silver (.999)", category: "precious-metals", unit: "oz", spotFactor: "0.950", spotMetal: "silver", displayOrder: 70 },
  { slug: "gold", name: "Gold (.999)", category: "precious-metals", unit: "oz", spotFactor: "0.950", spotMetal: "gold", displayOrder: 71 },
  { slug: "car-battery", name: "Car Battery", category: "auto-parts", unit: "each", spotFactor: null, spotMetal: null, displayOrder: 80 },
  { slug: "catalytic-converter", name: "Catalytic Converter", category: "auto-parts", unit: "each", spotFactor: null, spotMetal: null, displayOrder: 81 },
];
