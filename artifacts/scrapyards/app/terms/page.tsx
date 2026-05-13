import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Scrapyards.io terms of use — site usage, content disclaimers, user submissions, and limitation of liability.",
  alternates: { canonical: "/terms/" },
};

export default function TermsPage() {
  return (
    <div className="container" style={{ padding: "2rem 1.25rem", maxWidth: 760 }}>
      <nav className="breadcrumb">
        <Link href="/">Home</Link> › Terms
      </nav>
      <h1>Terms of Use</h1>
      <p style={{ marginTop: "0.5rem", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
        Effective: May 10, 2026
      </p>

      <p style={{ marginTop: "1.5rem", lineHeight: 1.7 }}>
        These Terms of Use ("Terms") are a binding agreement between you and Scrapyards.io ("we", "us",
        "our") and govern your access to and use of <strong>scrapyards.io</strong> and any related subdomains
        (the "Site"). By accessing or using the Site you agree to these Terms. If you do not agree, do not use
        the Site.
      </p>

      <h2 style={{ marginTop: "2rem" }}>1. Eligibility</h2>
      <p style={{ lineHeight: 1.7 }}>
        You must be at least 13 years old to use the Site. By using the Site you represent that you meet this
        requirement and that you have the legal capacity to enter into these Terms.
      </p>

      <h2 style={{ marginTop: "2rem" }}>2. Informational content — no warranty</h2>
      <p style={{ lineHeight: 1.7 }}>
        Scrap metal prices, yard listings, hours, contact details, accepted-material lists, and any other
        information shown on the Site are estimates and references gathered from public sources, third-party
        feeds, and user submissions. They are <strong>not guarantees</strong>. Prices change throughout the
        day, hours change without notice, and yards may stop accepting certain materials at any time. Always
        contact the yard directly to confirm prices, hours, accepted materials, and any minimums or
        identification requirements before traveling.
      </p>

      <h2 style={{ marginTop: "2rem" }}>3. Calculator and value estimates</h2>
      <p style={{ lineHeight: 1.7 }}>
        The Garage Scrap Calculator and "What's it worth" pages produce typical payout ranges based on
        national spot prices, standard recovery rates, and assumed yard payout multipliers (typically 50–70%
        of spot). Your actual payout will vary based on local prices, the buying yard, the condition and
        cleanliness of your material, the quantity, prep work, and current market conditions. We make no
        warranty as to the accuracy of any estimate and accept no liability for decisions made in reliance on
        them.
      </p>

      <h2 style={{ marginTop: "2rem" }}>4. User submissions</h2>
      <p style={{ lineHeight: 1.7 }}>
        When you submit a price report, listing correction, or other content ("User Submissions") you grant
        Scrapyards.io a worldwide, royalty-free, perpetual, irrevocable license to use, reproduce, modify,
        publish, and display the submission for the purpose of operating, improving, and promoting the Site.
        You represent that your submissions are accurate, lawful, and that you have the right to submit them.
        We may edit, refuse, or remove any submission at our discretion.
      </p>

      <h2 style={{ marginTop: "2rem" }}>5. Acceptable use</h2>
      <p style={{ lineHeight: 1.7 }}>
        You agree not to:
      </p>
      <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
        <li>Scrape, crawl, or otherwise extract data from the Site except via the public sitemap and
          robots-allowed pages, in compliance with reasonable rate limits;</li>
        <li>Submit false, misleading, defamatory, or unlawful price reports or content;</li>
        <li>Use the directory to harass, defame, threaten, or otherwise harm any listed business or person;</li>
        <li>Interfere with or attempt to disrupt the Site, its servers, or its security mechanisms;</li>
        <li>Reverse engineer, decompile, or attempt to extract source code from the Site;</li>
        <li>Use the Site to violate any applicable law or regulation, including scrap-metal sale laws,
          identification requirements, and anti-theft statutes in your jurisdiction.</li>
      </ul>
      <p style={{ lineHeight: 1.7 }}>
        We may suspend or block access, remove submissions, and pursue legal remedies for violations of these
        rules at our discretion and without notice.
      </p>

      <h2 style={{ marginTop: "2rem" }}>6. Yard listings — third-party businesses</h2>
      <p style={{ lineHeight: 1.7 }}>
        Yards listed on the Site are independent third-party businesses. Scrapyards.io does not own, operate,
        endorse, or guarantee any listed yard. Inclusion in our directory does not imply endorsement, and we
        do not verify licenses, insurance, business practices, or compliance with local regulations. Your
        dealings with any yard are solely between you and that business.
      </p>
      <p style={{ lineHeight: 1.7 }}>
        If you own or manage a yard listed on the Site and want to update or claim your listing, contact us
        at <a href="mailto:hello@scrapyards.io">hello@scrapyards.io</a> from a verifiable business address.
      </p>

      <h2 style={{ marginTop: "2rem" }}>7. Advertising</h2>
      <p style={{ lineHeight: 1.7 }}>
        The Site displays advertising served by third parties such as Google AdSense. Advertisements are
        served by those networks and not by Scrapyards.io. We do not endorse advertisers and are not
        responsible for the content of any advertisement or for any goods or services purchased from an
        advertiser. Your interactions with advertisers are governed by the advertiser's own terms.
      </p>

      <h2 style={{ marginTop: "2rem" }}>8. Intellectual property</h2>
      <p style={{ lineHeight: 1.7 }}>
        The Site and all of its original content, features, code, and functionality are owned by Scrapyards.io
        and are protected by copyright, trademark, and other applicable laws. The "Scrapyards.io" name and
        logo are our trademarks. ZIP code coordinate data is provided by GeoNames under the
        {" "}<a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer" target="_blank">
          CC BY 4.0 license
        </a>. You may link to the Site and quote brief excerpts with attribution; any other use requires our
        written permission.
      </p>

      <h2 style={{ marginTop: "2rem" }}>9. Third-party links</h2>
      <p style={{ lineHeight: 1.7 }}>
        The Site contains links to third-party websites (yard websites, map providers, search engines, etc.).
        We do not control these sites and are not responsible for their content, privacy practices, or any
        loss arising from your use of them.
      </p>

      <h2 style={{ marginTop: "2rem" }}>10. Disclaimer of warranties</h2>
      <p style={{ lineHeight: 1.7, textTransform: "none" }}>
        THE SITE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EXPRESS
        OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
        PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY. WE DO NOT WARRANT THAT THE SITE WILL BE
        UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY DEFECTS WILL BE CORRECTED.
      </p>

      <h2 style={{ marginTop: "2rem" }}>11. Limitation of liability</h2>
      <p style={{ lineHeight: 1.7 }}>
        To the maximum extent permitted by law, Scrapyards.io and its operators, employees, and contractors
        shall not be liable for any indirect, incidental, special, consequential, exemplary, or punitive
        damages, or for any loss of profits, revenue, data, or goodwill, arising out of or in connection with
        your use of or inability to use the Site, any prices or yard information shown, any User Submissions,
        or any third-party links or advertisements — even if we have been advised of the possibility of such
        damages. Our total aggregate liability to you for any claim arising from or related to the Site shall
        not exceed one hundred US dollars (US $100).
      </p>

      <h2 style={{ marginTop: "2rem" }}>12. Indemnification</h2>
      <p style={{ lineHeight: 1.7 }}>
        You agree to indemnify, defend, and hold harmless Scrapyards.io and its operators from and against
        any claims, liabilities, damages, losses, and expenses (including reasonable attorneys' fees) arising
        out of or in any way connected with your use of the Site, your User Submissions, or your violation of
        these Terms.
      </p>

      <h2 style={{ marginTop: "2rem" }}>13. Governing law and disputes</h2>
      <p style={{ lineHeight: 1.7 }}>
        These Terms are governed by the laws of the State of Delaware, USA, without regard to its
        conflict-of-law principles. Any dispute arising out of or relating to these Terms or the Site shall
        be resolved exclusively in the state or federal courts located in Delaware, and you consent to the
        personal jurisdiction of those courts. If any provision of these Terms is held unenforceable, the
        remaining provisions will remain in full force and effect.
      </p>

      <h2 style={{ marginTop: "2rem" }}>14. Changes to the Terms</h2>
      <p style={{ lineHeight: 1.7 }}>
        We may modify these Terms from time to time. Material changes will be reflected by updating the
        "Effective" date at the top of this page. Your continued use of the Site after changes constitutes
        acceptance of the updated Terms. If you do not agree to the changes, you must stop using the Site.
      </p>

      <h2 style={{ marginTop: "2rem" }}>15. Termination</h2>
      <p style={{ lineHeight: 1.7 }}>
        We may suspend or terminate your access to the Site at any time, for any reason or no reason,
        without notice. Sections that by their nature should survive termination (including disclaimers,
        limitation of liability, indemnification, intellectual property, and governing law) will survive.
      </p>

      <h2 style={{ marginTop: "2rem" }}>16. Contact</h2>
      <p style={{ lineHeight: 1.7 }}>
        Questions about these Terms: <a href="mailto:hello@scrapyards.io">hello@scrapyards.io</a> or visit
        our <Link href="/contact/">contact page</Link>.
      </p>
    </div>
  );
}
