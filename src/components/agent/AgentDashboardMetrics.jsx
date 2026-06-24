import { memo } from "react";
import { useCountUp } from "@/hooks/useCountUp";
import { AGENT_DASHBOARD_COPY } from "@/constants/dashboardAgentConfig";
import styles from "@/styles/Dashboard.module.css";

function NumericStatCard({ label, value, variant, sublabel, unavailable, unavailableDisplay = "—", onClick }) {
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

function AgentDashboardMetrics({
  activeListings,
  pendingListings,
  rejectedListings,
  archivedListings,
  draftListings,
  inquiriesCount,
  inquiriesUnavailable,
  listingRemainingLabel,
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
          onClick={onNavigateTab ? () => go("listings") : undefined}
        />
        <NumericStatCard
          label="Pending Approval"
          value={pendingListings}
          variant="Pending"
          onClick={onNavigateTab ? () => go("listings") : undefined}
        />
        <NumericStatCard
          label="Rejected"
          value={rejectedListings}
          variant="Rejected"
          onClick={onNavigateTab ? () => go("listings") : undefined}
        />
        <LimitStatCard
          label="Listing Limit Remaining"
          valueText={listingRemainingLabel}
          exhausted={limitExhausted}
          sublabel={
            limitExhausted
              ? "Archive a listing to free a slot before restoring another."
              : AGENT_DASHBOARD_COPY.listingLimitSubtext
          }
        />
      </div>

      <div className={`${styles.operationalStatsGrid} ${styles.operationalStatsGridSecondary}`}>
        <NumericStatCard
          label="Archived"
          value={archivedListings}
          variant="Archived"
          onClick={onNavigateTab ? () => go("listings") : undefined}
        />
        <NumericStatCard
          label="Draft"
          value={draftListings}
          variant="Draft"
          onClick={onNavigateTab ? () => go("listings") : undefined}
        />
        <NumericStatCard
          label="Inquiries"
          value={inquiriesCount}
          variant="Inquiries"
          unavailable={inquiriesUnavailable}
          unavailableDisplay="Coming soon"
          onClick={onNavigateTab ? () => go("inquiries") : undefined}
        />
      </div>
    </div>
  );
}

export default memo(AgentDashboardMetrics);
