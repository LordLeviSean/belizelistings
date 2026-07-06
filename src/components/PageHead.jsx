import Head from "next/head";
import { PAGE_TITLES, SITE_NAME, SITE_TAGLINE } from "@/lib/siteMetadata";

const THEME_COLOR = "#ffffff";

/**
 * Single head entry point — avoids duplicate title/meta tags across pages.
 * @param {{ title?: string, description?: string }} props
 */
export default function PageHead({
  title = PAGE_TITLES.home,
  description = SITE_TAGLINE,
}) {
  const documentTitle = String(title || "").trim() || SITE_NAME;
  const metaDescription = String(description || "").trim() || SITE_TAGLINE;

  return (
    <Head>
      <title>{documentTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="application-name" content={SITE_NAME} />
      <meta name="theme-color" content={THEME_COLOR} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={documentTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta name="twitter:title" content={documentTitle} />
      <meta name="twitter:description" content={metaDescription} />
    </Head>
  );
}
