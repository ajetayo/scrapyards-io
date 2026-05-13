"use client";

import "./calculator.css";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  computeCalc,
  encodeCart,
  formatRange,
  formatPriceDate,
  type CalcContext,
  type CalcResult,
  type CartLine,
  type CalcItem,
} from "@/lib/calculator-core";
import { resolveZip } from "@/lib/zip-to-state";

const CATEGORY_LABELS: Record<string, string> = {
  appliance: "Appliances",
  auto: "Auto Parts",
  electrical: "Electrical & Wire",
  electronics: "Electronics",
  plumbing: "Plumbing",
  outdoor: "Outdoor & Yard",
  misc: "Miscellaneous",
};

const METAL_CATEGORY_LABELS: Record<string, string> = {
  copper: "Copper",
  aluminum: "Aluminum",
  steel: "Steel & Iron",
  brass: "Brass",
  lead: "Lead",
  zinc: "Zinc",
  electronics: "Electronics",
  "precious-metals": "Precious Metals",
  "auto-parts": "Auto Parts",
};

type Yard = {
  id: number;
  slug: string;
  name: string;
  address: string | null;
  zip: string | null;
  phone: string | null;
  distance_mi: number;
  city_name: string;
  url: string;
  rating_avg: number | null;
  rating_count: number;
  accepts_subset: string[];
  accepts_unknown: boolean;
};

type FindYardsResponse = {
  yards: Yard[];
  needed_categories: string[];
  radius_miles: number;
  fell_back_to_partial: boolean;
  location_approximate?: boolean;
  resolved_state?: string | null;
  coord_source?: "zip" | "state-centroid" | "client";
  zip?: string | null;
};

