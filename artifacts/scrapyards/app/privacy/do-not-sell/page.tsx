import type { Metadata } from "next";
import Link from "next/link";
import { DoNotSellForm } from "./DoNotSellForm";

export const metadata: Metadata = {
  title: "Do Not Sell or Share My Information",
  description:
    "Opt out of the sale or sharing of your personal information for cross-context behavioral advertising. Required disclosure under California (CCPA/CPRA), Colorado, Connecticut, Virginia, and other US state privacy laws.",
  alternates: { canonical: "/privacy/do-not-sell/" },
  robots: { index: false, follow: true },
};

export default function DoNotSellPage() {
  return (
    <div className="container" style={{ padding: "2rem 1.25rem", maxWidth: 760 }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › <Link href="/privacy/">Privacy</Link> › Do Not Sell or Share
      </nav>
      <h1>Do Not Sell or Share My Information</h1>
      <p style={{ marginTop: "0.5rem", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
        Effective: May 13, 2026
      </p>

      <p style={{ marginTop: "1.5rem", lineHeight: 1.7 }}>
        Under the California Consumer Privacy Act ("CCPA") as amended by the California Privacy Rights Act
        ("CPRA"), and similar laws in Colorado, Connecticut, Utah, Virginia, and other US states, you have
        the right to opt out of the "sale" or "sharing" of your personal information for cross-context
        behavioral advertising.
      </p>

      <p style={{ lineHeight: 1.7 }}>
        Scrapyards.io does not sell personal information for money. We do, however, allow Google AdSense to
        place cookies and use device identifiers that may be considered "sharing" under California law. You
        can opt out of this on this site by clicking the button below. Your choice is stored in a first-party
        cookie (<code>sy_consent=essential</code>) on this device.
      </p>

      <DoNotSellForm />

      <h2 style={{ marginTop: "2rem" }}>Other ways to opt out</h2>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>
          Send a <strong>Global Privacy Control</strong> signal from your browser. Browsers and extensions
          such as Brave, DuckDuckGo, and Privacy Badger send <code>Sec-GPC: 1</code> on every request; we
          honor that signal automatically and will not load tracking or advertising scripts.{" "}
          <a href="https://globalprivacycontrol.org/" rel="noopener noreferrer" target="_blank">Learn more about GPC</a>.
        </li>
        <li>
          Opt out of personalized ads industry-wide at{" "}
          <a href="https://www.aboutads.info/choices/" rel="noopener noreferrer" target="_blank">aboutads.info/choices</a>{" "}
          (DAA) and{" "}
          <a href="https://optout.networkadvertising.org/" rel="noopener noreferrer" target="_blank">NAI Opt-Out</a>.
        </li>
        <li>
          Manage Google ad personalization at{" "}
          <a href="https://adssettings.google.com/" rel="noopener noreferrer" target="_blank">Google Ads Settings</a>.
        </li>
      </ul>

      <h2 style={{ marginTop: "2rem" }}>Authorized agents</h2>
      <p style={{ lineHeight: 1.7 }}>
        California residents may designate an authorized agent to opt out on their behalf. To do so, email{" "}
        <a href="mailto:hello@scrapyards.io">hello@scrapyards.io</a> with the subject line "Authorized agent
        opt-out request" and include written permission from the consumer. We may verify the agent's
        authority before honoring the request.
      </p>

      <h2 style={{ marginTop: "2rem" }}>Categories of information shared</h2>
      <p style={{ lineHeight: 1.7 }}>
        With consent (or, in opt-out states, by default), we share the following with Google AdSense and
        Google Analytics: IP address (truncated for GA), browser user agent, page URL, referring URL, and
        cookie identifiers used to measure ad performance and frequency. We do not share name, email
        address, phone number, government identifiers, or precise geolocation.
      </p>

      <h2 style={{ marginTop: "2rem" }}>Right to non-discrimination</h2>
      <p style={{ lineHeight: 1.7 }}>
        We will not deny you services, charge a different price, or provide a lower quality of service
        because you exercised your privacy rights.
      </p>

      <p style={{ marginTop: "2rem", lineHeight: 1.7 }}>
        Questions: <a href="mailto:hello@scrapyards.io">hello@scrapyards.io</a> · Full{" "}
        <Link href="/privacy/">Privacy Policy</Link>.
      </p>
    </div>
  );
}
