import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/services/united-states/:state/:city/:cat/:slug/",
        destination: "/scrap-yards/:state/:city/:slug/",
        permanent: true,
      },
      {
        source: "/services/united-states/:state/:city/",
        destination: "/scrap-yards/:state/:city/",
        permanent: true,
      },
      {
        source: "/services/united-states/:state/",
        destination: "/scrap-yards/:state/",
        permanent: true,
      },
      {
        source: "/services/category/:cat/united-states/:state/:city/",
        destination: "/scrap-yards/:state/:city/",
        permanent: true,
      },
      {
        source: "/services/category/:cat/united-states/:state/",
        destination: "/scrap-yards/:state/",
        permanent: true,
      },
      // /blog/metal/:metal/ → /scrap-metal-prices/:metal/ removed —
      // unconditional rewrite produced 404s for unknown grades (e.g. kovar,
      // 2-prepared). DB-backed legacy_redirects handles validated cases;
      // middleware fallback (see middleware.ts) catches the rest by
      // redirecting unmatched /blog/metal/* paths to the hub.
      {
        source: "/scrap-prices/",
        destination: "/scrap-metal-prices/",
        permanent: true,
      },
      {
        source: "/scrap-prices/:metal/",
        destination: "/scrap-metal-prices/:metal/",
        permanent: true,
      },
      {
        source: "/scrap-prices/:metal/:state/",
        destination: "/scrap-metal-prices/:metal/:state/",
        permanent: true,
      },
    ];
  },

  serverExternalPackages: ["pg"],
  allowedDevOrigins: ["*.replit.dev", "*.repl.co", "*.janeway.replit.dev", "*.replit.app"],
  trailingSlash: true,
};

export default nextConfig;
