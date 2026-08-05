import Link from "next/link";
import { DM_Sans } from "next/font/google";
import styles from "./SiteNavUnified.module.css";

const brandWordmarkFont = DM_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const BRAND_LETTERS = "BelizeListings".split("");
const BELIZE_END = 6;

/** Shared BelizeListings wordmark — static district palette, no visual-mode animation. */
export default function BrandWordmark({ href = "/", className = "" }) {
  return (
    <Link href={href} className={`${styles.brand} ${brandWordmarkFont.className} ${className}`.trim()}>
      <span aria-label="BelizeListings" className={styles.brandWordmark}>
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
