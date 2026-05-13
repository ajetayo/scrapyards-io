"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  lat: number;
  lng: number;
  name: string;
  address?: string | null;
};

export default function YardMap({ lat, lng, name, address }: Props) {
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
    if (!shouldInit || !containerRef.current) return;
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

        const isMobile = typeof window !== "undefined" && window.innerWidth < 700;

        map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [lng, lat],
          zoom: 14,
          attributionControl: true,
          dragPan: !isMobile,
          scrollZoom: false,
          touchZoomRotate: true,
          doubleClickZoom: !isMobile,
        });

        if (!isMobile) {
          map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        }

        const popupHtml = `<strong>${escapeHtml(name)}</strong>${
          address ? `<br/><span style="font-size:0.85em;color:#555">${escapeHtml(address)}</span>` : ""
        }`;

        new mapboxgl.Marker({ color: "#e85d2e" })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml))
          .addTo(map);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "map load failed");
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [shouldInit, lat, lng, name, address]);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        ref={containerRef}
        aria-label={`Map of ${name}`}
        style={{
          width: "100%",
          height: "clamp(250px, 35vw, 300px)",
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
      <div style={{ marginTop: "0.5rem" }}>
        <a
          href={`https://maps.google.com/?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "0.85rem" }}
        >
          Open in Google Maps →
        </a>
      </div>
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
