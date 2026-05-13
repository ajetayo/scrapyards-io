import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { primaryKey, index } from "drizzle-orm/pg-core";
import { metalsTable } from "./metals";
import { statesTable } from "./states";

export const metalStateContentTable = pgTable(
  "metal_state_content",
  {
    metalSlug: varchar("metal_slug", { length: 60 })
      .notNull()
      .references(() => metalsTable.slug, { onDelete: "cascade" }),
    stateSlug: varchar("state_slug", { length: 40 })
      .notNull()
      .references(() => statesTable.slug, { onDelete: "cascade" }),
    marketContextMd: text("market_context_md").notNull(),
    contentGeneratedAt: timestamp("content_generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.metalSlug, t.stateSlug] }),
    index("metal_state_content_state_idx").on(t.stateSlug),
  ],
);

export type MetalStateContent = typeof metalStateContentTable.$inferSelect;
export type InsertMetalStateContent = typeof metalStateContentTable.$inferInsert;
