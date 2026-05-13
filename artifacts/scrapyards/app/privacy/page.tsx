import type { Metadata } from "next";
import Link from "next/link";
import { getRegion } from "../../lib/consent/server";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Scrapyards.io privacy policy — what we collect, how we use cookies, your choices, and how to contact us.",
  alternates: { canonical: "/privacy/" },
};

export default async function PrivacyPage() {
  const region = await getRegion();

  return (
    <div className="container" style={{ padding: "2rem 1.25rem", maxWidth: 760 }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › Privacy
      </nav>
      <h1>Privacy Policy</h1>
      <p style={{ marginTop: "0.5rem", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
        Effective: May 13, 2026
      </p>

      <div style={{
        marginTop: "1.25rem",
        padding: "1rem 1.25rem",
        background: "var(--color-surface, #f7f5f2)",
        border: "1px solid var(--color-border, #e0dcd4)",
        borderRadius: 10,
        fontSize: "0.9rem",
        lineHeight: 1.6,
      }}>
        <strong>Quick links by region:</strong>
        <ul style={{ paddingLeft: "1.25rem", margin: "0.5rem 0 0" }}>
          <li>
            <strong>California, Colorado, Connecticut, Utah, Virginia and other US residents:</strong>{" "}
            <Link href="/privacy/do-not-sell/">Do Not Sell or Share My Information</Link>.
          </li>
          <li>
            <strong>EEA, UK, Switzerland, and Brazil residents:</strong> tracking is off by default. Use the
            consent banner to grant or withdraw permission, or visit{" "}
            <Link href="/privacy/do-not-sell/">your preferences</Link> at any time.
          </li>
          <li>
            <strong>Global Privacy Control:</strong> if your browser sends the <code>Sec-GPC: 1</code> signal,
            we automatically treat it as a request to opt out of analytics and advertising.
          </li>
        </ul>
      </div>

      <p style={{ marginTop: "1.5rem", lineHeight: 1.7 }}>
        This Privacy Policy explains how Scrapyards.io ("Scrapyards.io", "we", "us", "our") collects, uses, and
        shares information when you visit <strong>scrapyards.io</strong> and any related subdomains (the "Site").
        By using the Site you agree to the practices described here.
      </p>

      <h2 style={{ marginTop: "2rem" }}>1. Information we collect</h2>
      <p style={{ lineHeight: 1.7 }}>We collect the following categories of information:</p>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>
          <strong>Server logs (essential).</strong> Standard web-server logs containing your IP address, browser
          user agent, requested URL, referring URL, and timestamp. We use these to operate the Site, prevent
          abuse, and diagnose errors. Logs are retained for up to 90 days.
        </li>
        <li>
          <strong>Region detection (essential).</strong> Your IP address is checked against a third-party
          geolocation lookup (api.country.is) on first visit to determine which consent UX to show
          (US-style notice vs. EU/UK/Brazil opt-in modal). The result is cached in a first-party cookie
          (<code>sy_region</code>, 1-hour TTL) so the lookup is not repeated on every page. The geolocation
          provider does not store IP addresses per its public statement; we do not store the IP either.
        </li>
        <li>
          <strong>Information you submit.</strong> When you submit a price report, contact us by email, or use
          interactive features (such as the Garage Calculator), we collect the information you provide:
          the metal, price, ZIP code, optional notes, and your email address if you choose to send one.
        </li>
        <li>
          <strong>Analytics data (with consent or in opt-out regions).</strong> Google Analytics
          collects aggregate page-view and traffic information. We have IP-anonymization enabled, so the last
          octet of your IP address is truncated before storage.
        </li>
        <li>
          <strong>Advertising data (with consent or in opt-out regions).</strong> Google AdSense
          may set cookies and use device identifiers to serve and measure ads. AdSense may use cookies to
          personalize ads based on your prior visits to this and other sites. See Google's policies below.
        </li>
        <li>
          <strong>Calculator inputs.</strong> ZIP codes and item selections you enter into the Garage Calculator
          are sent to our server only to look up nearby yards and current prices; we do not store them in a
          user-identified record.
        </li>
      </ul>
      <p style={{ lineHeight: 1.7 }}>
        We do not knowingly collect Social Security numbers, government IDs, payment-card data, or precise
        geolocation. We do not sell personal information for money.
      </p>

      <h2 style={{ marginTop: "2rem" }}>2. Cookies and similar technologies</h2>
      <p style={{ lineHeight: 1.7 }}>
        We use the following first-party cookies. None are used for cross-site tracking on their own.
      </p>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li><code>sy_consent</code> (1 year) — your consent choice (<code>all</code> or <code>essential</code>).</li>
        <li><code>sy_region</code> (1 hour) — cached result of the region lookup so we don't re-detect on every request.</li>
        <li><code>sy_consent_seen</code> (1 year) — set after you dismiss the US-style notice so it doesn't reappear.</li>
        <li><code>sy_pv</code> (session) — short-term pageview counter used by the EU consent UX.</li>
      </ul>
      <p style={{ lineHeight: 1.7 }}>
        These cookies are essential for the Site's operation and your privacy choices. They do not require
        consent.
      </p>

      <h2 style={{ marginTop: "2rem" }}>3. How consent works by region</h2>
      <p style={{ lineHeight: 1.7 }}>
        Because privacy laws differ by jurisdiction, we use different default behavior depending on the
        approximate country we detect from your IP address:
      </p>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>
          <strong>EEA, United Kingdom, Switzerland, Iceland, Liechtenstein, Norway, and Brazil ("opt-in"
          regions):</strong> Google Analytics and Google AdSense are <strong>blocked by default</strong>. We
          show a consent banner that escalates to a modal after a few pageviews. Tracking begins only after
          you click "Accept all".
        </li>
        <li>
          <strong>United States and all other regions ("opt-out" regions):</strong> Analytics and AdSense
          load by default. We show a small footer notice with links to manage your preferences and to "Do
          Not Sell or Share My Information". You can opt out at any time on the{" "}
          <Link href="/privacy/do-not-sell/">opt-out page</Link>.
        </li>
        <li>
          <strong>Global Privacy Control:</strong> regardless of region, if your browser sends the{" "}
          <code>Sec-GPC: 1</code> header, we honor it as a request to opt out — no analytics or advertising
          scripts load.
        </li>
        <li>
          <strong>Crawlers:</strong> we never load tracking or advertising scripts for known search-engine
          and social-media crawlers (Googlebot, Bingbot, Yandex, Applebot, etc.).
        </li>
      </ul>

      <h2 style={{ marginTop: "2rem" }}>4. Third-party services</h2>
      <p style={{ lineHeight: 1.7 }}>
        We use the following third parties. Each has its own privacy policy that governs how it processes
        data:
      </p>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>
          <strong>api.country.is</strong> — IP-to-country geolocation used to determine which consent UX to
          show. Per the provider's public statement, IP addresses are not logged.
        </li>
        <li>
          <strong>Google Analytics 4</strong> — aggregate traffic measurement.{" "}
          <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">Google Privacy Policy</a>
          {" · "}
          <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener noreferrer" target="_blank">Browser opt-out add-on</a>.
        </li>
        <li>
          <strong>Google AdSense</strong> — display advertising. Google and its partners may use cookies to
          serve ads based on prior visits to this Site and other sites. You can opt out of personalized
          advertising at{" "}
          <a href="https://adssettings.google.com/" rel="noopener noreferrer" target="_blank">Google Ads Settings</a>
          {" "}or via the industry opt-outs at{" "}
          <a href="https://www.aboutads.info/" rel="noopener noreferrer" target="_blank">aboutads.info</a>{" "}
          (US) and{" "}
          <a href="https://www.youronlinechoices.eu/" rel="noopener noreferrer" target="_blank">youronlinechoices.eu</a>{" "}
          (EU).
        </li>
        <li>
          <strong>Mapbox</strong> — interactive map tiles on yard, city, and state pages. Mapbox receives your
          IP address and the bounding box of the map tiles requested.{" "}
          <a href="https://www.mapbox.com/legal/privacy" rel="noopener noreferrer" target="_blank">Mapbox Privacy Policy</a>.
        </li>
      </ul>

      <h2 style={{ marginTop: "2rem" }}>5. How we use information</h2>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>To operate, maintain, and improve the Site;</li>
        <li>To respond to your inquiries and process price reports you submit;</li>
        <li>To measure traffic and understand which content is useful;</li>
        <li>To serve and measure advertisements;</li>
        <li>To detect, prevent, and address fraud, abuse, security, or technical issues;</li>
        <li>To comply with legal obligations and enforce our Terms of Use.</li>
      </ul>

      <h2 style={{ marginTop: "2rem" }}>6. How we share information</h2>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>
          <strong>Service providers</strong> who host the Site, deliver maps, perform geolocation, and
          provide analytics or advertising as listed above. They process data on our behalf under their own
          terms.
        </li>
        <li>
          <strong>Legal requests.</strong> We may disclose information if required by law, subpoena, or other
          valid legal process, or to protect the rights, property, or safety of Scrapyards.io, our users, or
          the public.
        </li>
        <li>
          <strong>Business transfers.</strong> If Scrapyards.io is involved in a merger, acquisition, or sale
          of assets, user information may be transferred as part of that transaction; we will notify you via
          a prominent notice on the Site.
        </li>
      </ul>
      <p style={{ lineHeight: 1.7 }}>
        We do not sell personal information for money. We may "share" personal information for cross-context
        behavioral advertising, as defined by California law, by allowing Google AdSense to operate on the
        Site. You can opt out at any time on the{" "}
        <Link href="/privacy/do-not-sell/">Do Not Sell or Share</Link> page or by sending the Global Privacy
        Control signal from your browser.
      </p>

      <h2 style={{ marginTop: "2rem" }}>7. Your rights — California, Colorado, Connecticut, Utah, Virginia, and other US states</h2>
      <p style={{ lineHeight: 1.7 }}>
        Depending on your state of residence, you may have the right to:
      </p>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>Know what personal information we collect, use, and share;</li>
        <li>Access or receive a copy of that information;</li>
        <li>Request correction of inaccurate information;</li>
        <li>Request deletion of your personal information;</li>
        <li>Opt out of the sale or sharing of your personal information for cross-context behavioral advertising — see <Link href="/privacy/do-not-sell/">Do Not Sell or Share My Information</Link>;</li>
        <li>Designate an authorized agent to make a request on your behalf;</li>
        <li>Be free from retaliation or discrimination for exercising any of these rights.</li>
      </ul>
      <p style={{ lineHeight: 1.7 }}>
        To exercise any of these rights other than opt-out (which works on the page above), email{" "}
        <a href="mailto:hello@scrapyards.io">hello@scrapyards.io</a>. We will respond within 45 days
        (extendable by another 45 days where permitted). We may need to verify your identity before fulfilling
        the request.
      </p>

      <h2 style={{ marginTop: "2rem" }}>8. Your rights — EEA, United Kingdom, Switzerland, and Brazil</h2>
      <p style={{ lineHeight: 1.7 }}>
        Under the GDPR, UK GDPR, Swiss FADP, and Brazilian LGPD you have the right to:
      </p>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>Access the personal information we process about you;</li>
        <li>Request rectification of inaccurate data;</li>
        <li>Request erasure ("right to be forgotten");</li>
        <li>Restrict or object to processing;</li>
        <li>Withdraw consent at any time (does not affect processing already performed);</li>
        <li>Data portability — receive your data in a machine-readable format;</li>
        <li>Lodge a complaint with your local supervisory authority.</li>
      </ul>
      <p style={{ lineHeight: 1.7 }}>
        Our legal bases for processing are: (a) <em>consent</em> for analytics and advertising cookies;
        (b) <em>legitimate interests</em> for server logs, abuse prevention, and region detection (necessary
        to deliver the appropriate consent UX); and (c) <em>contract / pre-contract</em> for handling
        information you submit through the Site. To exercise any right, email{" "}
        <a href="mailto:hello@scrapyards.io">hello@scrapyards.io</a>.
      </p>

      <h2 style={{ marginTop: "2rem" }}>9. Data retention</h2>
      <p style={{ lineHeight: 1.7 }}>
        Server logs are retained up to 90 days. User-submitted price reports are retained indefinitely as
        anonymous market data unless you ask us to delete an entry tied to your email. Analytics and
        advertising data are retained according to Google's policies (typically 14 months for Google
        Analytics).
      </p>

      <h2 style={{ marginTop: "2rem" }}>10. Security</h2>
      <p style={{ lineHeight: 1.7 }}>
        We use TLS encryption for all traffic to and from the Site, restrict database access to authorized
        personnel, and follow industry-standard practices for hosting and patching. No system is perfectly
        secure, however, and we cannot guarantee absolute security of any information transmitted to or
        stored on the Site.
      </p>

      <h2 style={{ marginTop: "2rem" }}>11. Children's privacy</h2>
      <p style={{ lineHeight: 1.7 }}>
        The Site is not directed to children under 13. We do not knowingly collect personal information from
        children under 13. If you believe a child has provided us with personal information, please contact us
        and we will promptly delete it.
      </p>

      <h2 style={{ marginTop: "2rem" }}>12. International data transfers</h2>
      <p style={{ lineHeight: 1.7 }}>
        The Site is operated from the United States. If you access the Site from outside the US, your
        information will be processed in the US, where data-protection laws may differ from those in your
        country. For transfers from the EEA, UK, Switzerland, and Brazil, we rely on Google's and Mapbox's
        Standard Contractual Clauses and similar safeguards.
      </p>

      <h2 style={{ marginTop: "2rem" }}>13. Changes to this policy</h2>
      <p style={{ lineHeight: 1.7 }}>
        We may update this Privacy Policy from time to time. Material changes will be reflected by updating
        the "Effective" date at the top of this page and, where appropriate, by a notice on the Site. Your
        continued use of the Site after a change constitutes acceptance of the updated policy.
      </p>

      <h2 style={{ marginTop: "2rem" }}>14. Contact</h2>
      <p style={{ lineHeight: 1.7 }}>
        Questions or requests about this policy: <a href="mailto:hello@scrapyards.io">hello@scrapyards.io</a>{" "}
        or via our <Link href="/contact/">contact page</Link>.
      </p>

      {/* Region badge — useful for QA, harmless for users */}
      <p style={{ marginTop: "2.5rem", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
        Detected region for this device: <code>{region}</code>. To override during dev, append{" "}
        <code>?region=opt-in</code> or <code>?region=opt-out</code> to any URL (development only).
      </p>
    </div>
  );
}
