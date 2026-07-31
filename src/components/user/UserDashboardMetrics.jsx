import { memo } from "react";
import DashboardMetricsStrip from "@/components/dashboard/DashboardMetricsStrip";
import DashboardOperationalStatCard from "@/components/dashboard/DashboardOperationalStatCard";
import { USER_DASHBOARD_COPY } from "@/constants/dashboardUserConfig";
import dashboardStyles from "@/styles/Dashboard.module.css";

function UserDashboardMetrics({
  activeListings,
  pendingListings,
  favoritesCount,
  inquiriesCount,
  archivedListings,
  draftListings,
  favoritesUnavailable,
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
        onClick={onNavigateTab ? () => go("my-listings") : undefined}
      />
      <DashboardOperationalStatCard
        label="Pending Approval"
        value={pendingListings}
        variant="Pending"
        onClick={onNavigateTab ? () => go("pending") : undefined}
      />
      <DashboardOperationalStatCard
        label="Saved Favorites"
        value={favoritesCount}
        variant="Favorites"
        unavailable={favoritesUnavailable}
        onClick={onNavigateTab ? () => go("saved-favorites") : undefined}
      />
      <DashboardOperationalStatCard
        label="Archived"
        value={archivedListings}
        variant="Archived"
        onClick={onNavigateTab ? () => go("archived") : undefined}
      />
      <DashboardOperationalStatCard
        label="Draft"
        value={draftListings}
        variant="Draft"
        onClick={onNavigateTab ? () => go("my-listings") : undefined}
      />
      <DashboardOperationalStatCard
        label="Inquiries"
        value={inquiriesCount}
        variant="Inquiries"
        unavailable={inquiriesUnavailable}
        unavailableDisplay={USER_DASHBOARD_COPY.inquiriesComingSoon}
      />
    </DashboardMetricsStrip>
  );
}

export default memo(UserDashboardMetrics);
