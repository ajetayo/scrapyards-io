import { pgTable, varchar, text, numeric, integer, date, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const metalsTable = pgTable("metals", {
  slug: varchar("slug", { length: 60 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  unit: varchar("unit", { length: 10 }).notNull(),
  descriptionMd: text("description_md"),
  prepTipsMd: text("prep_tips_md"),
  spotFactor: numeric("spot_factor", { precision: 4, scale: 3 }),
  spotMetal: varchar("spot_metal", { length: 20 }),
  displayOrder: integer("display_order").default(100),
  manualOverrideUntil: date("manual_override_until"),
  manualOverridePrice: numeric("manual_override_price", { precision: 10, scale: 4 }),
  marketDriversMd: text("market_drivers_md"),
  gradeDifferencesMd: text("grade_differences_md"),
  faqJson: jsonb("faq_json").$type<Array<{ q: string; a: string }>>(),
  contentGeneratedAt: timestamp("content_generated_at", { withTimezone: true }),
});

export const insertMetalSchema = createInsertSchema(metalsTable);
export type InsertMetal = z.infer<typeof insertMetalSchema>;
export type Metal = typeof metalsTable.$inferSelect;
