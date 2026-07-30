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
import UserDashboardQuickActions from "./UserDashboardQuickActions";
import { partitionDashboardTabs } from "../../lib/dashboardTabGroups";
import dashboardStyles from "../../styles/Dashboard.module.css";
import {
  USER_DASHBOARD_TAB_IDS,
  getVisibleUserDashboardTabs,
  formatUserListingLimitExhaustedMessage,
  formatUserListingLimitExhaustedMessageCompact,
  resolveUserDashboardListingCap,
} from "../../constants/dashboardUserConfig";
import { PUBLIC_USER_ACTIVE_LISTING_CAP, AGENT_ACTIVE_LISTING_CAP } from "../../constants/listingTierCaps";

jest.mock("../../hooks/useCountUp", () => ({
  useCountUp: (value) => value,
}));

const USER_KPI_LABELS = [
  "Active Listings",
  "Pending Approval",
  "Saved Favorites",
  "Listing Limit Remaining",
  "Archived",
  "Draft",
  "Inquiries",
];

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

  test("compact stats strip renders all seven KPIs in one shared strip", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <UserDashboardMetrics
          activeListings={2}
          pendingListings={1}
          favoritesCount={4}
          inquiriesCount={3}
          archivedListings={1}
          draftListings={0}
          favoritesUnavailable={false}
          inquiriesUnavailable={false}
          listingRemainingLabel="3 Remaining"
          listingCap={PUBLIC_USER_ACTIVE_LISTING_CAP}
          limitExhausted={false}
        />
      );
    });

    const text = container.textContent;
    for (const label of USER_KPI_LABELS) {
      expect(text).toContain(label);
    }
    expect(container.querySelector(`.${dashboardStyles.userOperationalStatsGrid}`)).not.toBeNull();
    expect(container.querySelector(`.${dashboardStyles.operationalStatsGridSecondary}`)).toBeNull();
    expect(text).not.toContain("Total Listings");
    expect(text).not.toContain("Bulk Approve");
    act(() => root.unmount());
    container.remove();
  });

  test("listing limit exhausted copy stays role-aware for public users", () => {
    const cap = resolveUserDashboardListingCap("public");
    expect(formatUserListingLimitExhaustedMessage(cap)).toMatch(/maximum of 5 active listings/);
    expect(formatUserListingLimitExhaustedMessage(cap)).toMatch(/Agent account/);
    expect(formatUserListingLimitExhaustedMessageCompact(cap)).toBe(
      `Maximum ${PUBLIC_USER_ACTIVE_LISTING_CAP} active listings reached. Upgrade to Agent for up to ${AGENT_ACTIVE_LISTING_CAP}.`
    );
  });
});

describe("UserDashboardQuickActions", () => {
  function renderQuickActions(props = {}) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<UserDashboardQuickActions {...props} />);
    });
    return {
      container,
      unmount: () => {
        act(() => root.unmount());
        container.remove();
      },
    };
  }

  test("includes only permitted user actions with canonical routes", () => {
    const view = renderQuickActions({ createDisabled: false });
    const links = [...view.container.querySelectorAll("a")].map((a) => ({
      text: a.textContent.trim(),
      href: a.getAttribute("href"),
    }));

    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "Create Listing", href: "/dashboard/create" }),
        expect.objectContaining({ text: "Update Profile", href: "/dashboard/user?tab=profile" }),
        expect.objectContaining({ text: "View Saved Favorites", href: "/favorites" }),
        expect.objectContaining({ text: "Browse Listings", href: "/" }),
      ])
    );

    const text = view.container.textContent;
    expect(text).not.toMatch(/Marketplace Health|Bulk Approve|Create User/i);
    view.unmount();
  });

  test("disables Create Listing when at active listing limit", () => {
    const view = renderQuickActions({ createDisabled: true });
    const createButton = view.container.querySelector("button");
    expect(createButton).not.toBeNull();
    expect(createButton.disabled).toBe(true);
    expect(createButton.textContent).toContain("Create Listing");
    expect(view.container.querySelector('a[href="/dashboard/create"]')).toBeNull();
    view.unmount();
  });
});
