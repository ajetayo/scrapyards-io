import Script from "next/script";
import { cookies } from "next/headers";

const GA_ID = "G-8NB364QEGZ";
const ADSENSE_CLIENT = "ca-pub-4183031888320028";

export async function Analytics() {
  const c = await cookies();
  const consent = c.get("sy_consent")?.value;
  if (consent !== "all") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
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
