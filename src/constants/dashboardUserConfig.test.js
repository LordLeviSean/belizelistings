/** @jest-environment node */

jest.mock("../lib/featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_INQUIRIES: true,
  BL_ENABLE_VIEWING_PERSIST: true,
}));

import {
  USER_DASHBOARD_TAB_IDS,
  getVisibleUserDashboardTabs,
  normalizeUserDashboardTab,
  resolveUserDashboardListingCap,
  formatUserListingLimitExhaustedMessage,
} from "./dashboardUserConfig";
import { PUBLIC_USER_ACTIVE_LISTING_CAP } from "./listingTierCaps";

describe("dashboardUserConfig communication tabs", () => {
  test("shows unified Inbox and Viewings for all CRM users", () => {
    const buyerIds = getVisibleUserDashboardTabs({ hasOwnedListings: false }).map((t) => t.id);
    expect(buyerIds).toContain(USER_DASHBOARD_TAB_IDS.INBOX);
    expect(buyerIds).toContain(USER_DASHBOARD_TAB_IDS.VIEWINGS);
    expect(buyerIds).not.toContain(USER_DASHBOARD_TAB_IDS.MESSAGES);
    expect(buyerIds).not.toContain(USER_DASHBOARD_TAB_IDS.MY_VIEWINGS);
  });

  test("owner users see same unified tabs without legacy owner labels", () => {
    const ownerIds = getVisibleUserDashboardTabs({ hasOwnedListings: true }).map((t) => t.id);
    expect(ownerIds).toContain(USER_DASHBOARD_TAB_IDS.INBOX);
    expect(ownerIds).toContain(USER_DASHBOARD_TAB_IDS.VIEWINGS);
    expect(ownerIds).not.toContain(USER_DASHBOARD_TAB_IDS.OWNER_INBOX);
    expect(ownerIds).not.toContain(USER_DASHBOARD_TAB_IDS.OWNER_VIEWINGS);
  });

  test("legacy tab URLs map to unified tabs", () => {
    expect(normalizeUserDashboardTab("messages")).toBe(USER_DASHBOARD_TAB_IDS.INBOX);
    expect(normalizeUserDashboardTab("owner-inbox")).toBe(USER_DASHBOARD_TAB_IDS.INBOX);
    expect(normalizeUserDashboardTab("my-viewings")).toBe(USER_DASHBOARD_TAB_IDS.VIEWINGS);
    expect(normalizeUserDashboardTab("owner-viewings")).toBe(USER_DASHBOARD_TAB_IDS.VIEWINGS);
    expect(normalizeUserDashboardTab("viewing-requests")).toBe(USER_DASHBOARD_TAB_IDS.VIEWINGS);
  });

  test("Inbox and Viewings tab labels", () => {
    const tabs = getVisibleUserDashboardTabs();
    expect(tabs.find((t) => t.id === USER_DASHBOARD_TAB_IDS.INBOX)?.label).toBe("Inbox");
    expect(tabs.find((t) => t.id === USER_DASHBOARD_TAB_IDS.VIEWINGS)?.label).toBe("Viewings");
  });
});

describe("dashboardUserConfig listing limit copy", () => {
  test("exhausted message uses canonical public user cap", () => {
    const cap = resolveUserDashboardListingCap("public");
    expect(cap).toBe(PUBLIC_USER_ACTIVE_LISTING_CAP);
    expect(formatUserListingLimitExhaustedMessage(cap)).toBe(
      "You have reached the maximum of 5 active listings for your account. Upgrade to an Agent account to publish up to 25 active listings and unlock professional tools."
    );
  });
});
