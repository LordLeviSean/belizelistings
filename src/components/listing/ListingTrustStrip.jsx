import { buildPublicListingTrustChips } from "@/utils/trustSignals";
import styles from "./ListingTrustStrip.module.css";

export default function ListingTrustStrip({ listing }) {
  const chips = buildPublicListingTrustChips(listing);
  if (!chips.length) return null;

  return (
    <ul className={styles.strip} aria-label="Trust signals">
      {chips.map((c) => (
        <li key={c.key} className={styles.chip}>
          {c.label}
        </li>
      ))}
    </ul>
  );
}
