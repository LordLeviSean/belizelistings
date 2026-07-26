import ListingArchiveCountdown from "./ListingArchiveCountdown";

/**
 * Sold/Rented badge with optional archive countdown for management surfaces.
 * @param {{
 *   listing: object,
 *   badgeLabel: string,
 *   badgeClass: string,
 *   styles: Record<string, string>,
 * }} props
 */
export default function ListingLifecycleBadgeStack({ listing, badgeLabel, badgeClass, styles }) {
  return (
    <div className={styles.listingBadgeStack}>
      <span className={`${styles.statusBadge} ${styles[`status${badgeClass}`]}`}>{badgeLabel}</span>
      <ListingArchiveCountdown listing={listing} />
    </div>
  );
}
