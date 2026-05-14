/**
 * Server component that picks the right banner based on the
 * x-consent-region request header set by middleware.
 *
 * Bots get nothing — no banner markup at all. We don't want crawlers
 * to index consent UI as page content, and there's no consent decision
 * to gather from a bot anyway.
 */
import { getRegion } from "../../../lib/consent/server";
import { isBot } from "../../../lib/consent/server";
import { OptInBanner } from "./OptInBanner";
import { OptOutBanner } from "./OptOutBanner";

export async function ConsentSlot() {
  if (await isBot()) return null;
  const region = await getRegion();
  return region === "opt-out" ? <OptOutBanner /> : <OptInBanner />;
}
