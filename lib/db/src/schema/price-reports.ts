import { pgTable, bigserial, integer, varchar, numeric, text, boolean, date, timestamp, inet, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { yardsTable } from "./yards";
import { metalsTable } from "./metals";

export const priceReportsTable = pgTable("price_reports", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  yardId: integer("yard_id").references(() => yardsTable.id),
  metalSlug: varchar("metal_slug", { length: 60 }).notNull().references(() => metalsTable.slug),
  price: numeric("price", { precision: 10, scale: 4 }).notNull(),
  reporterEmail: varchar("reporter_email", { length: 120 }),
  reporterIp: inet("reporter_ip"),
  notes: text("notes"),
  isApproved: boolean("is_approved").default(false),
  reportedOn: date("reported_on").notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("price_reports_yard_idx").on(t.yardId, t.metalSlug, t.reportedOn),
]);

export const insertPriceReportSchema = createInsertSchema(priceReportsTable).omit({ id: true, createdAt: true });
export type InsertPriceReport = z.infer<typeof insertPriceReportSchema>;
export type PriceReport = typeof priceReportsTable.$inferSelect;
