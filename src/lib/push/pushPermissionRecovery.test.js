/** @jest-environment jsdom */

import {
  BLOCKED_NOTIFICATION_STEPS,
  getNotificationPermissionRecovery,
  isNotificationPermissionDenied,
} from "./pushPermissionRecovery";

describe("pushPermissionRecovery", () => {
  test("returns instruction-only recovery when permission is denied", () => {
    const recovery = getNotificationPermissionRecovery({
      window: {
        Notification: { permission: "denied" },
        location: { host: "belizelistings.bz" },
      },
      navigator: {},
      location: { host: "belizelistings.bz" },
    });

    expect(recovery.permission).toBe("denied");
    expect(recovery.canOpenSettings).toBe(false);
    expect(recovery.openSettings).toBeNull();
    expect(recovery.settingsActionLabel).toBe("How to unblock");
    expect(recovery.steps).toEqual([...BLOCKED_NOTIFICATION_STEPS]);
    expect(recovery.siteHost).toBe("belizelistings.bz");
  });

  test("isNotificationPermissionDenied reflects browser permission", () => {
    expect(
      isNotificationPermissionDenied({
        window: { Notification: { permission: "denied" } },
      })
    ).toBe(true);

    expect(
      isNotificationPermissionDenied({
        window: { Notification: { permission: "default" } },
      })
    ).toBe(false);
  });
});
