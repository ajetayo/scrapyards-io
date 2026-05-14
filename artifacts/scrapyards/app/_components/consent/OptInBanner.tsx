"use client";

/**
 * GDPR / opt-in regions: tracking blocked until explicit consent.
 *
 * UX contract:
 *   - The page is fully browsable and scrollable from first paint.
 *     Tracking is simply OFF until the user makes a choice.
 *   - A non-blocking modal card appears 5 seconds after this component
 *     mounts (= after hydration / first meaningful paint on the client).
 *     The modal sits above content but DOES NOT cover the page with a
 *     full-screen overlay and does not capture pointer events outside
 *     itself — users may ignore it and continue browsing indefinitely.
 *   - The 5s timer is wall-clock from mount; if the user navigates to
 *     a new route within those 5s the timer is reset on remount, but
 *     because the component lives in the persistent root layout it
 *     mounts exactly once per pageview session, so the modal is
 *     guaranteed to appear within the first pageview for fast
 *     navigators (and stays visible across subsequent client-side
 *     navigations until choice or page reload).
 *   - Two choices:
 *       Accept all  → sy_consent='all', hard reload so server re-renders
 *                     analytics + ads
 *       Reject all  → sy_consent='essential', banner disappears, no
 *                     reload needed (nothing to tear down)
 *     Internal cookie value remains 'essential' for back-compat with
 *     OptOutBanner / shouldFireTracking checks; only the user-facing
 *     label changed (we don't have an actual "essential cookies" tier
 *     to keep, so "Reject all" is the honest label).
 */
import { useEffect, useRef, useState } from "react";

const COOKIE_NAME = "sy_consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const SHOW_DELAY_MS = 5_000;

function readConsent(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)sy_consent=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function setConsent(value: "all" | "essential") {
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

export function OptInBanner() {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (readConsent()) return;
    timerRef.current = setTimeout(() => setShow(true), SHOW_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!show) return null;

  const choose = (value: "all" | "essential") => {
    setConsent(value);
    setShow(false);
    if (value === "all") window.location.reload();
  };

  // Non-blocking modal card — fixed-positioned in the lower-right
  // corner. No backdrop, no inset:0, pointer events only on the card
  // itself. Users who ignore it can keep scrolling, clicking links,
  // and reading the page; tracking simply remains off until they
  // choose.
  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-modal-desc"
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        left: "1rem",
        maxWidth: 420,
        marginLeft: "auto",
        zIndex: 1000,
        background: "#1a1a18",
        color: "#fff",
        borderRadius: 12,
        padding: "1.25rem 1.4rem 1.1rem",
        boxShadow: "0 12px 36px rgba(0,0,0,0.45)",
        fontSize: "0.9rem",
        lineHeight: 1.55,
      }}
    >
      <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.5rem", color: "#fff" }}>
        Your privacy choices
      </h2>
      <p id="cookie-modal-desc" style={{ margin: "0 0 1rem", color: "#d4d4d2", fontSize: "0.875rem" }}>
        We use cookies for analytics and advertising. With your consent, Google Analytics and
        Google AdSense help us keep prices fresh and the site free.{" "}
        <a href="/privacy/" style={{ color: "#ffb59a", textDecoration: "underline" }}>
          Privacy Policy
        </a>
        .
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <button
          onClick={() => choose("all")}
          style={{
            background: "#c8401a",
            color: "#fff",
            border: "none",
            padding: "0.7rem 1rem",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.92rem",
          }}
        >
          Accept all
        </button>
        <button
          onClick={() => choose("essential")}
          style={{
            background: "transparent",
            color: "#9a9a96",
            border: "1px solid #3a3a36",
            padding: "0.55rem 1rem",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: "0.82rem",
            fontWeight: 500,
          }}
        >
          Reject all
        </button>
      </div>
    </div>
  );
}
