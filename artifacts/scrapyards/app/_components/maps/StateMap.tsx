"use client";

import { useEffect, useRef, useState } from "react";

export type StateMapYard = {
  id: number;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  citySlug: string;
};

type Props = {
  yards: StateMapYard[];
  stateSlug: string;
  centerLat: number;
  centerLng: number;
};

export default function StateMap({ yards, stateSlug, centerLat, centerLng }: Props) {
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
          center: [centerLng, centerLat],
          zoom: 5,
          attributionControl: true,
          scrollZoom: false,
        });

        const m = map;
        m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        m.on("load", () => {
          if (cancelled) return;
          m.fitBounds(bounds, { padding: 50, maxZoom: 11, duration: 0 });

          const features = yards.map((y) => ({
            type: "Feature" as const,
            properties: {
              id: y.id,
              name: y.name,
              slug: y.slug,
              citySlug: y.citySlug,
            },
            geometry: { type: "Point" as const, coordinates: [y.lng, y.lat] },
          }));

          m.addSource("yards", {
            type: "geojson",
            data: { type: "FeatureCollection", features },
            cluster: true,
            clusterMaxZoom: 12,
            clusterRadius: 50,
          });

          m.addLayer({
            id: "clusters",
            type: "circle",
            source: "yards",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": [
                "step", ["get", "point_count"],
                "#f7b29a", 10, "#ed8a64", 30, "#e85d2e",
              ],
              "circle-radius": [
                "step", ["get", "point_count"],
                16, 10, 22, 30, 28,
              ],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            },
          });

          m.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "yards",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
              "text-size": 13,
            },
            paint: { "text-color": "#fff" },
          });

          m.addLayer({
            id: "unclustered",
            type: "circle",
            source: "yards",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": "#e85d2e",
              "circle-radius": 7,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            },
          });

          m.on("click", "clusters", (e) => {
            const feats = m.queryRenderedFeatures(e.point, { layers: ["clusters"] });
            const clusterId = feats[0]?.properties?.cluster_id;
            const src = m.getSource("yards") as import("mapbox-gl").GeoJSONSource;
            if (clusterId == null) return;
            src.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err || zoom == null) return;
              const geom = feats[0].geometry;
              if (geom.type !== "Point") return;
              m.easeTo({ center: geom.coordinates as [number, number], zoom });
            });
          });

          m.on("click", "unclustered", (e) => {
            const f = e.features?.[0];
            if (!f || f.geometry.type !== "Point") return;
            const props = f.properties as { name: string; slug: string; citySlug: string };
            const [lng, lat] = f.geometry.coordinates as [number, number];
            const href = `/scrap-yards/${encodeURIComponent(stateSlug)}/${encodeURIComponent(props.citySlug)}/${encodeURIComponent(props.slug)}/`;
            new mapboxgl.Popup({ offset: 12 })
              .setLngLat([lng, lat])
              .setHTML(
                `<strong>${escapeHtml(props.name)}</strong><br/><a href="${escapeHtml(href)}" style="color:#e85d2e;font-weight:600;font-size:0.9em">View yard →</a>`,
              )
              .addTo(m);
          });

          m.on("mouseenter", "clusters", () => { m.getCanvas().style.cursor = "pointer"; });
          m.on("mouseleave", "clusters", () => { m.getCanvas().style.cursor = ""; });
          m.on("mouseenter", "unclustered", () => { m.getCanvas().style.cursor = "pointer"; });
          m.on("mouseleave", "unclustered", () => { m.getCanvas().style.cursor = ""; });
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "map load failed");
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [shouldInit, yards, stateSlug, centerLat, centerLng]);

  if (yards.length === 0) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        ref={containerRef}
        aria-label="Map of scrap yards in this state"
        style={{
          width: "100%",
          height: "clamp(360px, 55vw, 500px)",
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