export function Calculator({
  ctx: initialCtx,
  initialCart,
  initialZip,
  initialResult,
  syncUrl = true,
}: {
  ctx: CalcContext;
  initialCart: CartLine[];
  initialZip: string;
  initialResult: CalcResult;
  syncUrl?: boolean;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>(initialCart);
  const [zip, setZip] = useState(initialZip);
  const [ctx, setCtx] = useState<CalcContext>(initialCtx);
  const [result, setResult] = useState<CalcResult>(initialResult);
  const [searchTerm, setSearchTerm] = useState("");
  const [browseMode, setBrowseMode] = useState<"search" | "category">("search");
  const [activeCategory, setActiveCategory] = useState<string>("appliance");
  const [yardsState, setYardsState] = useState<{
    loading: boolean;
    error: string | null;
    radius: number;
    data: FindYardsResponse | null;
  }>({ loading: false, error: null, radius: 25, data: null });
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const skipNextZipFetch = useRef(true); // skip on mount; initial ctx already matches

  // Recompute on cart, zip resolution, or context change
  useEffect(() => {
    setResult(computeCalc(cart, ctx));
  }, [cart, ctx]);

  // Sync URL when cart/zip change (without history pollution).
  // Skipped when embedded outside /calculator/ (e.g. /what-is-it-worth/[slug]/)
  // because hardcoding "/calculator/" here would navigate the host page away.
  useEffect(() => {
    if (!syncUrl) return;
    const params = new URLSearchParams();
    const enc = encodeCart(cart);
    if (enc) params.set("i", enc);
    if (zip.trim()) params.set("z", zip.trim());
    const qs = params.toString();
    const url = qs ? `/calculator/?${qs}` : "/calculator/";
    startTransition(() => router.replace(url, { scroll: false }));
  }, [cart, zip, router, syncUrl]);

  // When ZIP changes, refetch prices for the new region
  useEffect(() => {
    if (skipNextZipFetch.current) {
      skipNextZipFetch.current = false;
      return;
    }
    const cleaned = zip.trim();
    const isValid = /^\d{5}$/.test(cleaned);
    const region = isValid ? null : "US"; // null = derive from zip server-side via state lookup
    let cancelled = false;
    async function fetchPrices() {
      try {
        // resolve zip → state on the client too (we have the lib),
        // but simpler to round-trip and rely on prices endpoint:
        const stateForRegion = isValid ? resolveZip(cleaned)?.state ?? "US" : "US";
        const res = await fetch(`/api/calculator/prices/?state=${stateForRegion}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          prices: Record<string, number>;
          regionUsed: "national" | string;
          pricesAsOf: string | null;
        };
        if (cancelled) return;
        setCtx((prev) => ({
          ...prev,
          prices: data.prices,
          regionUsed: data.regionUsed,
          pricesAsOf: data.pricesAsOf,
        }));
      } catch {
        // swallow; keep stale prices
      }
    }
    fetchPrices();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip]);

  const autoFiredRef = useRef(false);

  // ---- Cart mutations ----
  const addItem = useCallback((slug: string) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.slug === slug);
      if (existing) return prev.map((l) => (l.slug === slug ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { slug, quantity: 1 }];
    });
    setSearchTerm("");
  }, []);
  const removeItem = useCallback((slug: string) => {
    setCart((prev) => prev.filter((l) => l.slug !== slug));
  }, []);
  const setQty = useCallback((slug: string, qty: number) => {
    const clean = Math.max(1, Math.floor(qty || 1));
    setCart((prev) => prev.map((l) => (l.slug === slug ? { ...l, quantity: clean } : l)));
  }, []);

  // ---- Search ----
  const itemsBySlug = useMemo(() => new Map(ctx.items.map((i) => [i.slug, i])), [ctx.items]);
  const suggestions = useMemo<CalcItem[]>(() => {
    const t = searchTerm.trim().toLowerCase();
    if (t.length === 0) return [];
    return ctx.items
      .filter((i) => i.name.toLowerCase().includes(t) || i.slug.includes(t))
      .slice(0, 8);
  }, [searchTerm, ctx.items]);
  const featured = useMemo(() => ctx.items.filter((i) => i.isFeatured).slice(0, 6), [ctx.items]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const i of ctx.items) set.add(i.category);
    return Array.from(set).sort((a, b) => {
      const order = ["appliance", "auto", "electrical", "electronics", "plumbing", "outdoor", "misc"];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [ctx.items]);
  const itemsInCategory = useMemo(
    () => ctx.items.filter((i) => i.category === activeCategory),
    [ctx.items, activeCategory],
  );

  // ---- Find yards ----
  const findYards = useCallback(
    async (radius = 25) => {
      const cleaned = zip.trim();
      if (!/^\d{5}$/.test(cleaned)) {
        setYardsState((s) => ({ ...s, error: "Enter a valid 5-digit ZIP code first." }));
        return;
      }
      if (cart.length === 0) {
        setYardsState((s) => ({ ...s, error: "Add at least one item to your cart." }));
        return;
      }
      setYardsState({ loading: true, error: null, radius, data: null });
      try {
        const res = await fetch("/api/calculator/find-yards/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart,
            zip: cleaned,
            radius_miles: radius,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          setYardsState({ loading: false, error: `Search failed: ${txt || res.status}`, radius, data: null });
          return;
        }
        const data = (await res.json()) as FindYardsResponse;
        setYardsState({ loading: false, error: null, radius, data });
      } catch (err) {
        setYardsState({ loading: false, error: String(err), radius, data: null });
      }
    },
    [cart, zip],
  );

  useEffect(() => {
    if (autoFiredRef.current) return;
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("find")) return;
    if (cart.length === 0 || !/^\d{5}$/.test(zip.trim())) return;
    autoFiredRef.current = true;
    findYards(25);
  }, [cart, zip, findYards]);

  // ---- Share ----
  const copyShareLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareNote("Link copied to clipboard");
      setTimeout(() => setShareNote(null), 2000);
    } catch {
      setShareNote("Copy failed — select the URL bar manually");
      setTimeout(() => setShareNote(null), 3000);
    }
  }, []);
  const printPage = useCallback(() => window.print(), []);
  const clearCart = useCallback(() => {
    setCart([]);
    setYardsState({ loading: false, error: null, radius: 25, data: null });
  }, []);

  const validZip = /^\d{5}$/.test(zip.trim());
  const regionLabel =
    result.region_used === "national" ? "National prices" : `${result.region_used} state prices`;

  return (
    <div className="calc-grid">
      {/* LEFT: Item input + cart */}
      <div>
        <div className="calc-zip-row">
          <input
            type="text"
            inputMode="numeric"
            placeholder="ZIP code"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
            aria-label="ZIP code"
          />
          <span className="calc-zip-status">
            {validZip
              ? `Using ${regionLabel}`
              : "Enter ZIP for local pricing & to find yards"}
          </span>
        </div>

        <div className="calc-mode-toggle" role="tablist" aria-label="Item input mode">
          <button
            role="tab"
            aria-pressed={browseMode === "search"}
            onClick={() => setBrowseMode("search")}
          >
            Search
          </button>
          <button
            role="tab"
            aria-pressed={browseMode === "category"}
            onClick={() => setBrowseMode("category")}
          >
            Browse by category
          </button>
        </div>

        {browseMode === "search" ? (
          <div className="calc-search-wrap">
            <input
              className="calc-search-input"
              type="text"
              placeholder="Search items (e.g., water heater, romex, car battery)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search items"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="calc-suggest" role="listbox">
                {suggestions.map((s) => (
                  <button key={s.slug} onClick={() => addItem(s.slug)}>
                    {s.name}
                    <span className="calc-suggest-cat">{CATEGORY_LABELS[s.category] ?? s.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="calc-cat-grid" role="tablist">
              {categories.map((cat) => (
                <button
                  key={cat}
                  role="tab"
                  aria-pressed={activeCategory === cat}
                  onClick={() => setActiveCategory(cat)}
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
            <div className="calc-cat-items">
              {itemsInCategory.map((i) => (
                <button key={i.slug} onClick={() => addItem(i.slug)}>
                  + {i.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Cart */}
        <div className="calc-cart">
          {cart.length === 0 ? (
            <div className="calc-cart-empty">
              <p style={{ marginBottom: "0.5rem" }}>Your cart is empty.</p>
              <p style={{ fontSize: "0.85rem" }}>Quick-add a featured item:</p>
              <div className="calc-quick-grid">
                {featured.map((f) => (
                  <button key={f.slug} onClick={() => addItem(f.slug)}>
                    + {f.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            result.items.map((line) => {
              const item = itemsBySlug.get(line.slug);
              if (!item) return null;
              return (
                <div key={line.slug} className="calc-line">
                  <div className="calc-line-head">
                    <div>
                      <div className="calc-line-name">{line.name}</div>
                      {line.total_weight_lb != null && (
                        <div className="calc-unit">
                          Total weight: {line.total_weight_lb.toFixed(line.total_weight_lb < 1 ? 2 : 0)} lb
                        </div>
                      )}
                      <a
                        href={`/what-is-it-worth/${line.slug}/`}
                        className="calc-line-learnmore"
                        style={{ fontSize: "0.78rem", color: "var(--color-accent)", textDecoration: "none" }}
                      >
                        Learn more about {line.name} →
                      </a>
                    </div>
                    <div className="calc-line-value">
                      {formatRange(line.item_value_low, line.item_value_high)}
                    </div>
                  </div>
                  <div className="calc-line-controls">
                    <div className="calc-qty">
                      <button onClick={() => setQty(line.slug, line.quantity - 1)} aria-label="Decrease">
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => setQty(line.slug, parseInt(e.target.value, 10) || 1)}
                        aria-label="Quantity"
                      />
                      <button onClick={() => setQty(line.slug, line.quantity + 1)} aria-label="Increase">
                        +
                      </button>
                    </div>
                    <span className="calc-unit">{line.unit === "ft" ? "feet" : line.unit === "lb" ? "pounds" : "each"}</span>
                    <button className="calc-line-remove" onClick={() => removeItem(line.slug)}>
                      Remove
                    </button>
                  </div>
                  {line.components.length > 0 && (
                    <div className="calc-line-breakdown">
                      <table>
                        <thead>
                          <tr>
                            <th>Material</th>
                            <th>Recovered</th>
                            <th>Rate</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {line.components.map((c) => (
                            <tr key={c.metal_slug}>
                              <td>{c.metal_name}</td>
                              <td>
                                {c.lb_or_units < 10
                                  ? c.lb_or_units.toFixed(2)
                                  : c.lb_or_units.toFixed(1)}{" "}
                                {c.price_unit === "each" ? "ea" : c.price_unit === "oz" ? "oz" : "lb"}
                              </td>
                              <td>
                                ${c.unit_price_low.toFixed(2)}–${c.unit_price_high.toFixed(2)}/
                                {c.price_unit === "each" ? "ea" : c.price_unit}
                              </td>
                              <td>{formatRange(c.value_low, c.value_high)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {line.notes.length > 0 && (
                    <div className="calc-line-notes">{line.notes.join(" • ")}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: Totals + actions */}
      <aside className="calc-totals-card">
        <div className="calc-region-label">{regionLabel}</div>
        <h3>Estimated Scrap Value</h3>
        <div className="calc-total-range">
          {cart.length === 0
            ? "$0"
            : formatRange(result.total_value_low, result.total_value_high)}
        </div>
        <div className="calc-total-sub">
          {result.prices_as_of
            ? `Prices as of ${formatPriceDate(result.prices_as_of)}`
            : "No price data available."}
        </div>
        {result.warnings.map((w, i) => (
          <div key={i} className="calc-warning">{w}</div>
        ))}

        <button
          className="calc-find-btn"
          onClick={() => findYards(yardsState.radius)}
          disabled={!validZip || cart.length === 0 || yardsState.loading}
        >
          {yardsState.loading
            ? "Finding yards…"
            : !validZip
            ? "Enter ZIP to find yards"
            : cart.length === 0
            ? "Add items to find yards"
            : "Find yards that buy these materials near me"}
        </button>

        <div className="calc-share-row">
          <button onClick={copyShareLink}>Copy share link</button>
          <button onClick={printPage}>Print</button>
          {cart.length > 0 && <button onClick={clearCart}>Clear</button>}
        </div>
        {shareNote && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            {shareNote}
          </div>
        )}

        {result.metals_needed.length > 0 && (
          <div style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            <strong>Materials in this haul:</strong>{" "}
            {result.metals_needed
              .map((c) => METAL_CATEGORY_LABELS[c] ?? c)
              .join(", ")}
          </div>
        )}
      </aside>

      {/* YARDS RESULTS */}
      {(yardsState.error || yardsState.data) && (
        <section className="calc-yards-section" style={{ gridColumn: "1 / -1" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>Yards near {zip}</h2>
          {yardsState.error && <div className="calc-warning">{yardsState.error}</div>}
          {yardsState.data && yardsState.data.yards.length === 0 && (
            <>
              <p style={{ color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
                No yards found within {yardsState.data.radius_miles} miles.
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {[50, 100, 200].map((r) => (
                  <button
                    key={r}
                    className="btn"
                    style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
                    onClick={() => findYards(r)}
                  >
                    Try {r} miles
                  </button>
                ))}
              </div>
            </>
          )}
          {yardsState.data && yardsState.data.yards.length > 0 && (
            <>
              {yardsState.data.fell_back_to_partial && (
                <div className="calc-warning">
                  No yards in range accept all of your materials. Showing yards that accept a subset.
                </div>
              )}
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
                {yardsState.data.location_approximate
                  ? `Distances are approximate (ZIP ${yardsState.data.zip ?? zip} not in our location database — using ${yardsState.data.resolved_state} state center).`
                  : `Distances calculated from ZIP ${yardsState.data.zip ?? zip}.`}
              </div>
              <div className="calc-yards-grid">
                {yardsState.data.yards.map((y) => (
                  <a key={y.id} href={y.url} className="calc-yard-card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <div className="calc-yard-name">{y.name}</div>
                    <div className="calc-yard-meta">
                      {y.address ? `${y.address}, ` : ""}
                      {y.city_name}
                      {y.zip ? ` ${y.zip}` : ""}
                    </div>
                    {y.phone && <div className="calc-yard-meta">{y.phone}</div>}
                    <div className="calc-yard-distance">~{y.distance_mi} mi</div>
                    {y.accepts_unknown ? (
                      <div className="calc-yard-warn">Accepted materials list not on file — call ahead to confirm.</div>
                    ) : y.accepts_subset.length < (yardsState.data?.needed_categories.length ?? 0) ? (
                      <div className="calc-yard-warn">
                        Accepts: {y.accepts_subset.map((c) => METAL_CATEGORY_LABELS[c] ?? c).join(", ")} (subset)
                      </div>
                    ) : null}
                  </a>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Mobile-only sticky totals bar (hidden ≥900px via CSS) */}
      <div className="calc-sticky-mobile" role="region" aria-label="Estimated scrap value">
        <div className="calc-sticky-mobile-text">
          <div className="calc-sticky-mobile-label">Estimated</div>
          <div className="calc-sticky-mobile-value">
            {cart.length === 0
              ? "$0"
              : formatRange(result.total_value_low, result.total_value_high)}
          </div>
        </div>
        <button
          className="calc-sticky-mobile-btn"
          onClick={() => findYards(yardsState.radius)}
          disabled={!validZip || cart.length === 0 || yardsState.loading}
        >
          {yardsState.loading ? "Finding…" : "Find yards"}
        </button>
      </div>

      {/* Educational explainer (FAQ — also fed into JSON-LD on the server) */}
      <details className="calc-explainer" style={{ gridColumn: "1 / -1" }}>
        <summary>How are these prices calculated?</summary>
        <p>
          We track wholesale spot prices on the <strong>London Metal Exchange (LME)</strong> and
          <strong> COMEX</strong> daily, then combine them with reports from yards across the United
          States. The estimate you see is a typical retail-yard payout range — normally <strong>50–70%
          of the underlying spot price.</strong>
        </p>
        <h4>Why a range?</h4>
        <p>
          Yards don&apos;t pay you the full spot price. They take a margin to cover transport,
          processing, and risk. The exact margin depends on grade quality, how clean the material is,
          local competition, and current end-buyer demand. The low end of our range is a conservative
          estimate; the high end is what well-prepared, clean material at a competitive yard can earn.
        </p>
        <h4>What affects your actual payout?</h4>
        <p>
          <strong>Preparation matters.</strong> Stripping copper wire to bare-bright roughly doubles
          the per-pound rate vs. selling it insulated. Removing brass fittings from copper pipe lets
          each metal sell at its proper grade instead of being downgraded to mixed.{" "}
          <strong>Quantity matters.</strong> Some yards offer better tiers for larger loads.{" "}
          <strong>Timing matters.</strong> Spot prices move daily; a 5% swing on copper is normal
          week-to-week.
        </p>
        <h4>Should I trust this estimate?</h4>
        <p>
          Treat it as a planning tool, not a guarantee. For large hauls, call two or three yards and
          ask for a per-pound quote on the specific grade. Don&apos;t haul anything more than 30
          minutes without a quote — fuel costs add up. Most yards will quote over the phone if you
          describe the material accurately.
        </p>
      </details>
    </div>
  );
}

