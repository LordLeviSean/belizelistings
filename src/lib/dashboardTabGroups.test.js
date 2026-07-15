/** @jest-environment node */

import {
  DASHBOARD_TAB_GROUP,
  partitionDashboardTabs,
  formatTabCountChip,
} from "./dashboardTabGroups";

describe("dashboardTabGroups", () => {
  test("partitionDashboardTabs groups by tab.group", () => {
    const tabs = [
      { id: "overview", label: "Overview", group: "workspace" },
      { id: "inbox", label: "Inbox", group: "activity" },
      { id: "listings", label: "Listings" },
    ];
    const { workspace, activity } = partitionDashboardTabs(tabs);
    expect(workspace.map((t) => t.id)).toEqual(["overview", "listings"]);
    expect(activity.map((t) => t.id)).toEqual(["inbox"]);
  });

  test("partitionDashboardTabs infers activity from crm flag", () => {
    const { workspace, activity } = partitionDashboardTabs([
      { id: "profile", label: "Profile" },
      { id: "inbox", label: "Inbox", crm: true },
    ]);
    expect(workspace).toHaveLength(1);
    expect(activity).toHaveLength(1);
    expect(activity[0].id).toBe("inbox");
  });

  test("formatTabCountChip caps at 99+", () => {
    expect(formatTabCountChip(0)).toBeNull();
    expect(formatTabCountChip(3)).toBe("3");
    expect(formatTabCountChip(120)).toBe("99+");
  });

  test("DASHBOARD_TAB_GROUP exposes workspace and activity keys", () => {
    expect(DASHBOARD_TAB_GROUP.WORKSPACE).toBe("workspace");
    expect(DASHBOARD_TAB_GROUP.ACTIVITY).toBe("activity");
  });
});
