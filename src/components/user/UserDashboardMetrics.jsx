import { memo } from "react";
import DashboardLimitStatCard from "@/components/dashboard/DashboardLimitStatCard";
import DashboardMetricsStrip from "@/components/dashboard/DashboardMetricsStrip";
import DashboardOperationalStatCard from "@/components/dashboard/DashboardOperationalStatCard";
import {
  USER_DASHBOARD_COPY,
  formatUserListingLimitExhaustedMessage,
} from "@/constants/dashboardUserConfig";

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
    <DashboardMetricsStrip
      secondary={
        <>
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
        </>
      }
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
      <DashboardLimitStatCard
        label="Listing Limit Remaining"
        valueText={listingRemainingLabel}
        exhausted={limitExhausted}
        sublabel={
          limitExhausted
            ? formatUserListingLimitExhaustedMessage(listingCap)
            : USER_DASHBOARD_COPY.listingLimitSubtext
        }
      />
    </DashboardMetricsStrip>
  );
}

export default memo(UserDashboardMetrics);
