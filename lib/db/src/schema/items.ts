import { pgTable, varchar, text, numeric, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const itemComponentSchema = z.object({
  metal_slug: z.string().min(1).max(60),
  pct: z.number().min(0).max(1),
  notes: z.string().optional(),
});
export type ItemComponent = z.infer<typeof itemComponentSchema>;

export const itemsTable = pgTable("items", {
  slug: varchar("slug", { length: 60 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  unit: varchar("unit", { length: 10 }).notNull(),
  avgWeightLb: numeric("avg_weight_lb", { precision: 10, scale: 4 }),
  components: jsonb("components").$type<ItemComponent[]>().notNull(),
  descriptionMd: text("description_md"),
  prepTipsMd: text("prep_tips_md"),
  displayOrder: integer("display_order").default(100),
  isFeatured: boolean("is_featured").default(false),
});

export const insertItemSchema = createInsertSchema(itemsTable);
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof itemsTable.$inferSelect;
