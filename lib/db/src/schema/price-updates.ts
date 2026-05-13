import { pgTable, serial, timestamp, varchar, integer, jsonb } from "drizzle-orm/pg-core";

export const priceUpdatesTable = pgTable("price_updates", {
  id: serial("id").primaryKey(),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  source: varchar("source", { length: 20 }).notNull(),
  successCount: integer("success_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorsJson: jsonb("errors_json"),
  basePricesJson: jsonb("base_prices_json"),
});

export type PriceUpdate = typeof priceUpdatesTable.$inferSelect;
