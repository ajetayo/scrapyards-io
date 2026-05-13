"use client";

import { useEffect, useRef, useState } from "react";

const ADSENSE_CLIENT = "ca-pub-4183031888320028";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function hasAdConsent(): boolean {
  if (typeof document === "undefined") return false;
  const m = document.cookie.match(/(?:^|;\s*)sy_consent=([^;]+)/);
  return m ? decodeURIComponent(m[1]) === "all" : false;
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
    setEnabled(hasAdConsent());
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
