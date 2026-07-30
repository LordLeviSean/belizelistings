/** @jest-environment jsdom */

jest.mock("../../lib/featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_INQUIRIES: true,
  BL_ENABLE_VIEWING_PERSIST: true,
}));

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import UserDashboardMetrics from "./UserDashboardMetrics";
import { partitionDashboardTabs } from "../../lib/dashboardTabGroups";
import {
  USER_DASHBOARD_TAB_IDS,
  getVisibleUserDashboardTabs,
  formatUserListingLimitExhaustedMessage,
  resolveUserDashboardListingCap,
} from "../../constants/dashboardUserConfig";
import { PUBLIC_USER_ACTIVE_LISTING_CAP } from "../../constants/listingTierCaps";

jest.mock("../../hooks/useCountUp", () => ({
  useCountUp: (value) => value,
}));

describe("user dashboard shared layout", () => {
  test("workspace and activity tabs partition cleanly for owners", () => {
    const tabs = getVisibleUserDashboardTabs({ hasOwnedListings: true });
    const { workspace, activity } = partitionDashboardTabs(tabs);
    const workspaceIds = workspace.map((tab) => tab.id);
    const activityIds = activity.map((tab) => tab.id);

    expect(workspaceIds).toEqual([
      USER_DASHBOARD_TAB_IDS.OVERVIEW,
      USER_DASHBOARD_TAB_IDS.MY_LISTINGS,
      USER_DASHBOARD_TAB_IDS.PENDING,
      USER_DASHBOARD_TAB_IDS.ARCHIVED,
      USER_DASHBOARD_TAB_IDS.SAVED_FAVORITES,
      USER_DASHBOARD_TAB_IDS.PROFILE,
    ]);
    expect(activityIds).toEqual([
      USER_DASHBOARD_TAB_IDS.INBOX,
      USER_DASHBOARD_TAB_IDS.VIEWINGS,
    ]);
  });

  test("user KPI strip includes limit card without admin-only metrics", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <UserDashboardMetrics
          activeListings={2}
          pendingListings={1}
          favoritesCount={4}
          inquiriesCount={0}
          archivedListings={0}
          draftListings={0}
          favoritesUnavailable={false}
          inquiriesUnavailable={false}
          listingRemainingLabel="3 remaining"
          listingCap={PUBLIC_USER_ACTIVE_LISTING_CAP}
          limitExhausted={false}
        />
      );
    });

    const text = container.textContent;
    expect(text).toContain("Active Listings");
    expect(text).toContain("Listing Limit Remaining");
    expect(text).toContain("3 remaining");
    expect(text).not.toContain("Total Listings");
    expect(text).not.toContain("Bulk Approve");
    act(() => root.unmount());
    container.remove();
  });

  test("listing limit exhausted copy stays role-aware for public users", () => {
    const cap = resolveUserDashboardListingCap("public");
    expect(formatUserListingLimitExhaustedMessage(cap)).toMatch(/maximum of 5 active listings/);
    expect(formatUserListingLimitExhaustedMessage(cap)).toMatch(/Agent account/);
  });
});
