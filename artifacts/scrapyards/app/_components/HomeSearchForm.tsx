"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export type CategoryOption = { slug: string; name: string };

type Props = { categories: CategoryOption[] };

export default function HomeSearchForm({ categories }: Props) {
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [material, setMaterial] = useState("");
  const [radius, setRadius] = useState("25");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleaned = zip.trim().slice(0, 5);
    if (!/^\d{5}$/.test(cleaned)) {
      setError("Please enter a valid 5-digit US ZIP code.");
      return;
    }
    setError(null);
    const params = new URLSearchParams({ zip: cleaned, radius });
    if (material) params.set("material", material);
    router.push(`/search/?${params.toString()}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: "white",
        padding: "0.85rem",
        borderRadius: "var(--radius)",
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        alignItems: "stretch",
        boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        pattern="\d{5}"
        maxLength={5}
        placeholder="Your ZIP"
        aria-label="ZIP code"
        value={zip}
        onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
        style={{
          flex: "1 1 110px",
          minWidth: 0,
          padding: "0.65rem 0.75rem",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          fontSize: "1rem",
          color: "var(--color-text)",
          background: "white",
        }}
        required
      />
      <select
        aria-label="Material"
        value={material}
        onChange={(e) => setMaterial(e.target.value)}
        style={{
          flex: "1 1 160px",
          minWidth: 0,
          padding: "0.65rem 0.5rem",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          fontSize: "1rem",
          color: "var(--color-text)",
          background: "white",
        }}
      >
        <option value="">Any material</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Search radius in miles"
        value={radius}
        onChange={(e) => setRadius(e.target.value)}
        style={{
          flex: "0 1 120px",
          minWidth: 0,
          padding: "0.65rem 0.5rem",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          fontSize: "1rem",
          color: "var(--color-text)",
          background: "white",
        }}
      >
        <option value="10">10 mi</option>
        <option value="25">25 mi</option>
        <option value="50">50 mi</option>
        <option value="100">100 mi</option>
      </select>
      <button
        type="submit"
        className="btn"
        style={{
          flex: "1 1 140px",
          background: "var(--color-accent)",
          color: "white",
          border: "none",
          fontWeight: 600,
          fontSize: "1rem",
          cursor: "pointer",
          padding: "0.65rem 1rem",
        }}
      >
        Find Yards
      </button>
      {error && (
        <div
          role="alert"
          style={{
            flex: "1 1 100%",
            color: "#a8261b",
            fontSize: "0.85rem",
            paddingLeft: "0.25rem",
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}
