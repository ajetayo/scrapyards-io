import { pgTable, varchar, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const metalCategoriesTable = pgTable("metal_categories", {
  slug: varchar("slug", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  descriptionMd: text("description_md"),
  displayOrder: integer("display_order").default(100),
});

export const insertMetalCategorySchema = createInsertSchema(metalCategoriesTable);
export type InsertMetalCategory = z.infer<typeof insertMetalCategorySchema>;
export type MetalCategory = typeof metalCategoriesTable.$inferSelect;
