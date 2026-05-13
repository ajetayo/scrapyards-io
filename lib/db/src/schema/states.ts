import { pgTable, char, varchar, numeric, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const statesTable = pgTable("states", {
  code: char("code", { length: 2 }).primaryKey(),
  slug: varchar("slug", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 60 }).notNull(),
  fips: char("fips", { length: 2 }).notNull(),
  lat: numeric("lat", { precision: 9, scale: 6 }),
  lng: numeric("lng", { precision: 9, scale: 6 }),
  introMd: text("intro_md"),
  lawsMd: text("laws_md"),
  industriesText: text("industries_text"),
});

export const insertStateSchema = createInsertSchema(statesTable);
export type InsertState = z.infer<typeof insertStateSchema>;
export type State = typeof statesTable.$inferSelect;
