import { memo } from "react";
import { useCountUp } from "@/hooks/useCountUp";
import {
  USER_DASHBOARD_COPY,
  formatUserListingLimitExhaustedMessage,
} from "@/constants/dashboardUserConfig";
import styles from "@/styles/Dashboard.module.css";

function NumericStatCard({
  label,
  value,
  variant,
  sublabel,
  unavailable,
  unavailableDisplay = "—",
  onClick,
}) {
  const animated = useCountUp(typeof value === "number" ? value : 0);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`${styles.operationalStatCard} ${styles[`operationalStat${variant}`] || ""} ${
        onClick ? styles.operationalStatClickable : ""
      }`}
      role="group"
      aria-label={label}
      onClick={onClick}
    >
      <div className={styles.operationalStatAccent} aria-hidden />
      <p className={styles.operationalStatLabel}>{label}</p>
      <p className={styles.operationalStatValue}>{unavailable ? unavailableDisplay : animated}</p>
      {sublabel ? <p className={styles.operationalStatSub}>{sublabel}</p> : null}
    </Tag>
  );
}

function LimitStatCard({ label, valueText, exhausted, sublabel }) {
  return (
    <div
      className={`${styles.operationalStatCard} ${styles.operationalStatLimit} ${
        exhausted ? styles.operationalStatLimitExhausted : ""
      }`}
      role="group"
      aria-label={label}
    >
      <div className={styles.operationalStatAccent} aria-hidden />
      <p className={styles.operationalStatLabel}>{label}</p>
      <p className={styles.operationalStatValue}>{valueText}</p>
      {sublabel ? <p className={styles.operationalStatSub}>{sublabel}</p> : null}
    </div>
  );
}

function UserDashboardMetrics({
  activeListings,
  pendingListings,
  favoritesCount,
  inquiriesCount,
  archivedListings,
  draftListings,
  favoritesUnavailable,
  inquiriesUnavailable,
  listingRemainingLabel,
  listingCap,
  limitExhausted,
  onNavigateTab,
}) {
  const go = (tab) => {
    if (typeof onNavigateTab === "function") onNavigateTab(tab);
  };

  return (
    <div className={styles.operationalStatsShell}>
      <div className={styles.operationalStatsGrid}>
        <NumericStatCard
          label="Active Listings"
          value={activeListings}
          variant="Active"
          onClick={onNavigateTab ? () => go("my-listings") : undefined}
        />
        <NumericStatCard
          label="Pending Approval"
          value={pendingListings}
          variant="Pending"
          onClick={onNavigateTab ? () => go("pending") : undefined}
        />
        <NumericStatCard
          label="Saved Favorites"
          value={favoritesCount}
          variant="Favorites"
          unavailable={favoritesUnavailable}
          onClick={onNavigateTab ? () => go("saved-favorites") : undefined}
        />
        <LimitStatCard
          label="Listing Limit Remaining"
          valueText={listingRemainingLabel}
          exhausted={limitExhausted}
          sublabel={
            limitExhausted
              ? formatUserListingLimitExhaustedMessage(listingCap)
              : USER_DASHBOARD_COPY.listingLimitSubtext
          }
        />
      </div>

      <div className={`${styles.operationalStatsGrid} ${styles.operationalStatsGridSecondary}`}>
        <NumericStatCard
          label="Archived"
          value={archivedListings}
          variant="Archived"
          onClick={onNavigateTab ? () => go("archived") : undefined}
        />
        <NumericStatCard
          label="Draft"
          value={draftListings}
          variant="Draft"
          onClick={onNavigateTab ? () => go("my-listings") : undefined}
        />
        <NumericStatCard
          label="Inquiries"
          value={inquiriesCount}
          variant="Inquiries"
          unavailable={inquiriesUnavailable}
          unavailableDisplay={USER_DASHBOARD_COPY.inquiriesComingSoon}
        />
      </div>
    </div>
  );
}

export default memo(UserDashboardMetrics);
