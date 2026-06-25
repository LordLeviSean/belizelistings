import { BadgeCheck } from "lucide-react";
import { buildPublicListingTrustChips } from "@/utils/trustSignals";
import { isListingCardVerified } from "@/utils/listingVerification";
import styles from "./ListingTrustStrip.module.css";

export default function ListingTrustStrip({ listing }) {
  const statusChips = buildPublicListingTrustChips(listing);
  const isVerified = isListingCardVerified(listing);
  const hasContent = isVerified || statusChips.length > 0;

  if (!hasContent) return null;

  return (
    <div className={styles.wrap} aria-label="Listing trust and status">
      {isVerified ? (
        <div className={styles.trustRow}>
          <span className={styles.verifiedBadge}>
            <BadgeCheck size={13} strokeWidth={2.25} aria-hidden />
            Verified Listing
          </span>
        </div>
      ) : null}

      {statusChips.length > 0 ? (
        <ul className={styles.statusStrip} aria-label="Listing status">
          {statusChips.map((c) => (
            <li key={c.key} className={styles.statusChip}>
              {c.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
