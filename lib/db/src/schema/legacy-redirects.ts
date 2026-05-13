import { pgTable, varchar, smallint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const legacyRedirectsTable = pgTable("legacy_redirects", {
  sourcePath: varchar("source_path", { length: 500 }).primaryKey(),
  targetPath: varchar("target_path", { length: 500 }).notNull(),
  statusCode: smallint("status_code").default(301),
});

export const insertLegacyRedirectSchema = createInsertSchema(legacyRedirectsTable);
export type InsertLegacyRedirect = z.infer<typeof insertLegacyRedirectSchema>;
export type LegacyRedirect = typeof legacyRedirectsTable.$inferSelect;
