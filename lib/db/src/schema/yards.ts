import {
  pgTable, serial, varchar, char, integer, numeric, text,
  boolean, jsonb, timestamp, index, unique
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { statesTable } from "./states";
import { citiesTable } from "./cities";

export const yardsTable = pgTable("yards", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  stateCode: char("state_code", { length: 2 }).notNull().references(() => statesTable.code),
  cityId: integer("city_id").notNull().references(() => citiesTable.id),
  address: varchar("address", { length: 255 }),
  zip: varchar("zip", { length: 10 }),
  lat: numeric("lat", { precision: 9, scale: 6 }),
  lng: numeric("lng", { precision: 9, scale: 6 }),
  phone: varchar("phone", { length: 20 }),
  website: varchar("website", { length: 255 }),
  email: varchar("email", { length: 120 }),
  hours: jsonb("hours"),
  accepted: text("accepted").array(),
  services: text("services").array(),
  description: text("description"),
  descriptionGeneratedAt: timestamp("description_generated_at", { withTimezone: true }),
  descriptionFlaggedAt: timestamp("description_flagged_at", { withTimezone: true }),
  descriptionFlagReason: text("description_flag_reason"),
  photoUrls: text("photo_urls").array(),
  ratingAvg: numeric("rating_avg", { precision: 2, scale: 1 }),
  ratingCount: integer("rating_count").default(0),
  isVerified: boolean("is_verified").default(false),
  isPremium: boolean("is_premium").default(false),
  status: varchar("status", { length: 20 }).default("active"),
  legacyUrl: varchar("legacy_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("yards_state_city_idx").on(t.stateCode, t.cityId),
  index("yards_legacy_url_idx").on(t.legacyUrl),
  unique("yards_state_city_slug_unique").on(t.stateCode, t.cityId, t.slug),
]);

export const insertYardSchema = createInsertSchema(yardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertYard = z.infer<typeof insertYardSchema>;
export type Yard = typeof yardsTable.$inferSelect;
