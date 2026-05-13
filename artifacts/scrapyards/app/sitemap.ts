import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { statesTable, citiesTable, yardsTable, metalsTable, metalCategoriesTable, itemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const BASE = "https://scrapyards.io";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [states, cities, yards, metals, categories, items] = await Promise.all([
    db.select().from(statesTable),
    db.select().from(citiesTable),
    db.select().from(yardsTable).where(eq(yardsTable.status, "active")),
    db.select().from(metalsTable),
    db.select().from(metalCategoriesTable),
    db.select({ slug: itemsTable.slug }).from(itemsTable),
  ]);

  const stateMap = Object.fromEntries(states.map((s) => [s.code, s.slug]));
  const cityMap = Object.fromEntries(cities.map((c) => [c.id, c.slug]));

  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/scrap-yards/`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/scrap-metal-prices/`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/what-is-it-worth/`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/about/`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/contact/`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/privacy/`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terms/`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  for (const it of items) {
    entries.push({
      url: `${BASE}/what-is-it-worth/${it.slug}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const s of states) {
    entries.push({ url: `${BASE}/scrap-yards/${s.slug}/`, lastModified: now, changeFrequency: "weekly", priority: 0.7 });
  }
  const yardCountByCity = new Map<typeof yards[number]["cityId"], number>();
  for (const y of yards) {
    yardCountByCity.set(y.cityId, (yardCountByCity.get(y.cityId) ?? 0) + 1);
  }
  for (const c of cities) {
    const stateSlug = stateMap[c.stateCode];
    if (!stateSlug) continue;
    if ((yardCountByCity.get(c.id) ?? 0) <= 1) continue;
    entries.push({ url: `${BASE}/scrap-yards/${stateSlug}/${c.slug}/`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const y of yards) {
    const stateSlug = stateMap[y.stateCode];
    const citySlug = cityMap[y.cityId];
    if (stateSlug && citySlug) {
      entries.push({ url: `${BASE}/scrap-yards/${stateSlug}/${citySlug}/${y.slug}/`, lastModified: now, changeFrequency: "monthly", priority: 0.7 });
    }
  }

  for (const cat of categories) {
    entries.push({ url: `${BASE}/scrap-metal-prices/${cat.slug}/`, lastModified: now, changeFrequency: "daily", priority: 0.8 });
    for (const s of states) {
      entries.push({ url: `${BASE}/scrap-metal-prices/${cat.slug}/${s.slug}/`, lastModified: now, changeFrequency: "weekly", priority: 0.5 });
    }
  }

  for (const m of metals) {
    entries.push({ url: `${BASE}/scrap-metal-prices/${m.slug}/`, lastModified: now, changeFrequency: "daily", priority: 0.7 });
    for (const s of states) {
      entries.push({ url: `${BASE}/scrap-metal-prices/${m.slug}/${s.slug}/`, lastModified: now, changeFrequency: "weekly", priority: 0.5 });
    }
  }

  return entries;
}
