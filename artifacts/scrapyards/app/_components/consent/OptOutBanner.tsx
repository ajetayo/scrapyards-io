"use client";

/**
 * US / opt-out regions: tracking is on by default. This bar is informational
 * and never blocks rendering. Dismissing it sets sy_consent_seen=1 so we
 * stop showing it; the user's actual preferences live in sy_consent.
 *
 * "Manage preferences" → /privacy/do-not-sell/ (the same page handles both
 * full-opt-out and switch-back-to-all UX).
 * "Do Not Sell or Share My Information" → /privacy/do-not-sell/ (CCPA link).
 */
import { useEffect, useState } from "react";

const SEEN_COOKIE = "sy_consent_seen";
const SEEN_MAX_AGE = 60 * 60 * 24 * 365;

function readSeen(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sy_consent_seen=1/.test(document.cookie);
}

function readConsent(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)sy_consent=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function markSeen() {
  document.cookie = `${SEEN_COOKIE}=1; Max-Age=${SEEN_MAX_AGE}; Path=/; SameSite=Lax`;
}

export function OptOutBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Hide if user has already dismissed OR explicitly chose 'essential'
    // (in which case the choice is settled and there's nothing more to nag about).
    if (readSeen()) return;
    const c = readConsent();
    if (c === "essential" || c === "all") return;
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    markSeen();
    setShow(false);
  };

  return (
    <div role="region" aria-label="Privacy notice"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1000,
        background: "#1a1a18", color: "#fff",
        padding: "0.7rem 1rem",
        display: "flex", flexWrap: "wrap", gap: "0.65rem",
        alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.3)", fontSize: "0.85rem", lineHeight: 1.45,
      }}>
      <p style={{ flex: "1 1 280px", margin: 0 }}>
        We use cookies for analytics and advertising.{" "}
        <a href="/privacy/" style={{ color: "#ffb59a", textDecoration: "underline" }}>Privacy</a>
        {" · "}
        <a href="/privacy/do-not-sell/" style={{ color: "#ffb59a", textDecoration: "underline" }}>
          Do Not Sell or Share My Information
        </a>
      </p>
      <div style={{ display: "flex", gap: "0.45rem", flexShrink: 0 }}>
        <a href="/privacy/do-not-sell/"
          style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.45)", padding: "0.4rem 0.75rem", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>
          Manage preferences
        </a>
        <button onClick={dismiss}
          style={{ background: "#c8401a", color: "#fff", border: "none", padding: "0.4rem 0.85rem", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", fontWeight: 700 }}>
          Got it
        </button>
      </div>
    </div>
  );
}
