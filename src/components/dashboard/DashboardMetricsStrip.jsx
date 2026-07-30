import dashboardStyles from "@/styles/Dashboard.module.css";

/**
 * Shared KPI strip shell — primary row plus optional secondary row.
 */
export default function DashboardMetricsStrip({
  children,
  secondary = null,
  shellClassName = "",
  primaryGridClassName = "",
  secondaryGridClassName = "",
}) {
  const shell = shellClassName || dashboardStyles.operationalStatsShell;
  const primaryGrid = primaryGridClassName || dashboardStyles.operationalStatsGrid;
  const secondaryGrid =
    secondaryGridClassName ||
    `${dashboardStyles.operationalStatsGrid} ${dashboardStyles.operationalStatsGridSecondary}`;

  return (
    <div className={shell}>
      <div className={primaryGrid}>{children}</div>
      {secondary ? <div className={secondaryGrid}>{secondary}</div> : null}
    </div>
  );
}
