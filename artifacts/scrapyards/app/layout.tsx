import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { CookieBanner } from "./_components/CookieBanner";
import { Analytics } from "./_components/Analytics";

export const metadata: Metadata = {
  title: { default: "Scrapyards.io — Find Scrap Yards & Prices Near You", template: "%s | Scrapyards.io" },
  description: "Find scrap yards near you with current scrap metal prices, hours, and directions. Copper, aluminum, steel, and more.",
};

const BOT_RE = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|applebot|facebookexternalhit|twitterbot|linkedinbot/i;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const ua = hdrs.get("user-agent") ?? "";
  const isBot = BOT_RE.test(ua);

  return (
    <html lang="en">
      <body>
        <header style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0" }}>
          <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <a href="/" style={{ fontWeight: 800, fontSize: "1.3rem", color: "var(--color-accent)", textDecoration: "none" }}>
              Scrapyards<span style={{ color: "var(--color-text)" }}>.io</span>
            </a>
            <nav style={{ display: "flex", gap: "1.5rem", fontSize: "0.9rem" }}>
              <a href="/scrap-yards/">Find a Yard</a>
              <a href="/scrap-metal-prices/">Scrap Prices</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer style={{ borderTop: "1px solid var(--color-border)", marginTop: "3rem", padding: "2rem 0", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
          <div className="container">
            <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <a href="/about/">About</a>
              <a href="/contact/">Contact</a>
              <a href="/privacy/">Privacy</a>
              <a href="/terms/">Terms</a>
            </nav>
            <p>© {new Date().getFullYear()} Scrapyards.io — Find scrap yards and current metal prices across the US.</p>
            <p style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
              ZIP code coordinates:{" "}
              <a href="https://www.geonames.org/" rel="noopener noreferrer" target="_blank">GeoNames</a>{" "}
              (<a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer" target="_blank">CC BY 4.0</a>).
            </p>
          </div>
        </footer>
        {!isBot && <Suspense fallback={null}><CookieBanner /></Suspense>}
        <Analytics />
      </body>
    </html>
  );
}
