import { memo } from "react";
import DashboardLimitStatCard from "@/components/dashboard/DashboardLimitStatCard";
import DashboardMetricsStrip from "@/components/dashboard/DashboardMetricsStrip";
import DashboardOperationalStatCard from "@/components/dashboard/DashboardOperationalStatCard";
import {
  AGENT_DASHBOARD_COPY,
  formatAgentListingLimitExhaustedMessage,
} from "@/constants/dashboardAgentConfig";

function AgentDashboardMetrics({
  activeListings,
  pendingListings,
  rejectedListings,
  archivedListings,
  draftListings,
  inquiriesCount,
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
            onClick={onNavigateTab ? () => go("inquiries") : undefined}
          />
        </>
      }
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
      <DashboardLimitStatCard
        label="Listing Limit Remaining"
        valueText={listingRemainingLabel}
        exhausted={limitExhausted}
        sublabel={
          limitExhausted
            ? formatAgentListingLimitExhaustedMessage(listingCap)
            : AGENT_DASHBOARD_COPY.listingLimitSubtext
        }
      />
    </DashboardMetricsStrip>
  );
}

export default memo(AgentDashboardMetrics);
