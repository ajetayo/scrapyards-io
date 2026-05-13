import { pgTable, bigserial, varchar, numeric, date, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { metalsTable } from "./metals";

export const metalPricesTable = pgTable("metal_prices", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  metalSlug: varchar("metal_slug", { length: 60 }).notNull().references(() => metalsTable.slug),
  regionCode: varchar("region_code", { length: 10 }).notNull(),
  price: numeric("price", { precision: 10, scale: 4 }).notNull(),
  source: varchar("source", { length: 40 }).notNull(),
  recordedOn: date("recorded_on").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("metal_prices_lookup").on(t.metalSlug, t.regionCode, t.recordedOn),
  unique("metal_prices_unique").on(t.metalSlug, t.regionCode, t.recordedOn, t.source),
]);

export const insertMetalPriceSchema = createInsertSchema(metalPricesTable).omit({ id: true, recordedAt: true });
export type InsertMetalPrice = z.infer<typeof insertMetalPriceSchema>;
export type MetalPrice = typeof metalPricesTable.$inferSelect;
