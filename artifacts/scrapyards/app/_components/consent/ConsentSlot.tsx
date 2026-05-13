/**
 * Server component that picks the right banner based on the
 * x-consent-region request header set by middleware.
 *
 * Bots (matched in layout) skip this entirely.
 */
import { Suspense } from "react";
import { getRegion } from "../../../lib/consent/server";
import { OptInBanner } from "./OptInBanner";
import { OptOutBanner } from "./OptOutBanner";

export async function ConsentSlot() {
  const region = await getRegion();
  return (
    <Suspense fallback={null}>
      {region === "opt-out" ? <OptOutBanner /> : <OptInBanner />}
    </Suspense>
  );
}
