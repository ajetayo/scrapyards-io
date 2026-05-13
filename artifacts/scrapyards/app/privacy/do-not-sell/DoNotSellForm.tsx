"use client";

import { useEffect, useState } from "react";

const COOKIE_NAME = "sy_consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readConsent(): "all" | "essential" | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)sy_consent=([^;]+)/);
  if (!m) return null;
  const v = decodeURIComponent(m[1]);
  return v === "all" || v === "essential" ? v : null;
}

function setConsent(value: "all" | "essential") {
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

export function DoNotSellForm() {
  const [current, setCurrent] = useState<"all" | "essential" | "unset">("unset");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCurrent(readConsent() ?? "unset");
  }, []);

  const optOut = () => {
    setConsent("essential");
    setCurrent("essential");
    setSaved(true);
  };

  const optIn = () => {
    setConsent("all");
    setCurrent("all");
    setSaved(true);
    // Hard reload so server-rendered Analytics picks up the new consent.
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div style={{
      marginTop: "1.5rem",
      padding: "1.25rem",
      background: "var(--color-surface, #fafafa)",
      border: "1px solid var(--color-border, #e0e0e0)",
      borderRadius: 10,
    }}>
      <p style={{ margin: "0 0 0.75rem", fontWeight: 600 }}>Your current setting on this device:</p>
      <p style={{ margin: "0 0 1.25rem", fontSize: "0.95rem" }}>
        {current === "essential" && (
          <span style={{ color: "#0a7a3e" }}>
            ✓ Opted out — analytics and advertising scripts are blocked on this device.
          </span>
        )}
        {current === "all" && (
          <span>Consent: all cookies enabled (analytics + advertising).</span>
        )}
        {current === "unset" && (
          <span style={{ color: "var(--color-text-muted)" }}>
            No explicit choice yet — your region's default applies.
          </span>
        )}
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          onClick={optOut}
          disabled={current === "essential"}
          style={{
            background: current === "essential" ? "#888" : "#c8401a",
            color: "#fff",
            border: "none",
            padding: "0.7rem 1.25rem",
            borderRadius: 8,
            cursor: current === "essential" ? "default" : "pointer",
            fontWeight: 700,
            fontSize: "0.95rem",
          }}
        >
          {current === "essential" ? "Opted out" : "Opt out — Do Not Sell or Share"}
        </button>
        <button
          onClick={optIn}
          disabled={current === "all"}
          style={{
            background: "transparent",
            color: "var(--color-text)",
            border: "1px solid var(--color-border, #ccc)",
            padding: "0.7rem 1.25rem",
            borderRadius: 8,
            cursor: current === "all" ? "default" : "pointer",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          Allow analytics and advertising
        </button>
      </div>

      {saved && (
        <p style={{ marginTop: "0.85rem", fontSize: "0.85rem", color: "#0a7a3e" }} role="status">
          ✓ Saved to this device.
        </p>
      )}

      <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
        This setting is stored in a cookie on this device only. To opt out on other devices or browsers,
        repeat this on each one. Clearing your cookies will reset the setting.
      </p>
    </div>
  );
}
