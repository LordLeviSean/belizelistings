import dashboardStyles from "@/styles/Dashboard.module.css";

/**
 * Shared listing-limit KPI card for role dashboards.
 */
export default function DashboardLimitStatCard({ label, valueText, exhausted, sublabel }) {
  return (
    <div
      className={`${dashboardStyles.operationalStatCard} ${dashboardStyles.operationalStatLimit} ${
        exhausted ? dashboardStyles.operationalStatLimitExhausted : ""
      }`}
      role="group"
      aria-label={label}
    >
      <div className={dashboardStyles.operationalStatAccent} aria-hidden />
      <p className={dashboardStyles.operationalStatLabel}>{label}</p>
      <p className={dashboardStyles.operationalStatValue}>{valueText}</p>
      {sublabel ? <p className={dashboardStyles.operationalStatSub}>{sublabel}</p> : null}
    </div>
  );
}
