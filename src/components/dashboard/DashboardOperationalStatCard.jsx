import { useCountUp } from "@/hooks/useCountUp";
import dashboardStyles from "@/styles/Dashboard.module.css";

/**
 * Shared numeric KPI card for role dashboards.
 */
export default function DashboardOperationalStatCard({
  label,
  value,
  variant,
  sublabel,
  unavailable = false,
  unavailableDisplay = "—",
  onClick,
}) {
  const animated = useCountUp(typeof value === "number" ? value : 0);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`${dashboardStyles.operationalStatCard} ${
        dashboardStyles[`operationalStat${variant}`] || ""
      } ${onClick ? dashboardStyles.operationalStatClickable : ""}`}
      role="group"
      aria-label={label}
      onClick={onClick}
    >
      <div className={dashboardStyles.operationalStatAccent} aria-hidden />
      <p className={dashboardStyles.operationalStatLabel}>{label}</p>
      <p className={dashboardStyles.operationalStatValue}>
        {unavailable ? unavailableDisplay : animated}
      </p>
      {sublabel ? <p className={dashboardStyles.operationalStatSub}>{sublabel}</p> : null}
    </Tag>
  );
}
