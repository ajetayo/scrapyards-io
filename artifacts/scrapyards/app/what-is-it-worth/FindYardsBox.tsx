"use client";

import { useState } from "react";
import Link from "next/link";

type Yard = {
  id: number;
  name: string;
  address: string | null;
  zip: string | null;
  phone: string | null;
  distance_mi: number;
  city_name: string;
  url: string;
  accepts_unknown: boolean;
  accepts_subset: string[];
};

type FindYardsResponse = {
  yards: Yard[];
  needed_categories: string[];
  radius_miles: number;
  fell_back_to_partial: boolean;
  location_approximate?: boolean;
  resolved_state?: string | null;
  zip?: string | null;
  coord_source?: string;
};

export function FindYardsBox({ itemSlug, itemName }: { itemSlug: string; itemName: string }) {
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FindYardsResponse | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip.trim())) {
      setError("Please enter a 5-digit ZIP.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calculator/find-yards/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ slug: itemSlug, quantity: 1 }],
          zip: zip.trim(),
          radius_miles: 25,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as FindYardsResponse;
      setData(json);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={submit} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <input
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          placeholder="Your ZIP"
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          aria-label="ZIP code"
          style={{
            fontSize: "1rem",
            padding: "0.55rem 0.75rem",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            width: "130px",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={loading || zip.length !== 5}
          className="btn"
          style={{
            background: "var(--color-accent)",
            color: "white",
            border: "none",
            padding: "0.55rem 1rem",
            borderRadius: "var(--radius)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.95rem",
            opacity: loading || zip.length !== 5 ? 0.5 : 1,
          }}
        >
          {loading ? "Searching…" : `Find yards that buy ${itemName}`}
        </button>
      </form>

      {error && <div style={{ color: "var(--color-down)", fontSize: "0.9rem" }}>{error}</div>}

      {data && (
        <div>
          {data.yards.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>
              No yards found within {data.radius_miles} miles of {data.zip}.
            </p>
          ) : (
            <>
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
                {data.location_approximate
                  ? `Distances approximate (ZIP ${data.zip ?? zip} not in our database — using ${data.resolved_state} state center).`
                  : `Distances calculated from ZIP ${data.zip ?? zip}.`}
              </div>
              <div className="wiit-yards-grid">
                {data.yards.slice(0, 6).map((y) => (
                  <Link key={y.id} href={y.url} className="wiit-yard-card">
                    <div className="wiit-yard-name">{y.name}</div>
                    <div className="wiit-yard-meta">
                      {y.address ? `${y.address}, ` : ""}
                      {y.city_name}
                      {y.zip ? ` ${y.zip}` : ""}
                    </div>
                    {y.phone && <div className="wiit-yard-meta">{y.phone}</div>}
                    <div className="wiit-yard-distance">~{y.distance_mi} mi</div>
                    {y.accepts_unknown && (
                      <div className="wiit-yard-warn">
                        Accepted materials list not on file — call ahead to confirm.
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
