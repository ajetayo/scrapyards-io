import type { Yard } from "@workspace/db";

export function metalLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function hoursToSchema(hours: unknown) {
  if (!hours || typeof hours !== "object") return [];
  const days: Record<string, string> = {
    mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
    fri: "Friday", sat: "Saturday", sun: "Sunday",
  };
  return Object.entries(hours as Record<string, { open: string; close: string }>)
    .filter(([, v]) => v?.open && v?.close)
    .map(([day, { open, close }]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days[day] || day,
      opens: open,
      closes: close,
    }));
}

export function isOpenNow(hours: unknown): boolean {
  if (!hours || typeof hours !== "object") return false;
  const now = new Date();
  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const day = dayKeys[now.getDay()];
  const h = (hours as Record<string, { open: string; close: string }>)[day];
  if (!h?.open || !h?.close) return false;
  const [oh, om] = h.open.split(":").map(Number);
  const [ch, cm] = h.close.split(":").map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= oh * 60 + om && nowMins < ch * 60 + cm;
}

export function localBusinessJsonLd(
  yard: Yard & { stateName?: string; stateSlug?: string; cityName?: string; citySlug?: string },
) {
  return {
    "@context": "https://schema.org",
    "@type": "RecyclingCenter",
    name: yard.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: yard.address,
      addressLocality: yard.cityName,
      addressRegion: yard.stateCode,
      postalCode: yard.zip,
      addressCountry: "US",
    },
    geo: yard.lat && yard.lng
      ? { "@type": "GeoCoordinates", latitude: yard.lat, longitude: yard.lng }
      : undefined,
    telephone: yard.phone,
    url: yard.stateSlug && yard.citySlug
      ? `https://scrapyards.io/scrap-yards/${yard.stateSlug}/${yard.citySlug}/${yard.slug}/`
      : undefined,
    openingHoursSpecification: hoursToSchema(yard.hours),
    aggregateRating:
      yard.ratingCount && yard.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: yard.ratingAvg,
            reviewCount: yard.ratingCount,
          }
        : undefined,
    knowsAbout: (yard.accepted ?? []).map(metalLabel),
  };
}

export function spotPriceJsonLd(prices: Array<{ metalName: string; price: string; unit: string }>) {
  return prices.map((p) => ({
    "@context": "https://schema.org",
    "@type": "UnitPriceSpecification",
    name: `${p.metalName} Scrap Price`,
    price: p.price,
    priceCurrency: "USD",
    unitText: p.unit,
  }));
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatPct(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}
