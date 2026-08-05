import { Html, Head, Main, NextScript } from "next/document";
import { SITE_NAME } from "@/lib/siteMetadata";
import { PWA_THEME_COLOR } from "@/lib/pwaConstants";

const LEGACY_VISUAL_MODE_PURGE_SCRIPT = `(function(){try{var el=document.documentElement;el.removeAttribute("data-live-palette");el.removeAttribute("data-pulse-mode");el.removeAttribute("data-sea-flow");try{localStorage.removeItem("blz_live_palette_mode_v1");localStorage.removeItem("blz_pulse_mode_v1");localStorage.removeItem("blz_sea_flow_mode_v1");localStorage.removeItem("blz_sea_flow_intensity_v1");}catch(e){}for(var i=el.style.length-1;i>=0;i--){var p=el.style[i];if(p&&(p.indexOf("--sea-flow")===0||p.indexOf("--pulse-")===0)){el.style.removeProperty(p);}}var rm=window.matchMedia("(prefers-reduced-motion: reduce)").matches;el.setAttribute("data-reduced-motion",rm?"true":"false");}catch(e){}})();`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: LEGACY_VISUAL_MODE_PURGE_SCRIPT }} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="theme-color" content={PWA_THEME_COLOR} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
