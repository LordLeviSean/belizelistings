import { getLifecycleLabel, normalizeLifecycleStatus } from "../constants/operationalModel";
import {
  ACTIVITY_SIGNAL_TYPES,
  VERIFICATION_STATUS,
} from "../constants/trustModel";
import { getListingTrustSnapshot } from "../utils/trustSignals";
import { getLifecycleTimestamps } from "../utils/listingOperationalMeta";
import styles from "../styles/Dashboard.module.css";

function toRelative(date) {
  if (!date) return "No activity timestamp";
  const ms = Date.now() - date.getTime();
  if (ms < 60 * 1000) return "Updated just now";
  if (ms < 60 * 60 * 1000) return `Updated ${Math.floor(ms / 60000)}m ago`;
  if (ms < 24 * 60 * 60 * 1000) return `Updated ${Math.floor(ms / 3600000)}h ago`;
  return `Updated ${Math.floor(ms / 86400000)}d ago`;
}

export default function TrustMetadataStrip({ listing, compact = false }) {
  const snapshot = getListingTrustSnapshot(listing || {});
  const timestamps = getLifecycleTimestamps(listing || {});
  const lifecycle = normalizeLifecycleStatus(listing?.status);
  const verification = snapshot.verificationStatus || VERIFICATION_STATUS.UNVERIFIED;
  const updatedAnchor =
    timestamps.updatedAt || timestamps.reviewedAt || timestamps.publishedAt || timestamps.createdAt;
  const daysSinceUpdate = updatedAnchor
    ? Math.floor((Date.now() - updatedAnchor.getTime()) / 86400000)
    : Number.POSITIVE_INFINITY;
  const needsReview = lifecycle === "pending" && daysSinceUpdate > 7;
  const staleInventory = lifecycle === "approved" && daysSinceUpdate > 45;

  const chips = [];
  chips.push({
    label: getLifecycleLabel(lifecycle),
    tone:
      lifecycle === "archived"
        ? "muted"
        : lifecycle === "pending"
          ? "pending"
          : lifecycle === "approved"
            ? "fresh"
            : "default",
  });

  if (verification === VERIFICATION_STATUS.VERIFIED) {
    chips.push({ label: "Verified", tone: "verified" });
  } else if (verification === VERIFICATION_STATUS.PENDING) {
    chips.push({ label: "Verify Pending", tone: "pending" });
  } else if (verification === VERIFICATION_STATUS.REVOKED) {
    chips.push({ label: "Verification Revoked", tone: "transaction" });
  } else {
    chips.push({ label: "Unverified", tone: "muted" });
  }

  if (snapshot.activitySignals.includes(ACTIVITY_SIGNAL_TYPES.UPDATED_TODAY)) {
    chips.push({ label: "Updated Today", tone: "fresh" });
  }
  if (snapshot.activitySignals.includes(ACTIVITY_SIGNAL_TYPES.FRESH_INVENTORY)) {
    chips.push({ label: "Fresh Inventory", tone: "fresh" });
  }
  if (
    snapshot.activitySignals.includes(ACTIVITY_SIGNAL_TYPES.RECENTLY_RENTED) ||
    snapshot.activitySignals.includes(ACTIVITY_SIGNAL_TYPES.RECENTLY_SOLD)
  ) {
    chips.push({ label: "Recent Transaction", tone: "transaction" });
  }
  if (needsReview) chips.push({ label: "Needs Review", tone: "pending" });
  if (staleInventory) chips.push({ label: "Stale Inventory", tone: "muted" });

  const visibleChips = compact ? chips.slice(0, 3) : chips.slice(0, 4);

  return (
    <div className={styles.trustMetaWrap}>
      <div className={styles.trustMetaStrip}>
        {visibleChips.map((chip) => (
          <span
            key={`${chip.label}-${chip.tone}`}
            className={`${styles.trustMetaChip} ${styles[`trustMetaChip${chip.tone.charAt(0).toUpperCase()}${chip.tone.slice(1)}`]}`}
          >
            {chip.label}
          </span>
        ))}
      </div>
      <p className={styles.trustMetaTimestamp}>{toRelative(updatedAnchor)}</p>
    </div>
  );
}

