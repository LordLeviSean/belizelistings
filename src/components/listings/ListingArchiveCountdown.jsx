import { useMemo } from "react";
import {
  formatListingArchiveCountdown,
  getListingArchiveDeadlineMs,
  shouldShowListingArchiveCountdown,
} from "../../lib/listings/listingArchiveCountdown";
import { useListingArchiveCountdownClock } from "../../lib/listings/useListingArchiveCountdownClock";
import styles from "./ListingArchiveCountdown.module.css";

/**
 * Live archive countdown for recently sold/rented management listings.
 * @param {{ listing: object, className?: string }} props
 */
export default function ListingArchiveCountdown({ listing, className = "" }) {
  const show = shouldShowListingArchiveCountdown(listing);
  const deadlineMs = show ? getListingArchiveDeadlineMs(listing) : null;
  const nowMs = useListingArchiveCountdownClock(deadlineMs);

  const formatted = useMemo(
    () => (deadlineMs != null ? formatListingArchiveCountdown(deadlineMs, nowMs) : null),
    [deadlineMs, nowMs]
  );

  if (!show || !formatted) {
    if (process.env.NODE_ENV === "development" && show && deadlineMs == null) {
      console.warn("[ListingArchiveCountdown] missing canonical closed timestamp", {
        listingId: listing?.id ?? null,
      });
    }
    return null;
  }

  return (
    <span
      className={[styles.listingArchiveCountdown, className].filter(Boolean).join(" ")}
      title={formatted.ariaLabel}
      aria-label={formatted.ariaLabel}
    >
      {formatted.short}
    </span>
  );
}
