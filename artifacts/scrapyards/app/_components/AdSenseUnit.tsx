"use client";

/**
 * Region-aware AdSense slot.
 *
 * Reads:
 *   - sy_consent cookie ('all' | 'essential' | unset)
 *   - data-sy-region attribute on <html> (set by RootLayout from middleware)
 *
 * Fires (i.e. renders the <ins> + push) when:
 *   - consent === 'all' OR
 *   - consent unset AND region === 'opt-out' AND no GPC
 *
 * Returns null in all other cases — no ad markup leaks to non-consenting
 * users.
 */
import { useEffect, useRef, useState } from "react";

const ADSENSE_CLIENT = "ca-pub-4183031888320028";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function readConsent(): "all" | "essential" | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)sy_consent=([^;]+)/);
  if (!m) return null;
  const v = decodeURIComponent(m[1]);
  return v === "all" || v === "essential" ? v : null;
}

function readRegion(): "opt-in" | "opt-out" {
  if (typeof document === "undefined") return "opt-in";
  return document.documentElement.dataset.syRegion === "opt-out" ? "opt-out" : "opt-in";
}

function readGpc(): boolean {
  if (typeof navigator === "undefined") return false;
  // Spec: navigator.globalPrivacyControl is the standard browser exposure.
  return Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
}

function shouldFire(): boolean {
  const consent = readConsent();
  if (consent === "all") return true;
  if (consent === "essential") return false;
  if (readGpc()) return false;
  return readRegion() === "opt-out";
}

export function AdSenseUnit({
  slot = "7063973314",
  format = "auto",
  responsive = true,
  style,
}: {
  slot?: string;
  format?: string;
  responsive?: boolean;
  style?: React.CSSProperties;
}) {
  const [enabled, setEnabled] = useState(false);
  const pushed = useRef(false);

  useEffect(() => {
    setEnabled(shouldFire());
  }, []);

  useEffect(() => {
    if (!enabled || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // adsbygoogle.js not loaded yet or push failed; safe to ignore.
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div style={{ margin: "1.5rem 0", textAlign: "center", ...style }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}
