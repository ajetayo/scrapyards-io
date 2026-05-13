import { pgTable, serial, char, varchar, integer, numeric, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { statesTable } from "./states";

export const citiesTable = pgTable("cities", {
  id: serial("id").primaryKey(),
  stateCode: char("state_code", { length: 2 }).notNull().references(() => statesTable.code),
  slug: varchar("slug", { length: 80 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  population: integer("population"),
  lat: numeric("lat", { precision: 9, scale: 6 }),
  lng: numeric("lng", { precision: 9, scale: 6 }),
  descriptionMd: text("description_md"),
  descriptionGeneratedAt: timestamp("description_generated_at", { withTimezone: true }),
}, (t) => [
  index("cities_state_idx").on(t.stateCode),
  unique("cities_state_slug_unique").on(t.stateCode, t.slug),
]);

export const insertCitySchema = createInsertSchema(citiesTable).omit({ id: true });
export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof citiesTable.$inferSelect;
