import Link from "next/link";
import { DM_Sans } from "next/font/google";
import { useVisualMode } from "./VisualModeProvider";
import styles from "./SiteNavUnified.module.css";

const brandWordmarkFont = DM_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const BRAND_LETTERS = "BelizeListings".split("");
const BELIZE_END = 6;

/**
 * Shared BelizeListings wordmark — Live Palette and Pulse modes apply everywhere
 * this component is mounted (via VisualModeProvider + SiteNav).
 */
export default function BrandWordmark({ href = "/", className = "" }) {
  const { livePalette, pulse } = useVisualMode();

  return (
    <Link href={href} className={`${styles.brand} ${brandWordmarkFont.className} ${className}`.trim()}>
      <span
        aria-label="BelizeListings"
        className={styles.brandWordmark}
        data-live={livePalette ? "true" : "false"}
        data-pulse={pulse ? "true" : "false"}
      >
        {BRAND_LETTERS.map((ch, i) => (
          <span
            key={`${ch}-${i}`}
            className={`${styles.brandLetter} ${
              i < BELIZE_END ? styles.brandLetterBelize : styles.brandLetterListings
            }`}
          >
            {ch}
          </span>
        ))}
      </span>
    </Link>
  );
}
