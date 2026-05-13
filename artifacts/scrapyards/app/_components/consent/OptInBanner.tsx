"use client";

/**
 * GDPR / opt-in regions: tracking blocked until explicit consent.
 *
 * Behavior copied from the prior CookieBanner:
 *   - Sticky bar at top on first pageview.
 *   - Escalates to a centered modal after 3 pageviews OR 30s.
 *   - "Accept all" → sy_consent=all, hard reload so server re-renders
 *     analytics scripts.
 *   - "Essential only" → sy_consent=essential, banner disappears.
 */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const COOKIE_NAME = "sy_consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const PV_KEY = "sy_pv";
const ESCALATE_PV = 3;
const ESCALATE_MS = 30_000;

function readConsent(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)sy_consent=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function setConsent(value: "all" | "essential") {
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

function bumpPageview(): number {
  try {
    const n = parseInt(sessionStorage.getItem(PV_KEY) ?? "0", 10) + 1;
    sessionStorage.setItem(PV_KEY, String(n));
    return n;
  } catch {
    return 1;
  }
}

export function OptInBanner() {
  const [show, setShow] = useState(false);
  const [modal, setModal] = useState(false);
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (readConsent()) {
      setShow(false);
      return;
    }
    setShow(true);
    const pv = bumpPageview();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pv >= ESCALATE_PV) {
      setModal(true);
    } else {
      setModal(false);
      timerRef.current = setTimeout(() => setModal(true), ESCALATE_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname]);

  if (!show) return null;

  const choose = (value: "all" | "essential") => {
    setConsent(value);
    setShow(false);
    setModal(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value === "all") window.location.reload();
  };

  if (modal) {
    return (
      <>
        <div aria-hidden="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1001 }} />
        <div role="dialog" aria-modal="true" aria-label="Cookie consent" aria-describedby="cookie-modal-desc"
          style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1002, padding: "1rem" }}>
          <div style={{ background: "#1a1a18", color: "#fff", borderRadius: 12, padding: "2rem 2rem 1.75rem", maxWidth: 460, width: "100%", boxShadow: "0 12px 48px rgba(0,0,0,0.5)" }}>
            <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.75rem", color: "#fff" }}>Your privacy choices</h2>
            <p id="cookie-modal-desc" style={{ lineHeight: 1.65, margin: "0 0 1.5rem", color: "#d4d4d2", fontSize: "0.9rem" }}>
              We use cookies for analytics and advertising. With your consent, Google Analytics and Google AdSense help
              us keep prices fresh and the site free.{" "}
              <a href="/privacy/" style={{ color: "#ffb59a", textDecoration: "underline" }}>Privacy Policy</a>.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button onClick={() => choose("all")} style={{ background: "#c8401a", color: "#fff", border: "none", padding: "0.8rem 1rem", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.95rem" }}>
                Accept all cookies
              </button>
              <button onClick={() => choose("essential")} style={{ background: "transparent", color: "#aaa", border: "1px solid #444", padding: "0.7rem 1rem", borderRadius: 8, cursor: "pointer", fontSize: "0.85rem" }}>
                Essential only
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 999, pointerEvents: "none" }} />
      <div role="dialog" aria-label="Cookie consent" aria-describedby="cookie-bar-desc"
        style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, background: "#1a1a18", color: "#fff", padding: "0.85rem 1.25rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 20px rgba(0,0,0,0.35)", fontSize: "0.9rem" }}>
        <p id="cookie-bar-desc" style={{ flex: "1 1 280px", margin: 0, lineHeight: 1.5 }}>
          We use cookies for analytics and advertising.{" "}
          <a href="/privacy/" style={{ color: "#ffb59a", textDecoration: "underline" }}>Privacy Policy</a>.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          <button onClick={() => choose("essential")} style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.45)", padding: "0.45rem 0.9rem", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
            Essential only
          </button>
          <button onClick={() => choose("all")} style={{ background: "#c8401a", color: "#fff", border: "none", padding: "0.45rem 0.9rem", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem", fontWeight: 700 }}>
            Accept all
          </button>
        </div>
      </div>
    </>
  );
}
