"use client";

import { useEffect, useRef, useState } from "react";

export type CityMapYard = {
  id: number;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  address?: string | null;
};

type Props = {
  yards: CityMapYard[];
  stateSlug: string;
  citySlug: string;
};

export default function CityMap({ yards, stateSlug, citySlug }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldInit, setShouldInit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShouldInit(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldInit || !containerRef.current || yards.length === 0) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError("Map unavailable");
      return;
    }

    let map: import("mapbox-gl").Map | null = null;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("mapbox-gl");
        const mapboxgl = mod.default;
        if (cancelled || !containerRef.current) return;
        mapboxgl.accessToken = token;

        const lngs = yards.map((y) => y.lng);
        const lats = yards.map((y) => y.lat);
        const bounds = new mapboxgl.LngLatBounds(
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        );

        map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          bounds,
          fitBoundsOptions: { padding: 50, maxZoom: 14 },
          attributionControl: true,
          scrollZoom: false,
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        for (const y of yards) {
          const href = `/scrap-yards/${encodeURIComponent(stateSlug)}/${encodeURIComponent(citySlug)}/${encodeURIComponent(y.slug)}/`;
          const popupHtml = `<strong>${escapeHtml(y.name)}</strong>${
            y.address ? `<br/><span style="font-size:0.85em;color:#555">${escapeHtml(y.address)}</span>` : ""
          }<br/><a href="${escapeHtml(href)}" style="color:#e85d2e;font-weight:600;font-size:0.9em">View yard →</a>`;
          new mapboxgl.Marker({ color: "#e85d2e" })
            .setLngLat([y.lng, y.lat])
            .setPopup(new mapboxgl.Popup({ offset: 22 }).setHTML(popupHtml))
            .addTo(map);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "map load failed");
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [shouldInit, yards, stateSlug, citySlug]);

  if (yards.length === 0) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        ref={containerRef}
        aria-label="Map of scrap yards in this city"
        style={{
          width: "100%",
          height: "clamp(300px, 45vw, 400px)",
          borderRadius: 8,
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          overflow: "hidden",
        }}
      />
      {error && (
        <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
          Map requires JavaScript and a connection.
        </p>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
