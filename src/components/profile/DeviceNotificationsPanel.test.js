/** @jest-environment jsdom */

jest.mock("../../lib/featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("../../hooks/useUserRole", () => ({
  __esModule: true,
  default: () => ({ user: { id: "user-1" } }),
}));

jest.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("../../lib/push/pushSubscriptionClient", () => ({
  loadPushDeviceStatus: jest.fn().mockResolvedValue({
    capability: {
      capability: "default",
      canSubscribe: true,
      permission: "default",
      isIos: false,
      isStandalone: false,
    },
    browserSubscription: false,
    currentDeviceRegistered: false,
    currentSubscriptionId: null,
    activeDevices: [],
  }),
  enableDevicePushNotifications: jest.fn(),
  disableDevicePushNotifications: jest.fn(),
}));

jest.mock("../../lib/supabaseClient", () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));

import React from "react";
import { renderToString } from "react-dom/server";
import DeviceNotificationsPanel from "./DeviceNotificationsPanel";

describe("DeviceNotificationsPanel", () => {
  test("renders device notifications panel without throwing", () => {
    expect(() => renderToString(<DeviceNotificationsPanel />)).not.toThrow();
  });
});
