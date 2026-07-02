/** @jest-environment node */

jest.mock("../lib/featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_INQUIRIES: true,
  BL_ENABLE_VIEWING_PERSIST: true,
}));

import {
  USER_DASHBOARD_TAB_IDS,
  getVisibleUserDashboardTabs,
  userHasOwnedListings,
} from "./dashboardUserConfig";

describe("dashboardUserConfig owner parity", () => {
  test("userHasOwnedListings is false with zero lifecycle counts", () => {
    expect(userHasOwnedListings()).toBe(false);
    expect(userHasOwnedListings({ activeListings: 0, pendingListings: 0 })).toBe(false);
  });

  test("userHasOwnedListings is true when any listing lifecycle count is positive", () => {
    expect(userHasOwnedListings({ draftListings: 1 })).toBe(true);
    expect(userHasOwnedListings({ rejectedListings: 2 })).toBe(true);
  });

  test("getVisibleUserDashboardTabs hides owner tabs without owned listings", () => {
    const ids = getVisibleUserDashboardTabs({ hasOwnedListings: false }).map((t) => t.id);
    expect(ids).not.toContain(USER_DASHBOARD_TAB_IDS.OWNER_INBOX);
    expect(ids).not.toContain(USER_DASHBOARD_TAB_IDS.OWNER_VIEWINGS);
    expect(ids).toEqual(
      expect.arrayContaining([
        USER_DASHBOARD_TAB_IDS.MESSAGES,
        USER_DASHBOARD_TAB_IDS.MY_INQUIRIES,
        USER_DASHBOARD_TAB_IDS.MY_VIEWINGS,
      ])
    );
  });

  test("getVisibleUserDashboardTabs shows owner tabs when user owns listings and flags enabled", () => {
    const ids = getVisibleUserDashboardTabs({ hasOwnedListings: true }).map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        USER_DASHBOARD_TAB_IDS.OWNER_INBOX,
        USER_DASHBOARD_TAB_IDS.OWNER_VIEWINGS,
      ])
    );
  });
});
