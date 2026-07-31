import { memo } from "react";
import DashboardMetricsStrip from "@/components/dashboard/DashboardMetricsStrip";
import DashboardOperationalStatCard from "@/components/dashboard/DashboardOperationalStatCard";
import dashboardStyles from "@/styles/Dashboard.module.css";

function AgentDashboardMetrics({
  activeListings,
  pendingListings,
  rejectedListings,
  archivedListings,
  draftListings,
  inquiriesCount,
  inquiriesUnavailable,
  onNavigateTab,
}) {
  const go = (tab) => {
    if (typeof onNavigateTab === "function") onNavigateTab(tab);
  };

  return (
    <DashboardMetricsStrip
      shellClassName={`${dashboardStyles.operationalStatsShell} ${dashboardStyles.userOperationalStatsShell}`}
      primaryGridClassName={`${dashboardStyles.operationalStatsGrid} ${dashboardStyles.userOperationalStatsGrid}`}
    >
      <DashboardOperationalStatCard
        label="Active Listings"
        value={activeListings}
        variant="Active"
        onClick={onNavigateTab ? () => go("listings") : undefined}
      />
      <DashboardOperationalStatCard
        label="Pending Approval"
        value={pendingListings}
        variant="Pending"
        onClick={onNavigateTab ? () => go("listings") : undefined}
      />
      <DashboardOperationalStatCard
        label="Rejected"
        value={rejectedListings}
        variant="Rejected"
        onClick={onNavigateTab ? () => go("listings") : undefined}
      />
      <DashboardOperationalStatCard
        label="Archived"
        value={archivedListings}
        variant="Archived"
        onClick={onNavigateTab ? () => go("listings") : undefined}
      />
      <DashboardOperationalStatCard
        label="Draft"
        value={draftListings}
        variant="Draft"
        onClick={onNavigateTab ? () => go("listings") : undefined}
      />
      <DashboardOperationalStatCard
        label="Inquiries"
        value={inquiriesCount}
        variant="Inquiries"
        unavailable={inquiriesUnavailable}
        unavailableDisplay="Coming soon"
        onClick={onNavigateTab ? () => go("inbox") : undefined}
      />
    </DashboardMetricsStrip>
  );
}

export default memo(AgentDashboardMetrics);
