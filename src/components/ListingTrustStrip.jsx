import {
  ACTIVITY_SIGNAL_TYPES,
  VERIFICATION_STATUS,
} from "../constants/trustModel";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";
import {
  getListingTrustSnapshot,
  getRelativeTimeLabel,
  getStaleInventoryState,
} from "../utils/trustSignals";
import { getLifecycleStatus } from "../utils/canonicalListing";
import { getLifecycleLabel } from "../constants/operationalModel";
import styles from "./ListingTrustStrip.module.css";

function getVerificationText(status) {
  if (status === VERIFICATION_STATUS.VERIFIED) return "Verified";
  if (status === VERIFICATION_STATUS.PENDING) return "Verification Pending";
  if (status === VERIFICATION_STATUS.REVOKED) return "Verification Revoked";
  return "Unverified";
}

const VARIANT_PRIORITY = {
  pending: [
    "Pending Review",
    "Needs Review",
    "Verification Pending",
    "Verification Revoked",
    "Verified",
    "Updated ",
    "Fresh Inventory",
    "Newly Approved",
    "Recently Verified",
    "Sold",
    "Rented",
    "Archived",
    "Expired",
  ],
  operator: [
    "Needs Review",
    "Aging Inventory",
    "Rented",
    "Sold",
    "Pending Review",
    "Verification Revoked",
    "Verification Pending",
    "Verified",
    "Fresh Inventory",
    "Updated ",
    "Recently Verified",
    "Newly Approved",
    "Archived",
    "Expired",
  ],
  admin: [
    "Needs Review",
    "Pending Review",
    "Verification Revoked",
    "Verification Pending",
    "Verified",
    "Rented",
    "Sold",
    "Fresh Inventory",
    "Updated ",
    "Recently Verified",
    "Newly Approved",
    "Aging Inventory",
    "Archived",
    "Expired",
  ],
};

function toneForLifecycle(lifecycle) {
  if (lifecycle === LISTING_LIFECYCLE.ARCHIVED) return "archived";
  if (lifecycle === LISTING_LIFECYCLE.PENDING_REVIEW) return "pending";
  if (lifecycle === LISTING_LIFECYCLE.PUBLISHED) return "verified";
  if (lifecycle === LISTING_LIFECYCLE.RECENTLY_SOLD) return "recentlySold";
  if (lifecycle === LISTING_LIFECYCLE.RECENTLY_RENTED) return "recentlyRented";
  if (lifecycle === LISTING_LIFECYCLE.REJECTED) return "stale";
  if (lifecycle === LISTING_LIFECYCLE.EXPIRED) return "expired";
  return "";
}

export default function ListingTrustStrip({ listing, variant = "admin", mode = "rich" }) {
  const effectiveLifecycle = getLifecycleStatus(listing || {});
  if (mode === "single") {
    const label = getLifecycleLabel(effectiveLifecycle);
    const tone = toneForLifecycle(effectiveLifecycle);
    return (
      <div className={styles.strip}>
        <span className={`${styles.chip} ${tone ? styles[tone] : ""}`}>{label}</span>
      </div>
    );
  }

  const snapshot = getListingTrustSnapshot(listing || {});
  const lifecycle = effectiveLifecycle;
  const stale = getStaleInventoryState(listing || {});
  const verifiedAt = listing?.verified_at || listing?.verification_at;
  const updatedText = getRelativeTimeLabel(listing?.updated_at || listing?.created_at);
  const verifiedText = getRelativeTimeLabel(verifiedAt);

  const chips = [];
  const hasSignal = (type) => snapshot.activitySignals.includes(type);

  chips.push({
    label: getVerificationText(snapshot.verificationStatus),
    tone:
      snapshot.verificationStatus === VERIFICATION_STATUS.VERIFIED
        ? "verified"
        : snapshot.verificationStatus === VERIFICATION_STATUS.PENDING
          ? "pending"
          : "",
  });
  if (snapshot.verificationStatus === VERIFICATION_STATUS.VERIFIED && verifiedAt) {
    chips.push({ label: `Verified ${verifiedText}`, tone: "verified" });
  }
  if (snapshot.verificationStatus === VERIFICATION_STATUS.REVOKED) {
    chips.push({ label: "Verification Revoked", tone: "stale" });
  }

  if (lifecycle === LISTING_LIFECYCLE.PENDING_REVIEW) {
    chips.push({ label: "Pending Review", tone: "pending" });
  }
  if (lifecycle === LISTING_LIFECYCLE.ARCHIVED) {
    chips.push({ label: "Archived", tone: "archived" });
  }
  if (lifecycle === LISTING_LIFECYCLE.EXPIRED) {
    chips.push({ label: "Expired", tone: "expired" });
  }

  if (hasSignal(ACTIVITY_SIGNAL_TYPES.UPDATED_TODAY)) {
    chips.push({ label: `Updated ${updatedText}`, tone: "fresh" });
  } else {
    chips.push({ label: `Updated ${updatedText}`, tone: "" });
  }

  if (hasSignal(ACTIVITY_SIGNAL_TYPES.FRESH_INVENTORY)) {
    chips.push({ label: "Fresh Inventory", tone: "fresh" });
  }
  if (hasSignal(ACTIVITY_SIGNAL_TYPES.RECENTLY_VERIFIED)) {
    chips.push({ label: "Recently Verified", tone: "verified" });
  }
  if (hasSignal(ACTIVITY_SIGNAL_TYPES.RECENTLY_RENTED)) {
    chips.push({ label: "Rented", tone: "recentlyRented" });
  }
  if (hasSignal(ACTIVITY_SIGNAL_TYPES.RECENTLY_SOLD)) {
    chips.push({ label: "Sold", tone: "recentlySold" });
  }
  if (hasSignal(ACTIVITY_SIGNAL_TYPES.NEWLY_APPROVED)) {
    chips.push({ label: "Newly Approved", tone: "fresh" });
  }

  if (stale.isStale) {
    chips.push({ label: "Needs Review", tone: "stale" });
  } else if (stale.isAging) {
    chips.push({ label: "Aging Inventory", tone: "stale" });
  }

  const priority = VARIANT_PRIORITY[variant] || VARIANT_PRIORITY.admin;
  const priorityIndex = (label) => {
    const found = priority.findIndex((item) => label.startsWith(item));
    return found === -1 ? 999 : found;
  };
  const uniqueChips = [];
  const seen = new Set();
  for (const chip of chips) {
    const key = chip.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueChips.push(chip);
  }
  uniqueChips.sort((a, b) => priorityIndex(a.label) - priorityIndex(b.label));

  return (
    <div className={styles.strip}>
      {uniqueChips.slice(0, 5).map((chip) => (
        <span
          key={`${chip.label}-${chip.tone}`}
          className={`${styles.chip} ${chip.tone ? styles[chip.tone] : ""}`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

