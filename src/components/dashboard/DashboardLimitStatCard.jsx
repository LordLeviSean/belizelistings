import dashboardStyles from "@/styles/Dashboard.module.css";

/**
 * Shared listing-limit KPI card for role dashboards.
 */
export default function DashboardLimitStatCard({
  label,
  valueText,
  exhausted,
  sublabel,
  sublabelAccessible,
  compact = false,
}) {
  const accessibleHint = sublabelAccessible || sublabel;
  return (
    <div
      className={`${dashboardStyles.operationalStatCard} ${dashboardStyles.operationalStatLimit} ${
        exhausted ? dashboardStyles.operationalStatLimitExhausted : ""
      } ${compact ? dashboardStyles.operationalStatLimitCompact : ""}`}
      role="group"
      aria-label={accessibleHint ? `${label}. ${accessibleHint}` : label}
    >
      <div className={dashboardStyles.operationalStatAccent} aria-hidden />
      <p className={dashboardStyles.operationalStatLabel}>{label}</p>
      <p className={dashboardStyles.operationalStatValue}>{valueText}</p>
      {sublabel ? (
        <p className={dashboardStyles.operationalStatSub} aria-hidden={Boolean(sublabelAccessible)}>
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}
