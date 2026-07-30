/** @jest-environment jsdom */

jest.mock("../../lib/featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_INQUIRIES: true,
  BL_ENABLE_VIEWING_PERSIST: true,
}));

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import AgentDashboardMetrics from "../agent/AgentDashboardMetrics";
import { partitionDashboardTabs } from "../../lib/dashboardTabGroups";
import {
  AGENT_DASHBOARD_TAB_IDS,
  AGENT_DASHBOARD_TABS,
  formatAgentListingLimitExhaustedMessage,
} from "../../constants/dashboardAgentConfig";
import { AGENT_ACTIVE_LISTING_CAP } from "../../constants/listingTierCaps";

jest.mock("../../hooks/useCountUp", () => ({
  useCountUp: (value) => value,
}));

describe("agent dashboard shared layout", () => {
  test("agent tabs partition into workspace and activity groups", () => {
    const { workspace, activity } = partitionDashboardTabs(AGENT_DASHBOARD_TABS);
    expect(workspace.map((tab) => tab.id)).toContain(AGENT_DASHBOARD_TAB_IDS.OVERVIEW);
    expect(workspace.map((tab) => tab.id)).toContain(AGENT_DASHBOARD_TAB_IDS.LISTINGS);
    expect(activity.map((tab) => tab.id)).toContain(AGENT_DASHBOARD_TAB_IDS.INBOX);
    expect(activity.map((tab) => tab.id)).toContain(AGENT_DASHBOARD_TAB_IDS.VIEWINGS);
  });

  test("agent KPI strip uses agent metrics without admin controls", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <AgentDashboardMetrics
          activeListings={8}
          pendingListings={2}
          rejectedListings={1}
          archivedListings={3}
          draftListings={0}
          inquiriesCount={4}
          inquiriesUnavailable={false}
          listingRemainingLabel="17 remaining"
          listingCap={AGENT_ACTIVE_LISTING_CAP}
          limitExhausted={false}
        />
      );
    });

    const text = container.textContent;
    expect(text).toContain("Active Listings");
    expect(text).toContain("Rejected");
    expect(text).toContain("Listing Limit Remaining");
    expect(text).not.toContain("Users");
    expect(text).not.toContain("Bulk Approve");
    expect(text).not.toContain("Marketplace Health");
    act(() => root.unmount());
    container.remove();
  });

  test("agent listing limit exhausted copy references agent cap", () => {
    expect(formatAgentListingLimitExhaustedMessage(AGENT_ACTIVE_LISTING_CAP)).toMatch(/25 active listings/);
  });
});
