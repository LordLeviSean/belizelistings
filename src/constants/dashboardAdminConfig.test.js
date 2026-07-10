/** @jest-environment node */

jest.mock("../lib/featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_INQUIRIES: true,
  BL_ENABLE_VIEWING_PERSIST: true,
}));

import {
  ADMIN_DASHBOARD_TAB_IDS,
  getVisibleAdminDashboardTabs,
  normalizeAdminDashboardTab,
  resolveVisibleAdminDashboardTab,
} from "./dashboardAdminConfig";

describe("dashboardAdminConfig", () => {
  test("normalizeAdminDashboardTab falls back to pending for unknown ids", () => {
    expect(normalizeAdminDashboardTab("")).toBe(ADMIN_DASHBOARD_TAB_IDS.PENDING);
    expect(normalizeAdminDashboardTab("not-a-tab")).toBe(ADMIN_DASHBOARD_TAB_IDS.PENDING);
    expect(normalizeAdminDashboardTab("listings")).toBe(ADMIN_DASHBOARD_TAB_IDS.LISTINGS);
  });

  test("resolveVisibleAdminDashboardTab keeps visible operational tabs", () => {
    const visible = getVisibleAdminDashboardTabs();
    expect(resolveVisibleAdminDashboardTab("users", visible)).toBe(ADMIN_DASHBOARD_TAB_IDS.USERS);
  });

  test("resolveVisibleAdminDashboardTab falls back when CRM tab is not visible", () => {
    const operationalOnly = getVisibleAdminDashboardTabs().filter((tab) => tab.operational);
    expect(resolveVisibleAdminDashboardTab("messages", operationalOnly)).toBe(
      operationalOnly[0]?.id ?? ADMIN_DASHBOARD_TAB_IDS.PENDING
    );
  });
});
