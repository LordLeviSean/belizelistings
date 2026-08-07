/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_INQUIRIES: true,
  BL_ENABLE_VIEWING_PERSIST: true,
  BL_ENABLE_NOTIFICATIONS: true,
}));

import fs from "node:fs";
import path from "node:path";
import {
  ADMIN_DASHBOARD_TAB_IDS,
  getVisibleAdminDashboardTabs,
  resolveVisibleAdminDashboardTab,
} from "../../constants/dashboardAdminConfig";
import { resolveAdminDashboardTabFromQuery } from "../dashboardCrmRoutes";
import { buildProfileContactPayload } from "../profileContactMutations";

const repoRoot = path.resolve(__dirname, "../../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("admin profile dashboard parity", () => {
  test("Profile is included in visible admin dashboard tabs", () => {
    const tabs = getVisibleAdminDashboardTabs();
    expect(tabs.map((tab) => tab.id)).toEqual(
      expect.arrayContaining([ADMIN_DASHBOARD_TAB_IDS.PROFILE])
    );
    const profileTab = tabs.find((tab) => tab.id === ADMIN_DASHBOARD_TAB_IDS.PROFILE);
    expect(profileTab?.label).toBe("Profile");
    expect(profileTab?.operational).toBe(true);
  });

  test("Profile deep-link resolves through admin tab query helpers", () => {
    expect(resolveAdminDashboardTabFromQuery({ tab: "profile" })).toBe(
      ADMIN_DASHBOARD_TAB_IDS.PROFILE
    );
    const visible = getVisibleAdminDashboardTabs();
    expect(resolveVisibleAdminDashboardTab("profile", visible)).toBe(
      ADMIN_DASHBOARD_TAB_IDS.PROFILE
    );
  });

  test("admin dashboard renders shared profile editor and device notifications panel", () => {
    const adminPage = readSource("src/pages/admin/index.jsx");
    expect(adminPage).toMatch(/import ProfileCompletionPanel from/);
    expect(adminPage).toMatch(/import DeviceNotificationsPanel from/);
    expect(adminPage).toMatch(/activeTab === ADMIN_DASHBOARD_TAB_IDS\.PROFILE/);
    expect(adminPage).toMatch(/<ProfileCompletionPanel\s*\/>/);
    expect(adminPage).toMatch(/<DeviceNotificationsPanel\s*\/>/);
  });

  test("DeviceNotificationsPanel exposes admin test action only for admin role", () => {
    const panel = readSource("src/components/profile/DeviceNotificationsPanel.jsx");
    expect(panel).toMatch(/isVerifiedAdmin/);
    expect(panel).toMatch(/Send test notification/i);
  });

  test("profile contact updates cannot mutate role or tier fields", () => {
    const payload = buildProfileContactPayload({
      phone: "+501 600 1234",
      role: "admin",
      tier: "admin",
    });
    expect(payload).not.toHaveProperty("role");
    expect(payload).not.toHaveProperty("tier");
    expect(Object.keys(payload)).toEqual(
      expect.arrayContaining([
        "phone",
        "whatsapp",
        "brokerage_name",
        "brokerage_phone",
        "show_email_public",
        "show_phone_public",
        "contact_email_display",
        "updated_at",
      ])
    );
  });
});
