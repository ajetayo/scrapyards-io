/**
 * Server-rendered Google Analytics + AdSense bootstrap.
 *
 * Fires when shouldFireTracking() returns true:
 *   - sy_consent='all' (any region) → fire
 *   - sy_consent unset, region='opt-out', no GPC → fire (US default)
 *   - everything else (opt-in default, GPC, 'essential') → render nothing
 */
import Script from "next/script";
import { shouldFireTracking } from "../../lib/consent/server";

const GA_ID = "G-8NB364QEGZ";
const ADSENSE_CLIENT = "ca-pub-4183031888320028";

export async function Analytics() {
  if (!(await shouldFireTracking())) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { anonymize_ip: true });`}
      </Script>
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </>
  );
}
