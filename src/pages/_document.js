import { Html, Head, Main, NextScript } from "next/document";
import { SITE_NAME } from "@/lib/siteMetadata";
import { PWA_THEME_COLOR } from "@/lib/pwaConstants";
import { getVisualModeBootstrapScript } from "@/lib/visualModeDocument";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: getVisualModeBootstrapScript() }} />
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
