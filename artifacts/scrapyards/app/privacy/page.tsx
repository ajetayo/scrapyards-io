import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Scrapyards.io privacy policy — what we collect, how we use cookies, your choices, and how to contact us.",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <div className="container" style={{ padding: "2rem 1.25rem", maxWidth: 760 }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › Privacy
      </nav>
      <h1>Privacy Policy</h1>
      <p style={{ marginTop: "0.5rem", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
        Effective: May 10, 2026
      </p>

      <p style={{ marginTop: "1.5rem", lineHeight: 1.7 }}>
        This Privacy Policy explains how Scrapyards.io ("Scrapyards.io", "we", "us", "our") collects, uses, and
        shares information when you visit <strong>scrapyards.io</strong> and any related subdomains (the "Site").
        By using the Site you agree to the practices described here.
      </p>

      <h2 style={{ marginTop: "2rem" }}>1. Information we collect</h2>
      <p style={{ lineHeight: 1.7 }}>
        We collect the following categories of information:
      </p>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>
          <strong>Server logs (essential).</strong> Standard web-server logs containing your IP address, browser
          user agent, requested URL, referring URL, and timestamp. We use these to operate the Site, prevent
          abuse, and diagnose errors. Logs are retained for up to 90 days.
        </li>
        <li>
          <strong>Information you submit.</strong> When you submit a price report, contact us by email, or use
          interactive features (such as the Garage Calculator), we collect the information you provide:
          the metal, price, ZIP code, optional notes, and your email address if you choose to send one.
        </li>
        <li>
          <strong>Analytics data (with consent).</strong> If you accept analytics cookies, Google Analytics
          collects aggregate page-view and traffic information. We have IP-anonymization enabled, so the last
          octet of your IP address is truncated before storage.
        </li>
        <li>
          <strong>Advertising data (with consent).</strong> If you accept advertising cookies, Google AdSense
          may set cookies to serve and measure ads. AdSense may use cookies to personalize ads based on your
          prior visits to this and other sites. See Google's policies below for details.
        </li>
        <li>
          <strong>Calculator inputs.</strong> ZIP codes and item selections you enter into the Garage Calculator
          are sent to our server only to look up nearby yards and current prices; we do not store them in a
          user-identified record.
        </li>
      </ul>
      <p style={{ lineHeight: 1.7 }}>
        We do not knowingly collect Social Security numbers, government IDs, payment-card data, or precise
        geolocation. We do not sell personal information.
      </p>

      <h2 style={{ marginTop: "2rem" }}>2. Cookies and similar technologies</h2>
      <p style={{ lineHeight: 1.7 }}>
        We use a small first-party cookie named <code>sy_consent</code> (1-year expiration) to remember your
        consent choice. This cookie is essential and does not require consent.
      </p>
      <p style={{ lineHeight: 1.7 }}>
        We do <strong>not</strong> load Google Analytics or Google AdSense scripts or cookies until you click
        "Accept all" in the consent banner. If you click "Essential only" or ignore the banner, no analytics
        or advertising cookies are set. You can change your choice at any time by clearing the
        <code>sy_consent</code> cookie for this site (most browsers offer this in their privacy/site-data
        settings) — the banner will reappear on your next visit so you can choose again.
      </p>

      <h2 style={{ marginTop: "2rem" }}>3. Third-party services</h2>
      <p style={{ lineHeight: 1.7 }}>
        With your consent we use the following third parties. Each has its own privacy policy that governs
        how it processes data:
      </p>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
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
          {" "}or via the industry opt-out at{" "}
          <a href="https://www.aboutads.info/" rel="noopener noreferrer" target="_blank">aboutads.info</a>
          {" "}(US) or{" "}
          <a href="https://www.youronlinechoices.eu/" rel="noopener noreferrer" target="_blank">youronlinechoices.eu</a>
          {" "}(EU).
        </li>
        <li>
          <strong>Mapbox</strong> — interactive map tiles on yard, city, and state pages. Mapbox receives your
          IP address and the bounding box of the map tiles requested.{" "}
          <a href="https://www.mapbox.com/legal/privacy" rel="noopener noreferrer" target="_blank">Mapbox Privacy Policy</a>.
        </li>
      </ul>

      <h2 style={{ marginTop: "2rem" }}>4. How we use information</h2>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>To operate, maintain, and improve the Site;</li>
        <li>To respond to your inquiries and process price reports you submit;</li>
        <li>To measure traffic and understand which content is useful (with consent);</li>
        <li>To serve and measure advertisements (with consent);</li>
        <li>To detect, prevent, and address fraud, abuse, security, or technical issues;</li>
        <li>To comply with legal obligations and enforce our Terms of Use.</li>
      </ul>

      <h2 style={{ marginTop: "2rem" }}>5. How we share information</h2>
      <p style={{ lineHeight: 1.7 }}>
        We share information only as described here:
      </p>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>
          <strong>Service providers</strong> who host the Site, deliver maps, and provide analytics or
          advertising as listed above. They process data on our behalf under their own terms.
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
        We do not sell or "share" personal information for cross-context behavioral advertising in the manner
        defined by California law, except to the extent that our use of Google AdSense (with your consent) is
        treated as such by some interpretations. You can disable advertising cookies at any time as described
        above.
      </p>

      <h2 style={{ marginTop: "2rem" }}>6. Your choices and rights</h2>
      <p style={{ lineHeight: 1.7 }}>
        Depending on where you live, you may have the following rights regarding your personal information:
      </p>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>The right to access the personal information we hold about you;</li>
        <li>The right to request correction of inaccurate information;</li>
        <li>The right to request deletion of your personal information;</li>
        <li>The right to opt out of analytics and advertising cookies (via the consent banner);</li>
        <li>The right to opt out of the "sale" or "sharing" of personal information (US state laws);</li>
        <li>The right to lodge a complaint with your local data-protection authority (EU/UK residents).</li>
      </ul>
      <p style={{ lineHeight: 1.7 }}>
        To exercise any of these rights, email{" "}
        <a href="mailto:hello@scrapyards.io">hello@scrapyards.io</a> with the subject line
        "Privacy request" and tell us what you would like us to do. We will respond within 30 days. Because we
        hold very limited personal information (no accounts, no payment data), most requests can be honored
        immediately.
      </p>

      <h2 style={{ marginTop: "2rem" }}>7. Data retention</h2>
      <p style={{ lineHeight: 1.7 }}>
        Server logs are retained up to 90 days. User-submitted price reports are retained indefinitely as
        anonymous market data unless you ask us to delete an entry tied to your email. Analytics and
        advertising data are retained according to Google's policies (typically 14 months for Google
        Analytics, configurable in our admin).
      </p>

      <h2 style={{ marginTop: "2rem" }}>8. Security</h2>
      <p style={{ lineHeight: 1.7 }}>
        We use TLS encryption for all traffic to and from the Site, restrict database access to authorized
        personnel, and follow industry-standard practices for hosting and patching. No system is perfectly
        secure, however, and we cannot guarantee absolute security of any information transmitted to or
        stored on the Site.
      </p>

      <h2 style={{ marginTop: "2rem" }}>9. Children's privacy</h2>
      <p style={{ lineHeight: 1.7 }}>
        The Site is not directed to children under 13. We do not knowingly collect personal information from
        children under 13. If you believe a child has provided us with personal information, please contact us
        and we will promptly delete it.
      </p>

      <h2 style={{ marginTop: "2rem" }}>10. International users</h2>
      <p style={{ lineHeight: 1.7 }}>
        The Site is operated from the United States. If you access the Site from outside the US, your
        information will be processed in the US, where data-protection laws may differ from those in your
        country.
      </p>

      <h2 style={{ marginTop: "2rem" }}>11. Changes to this policy</h2>
      <p style={{ lineHeight: 1.7 }}>
        We may update this Privacy Policy from time to time. Material changes will be reflected by updating
        the "Effective" date at the top of this page and, where appropriate, by a notice on the Site. Your
        continued use of the Site after a change constitutes acceptance of the updated policy.
      </p>

      <h2 style={{ marginTop: "2rem" }}>12. Contact</h2>
      <p style={{ lineHeight: 1.7 }}>
        Questions or requests about this policy: <a href="mailto:hello@scrapyards.io">hello@scrapyards.io</a>{" "}
        or via our <Link href="/contact/">contact page</Link>.
      </p>
    </div>
  );
}
