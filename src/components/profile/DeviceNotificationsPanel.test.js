/** @jest-environment jsdom */

jest.mock("../../lib/featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("../../hooks/useUserRole", () => ({
  __esModule: true,
  default: jest.fn(() => ({ user: { id: "user-1" }, role: "user" })),
}));

jest.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("../../lib/push/pushSubscriptionClient", () => ({
  loadPushDeviceStatus: jest.fn(),
  enableDevicePushNotifications: jest.fn(),
  disableDevicePushNotifications: jest.fn(),
  reconcileDevicePushAfterPermissionRestore: jest.fn(),
}));

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }),
    },
  },
}));

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { renderToString } from "react-dom/server";
import useUserRole from "../../hooks/useUserRole";
import {
  loadPushDeviceStatus,
  enableDevicePushNotifications,
  disableDevicePushNotifications,
  reconcileDevicePushAfterPermissionRestore,
} from "../../lib/push/pushSubscriptionClient";
import DeviceNotificationsPanel from "./DeviceNotificationsPanel";

function renderPanel() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<DeviceNotificationsPanel />);
  });
  return { container, root };
}

describe("DeviceNotificationsPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
    global.fetch = jest.fn();
    global.Notification = {
      permission: "default",
      requestPermission: jest.fn().mockResolvedValue("default"),
    };
  });

  test("renders device notifications panel without throwing", () => {
    loadPushDeviceStatus.mockResolvedValue({
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
    });
    expect(() => renderToString(<DeviceNotificationsPanel />)).not.toThrow();
  });

  test("does not show test action until current device is enabled", async () => {
    useUserRole.mockReturnValue({ user: { id: "user-1" }, role: "user" });
    loadPushDeviceStatus.mockResolvedValue({
      capability: {
        capability: "default",
        canSubscribe: true,
        permission: "default",
        isIos: false,
        isStandalone: false,
      },
      browserSubscription: true,
      currentDeviceRegistered: false,
      currentSubscriptionId: null,
      activeDevices: [],
    });

    const { container } = renderPanel();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).not.toMatch(/Send test notification/i);
  });

  test("does not show admin test action for non-admin users even when enabled", async () => {
    useUserRole.mockReturnValue({ user: { id: "user-1" }, role: "agent" });
    loadPushDeviceStatus.mockResolvedValue({
      capability: {
        capability: "granted",
        canSubscribe: true,
        permission: "granted",
        isIos: false,
        isStandalone: false,
      },
      browserSubscription: true,
      currentDeviceRegistered: true,
      currentSubscriptionId: "sub-1",
      activeDevices: [{ subscription_id: "sub-1", platform_label: "desktop" }],
    });

    const { container } = renderPanel();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).not.toMatch(/Send test notification/i);
  });

  test("shows user-initiated admin test action when current device is enabled", async () => {
    useUserRole.mockReturnValue({ user: { id: "user-1" }, role: "admin" });
    loadPushDeviceStatus.mockResolvedValue({
      capability: {
        capability: "granted",
        canSubscribe: true,
        permission: "granted",
        isIos: false,
        isStandalone: false,
      },
      browserSubscription: true,
      currentDeviceRegistered: true,
      currentSubscriptionId: "sub-1",
      activeDevices: [{ subscription_id: "sub-1", platform_label: "desktop" }],
    });

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, attempted: 1, delivered: 1, temporaryFailures: 0, deactivated: 0 }),
    });

    const { container } = renderPanel();
    await act(async () => {
      await Promise.resolve();
    });

    const button = container.querySelector("button");
    expect(button?.textContent).toMatch(/Send test notification/i);

    await act(async () => {
      button?.click();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/push/test",
      expect.objectContaining({ method: "POST" })
    );
    expect(enableDevicePushNotifications).not.toHaveBeenCalled();
    expect(disableDevicePushNotifications).not.toHaveBeenCalled();
  });

  test("shows blocked recovery guidance when permission is denied", async () => {
    loadPushDeviceStatus.mockResolvedValue({
      capability: {
        capability: "denied",
        canSubscribe: false,
        permission: "denied",
        isIos: false,
        isStandalone: false,
      },
      browserSubscription: false,
      currentDeviceRegistered: false,
      currentSubscriptionId: null,
      activeDevices: [],
    });

    const { container } = renderPanel();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Blocked/i);
    expect(container.textContent).toMatch(/How to unblock/i);
    expect(container.textContent).toMatch(/Check again/i);

    const toggle = container.querySelector('input[type="checkbox"]');
    expect(toggle?.disabled).toBe(true);
  });

  test("Check again re-reads permission without requesting it", async () => {
    loadPushDeviceStatus
      .mockResolvedValueOnce({
        capability: {
          capability: "denied",
          canSubscribe: false,
          permission: "denied",
          isIos: false,
          isStandalone: false,
        },
        browserSubscription: false,
        currentDeviceRegistered: false,
        currentSubscriptionId: null,
        activeDevices: [],
      })
      .mockResolvedValueOnce({
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
      });

    const { container } = renderPanel();
    await act(async () => {
      await Promise.resolve();
    });

    const checkAgain = Array.from(container.querySelectorAll("button")).find((button) =>
      /Check again/i.test(button.textContent || "")
    );

    await act(async () => {
      checkAgain?.click();
      await Promise.resolve();
    });

    expect(reconcileDevicePushAfterPermissionRestore).toHaveBeenCalled();
    expect(loadPushDeviceStatus).toHaveBeenCalledTimes(2);
    expect(enableDevicePushNotifications).not.toHaveBeenCalled();
    expect(global.Notification?.requestPermission).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Off/i);
  });

  test("focus refresh re-checks permission and reconciles silently", async () => {
    loadPushDeviceStatus.mockResolvedValue({
      capability: {
        capability: "denied",
        canSubscribe: false,
        permission: "denied",
        isIos: false,
        isStandalone: false,
      },
      browserSubscription: false,
      currentDeviceRegistered: false,
      currentSubscriptionId: null,
      activeDevices: [],
    });

    renderPanel();
    await act(async () => {
      await Promise.resolve();
    });

    reconcileDevicePushAfterPermissionRestore.mockClear();
    loadPushDeviceStatus.mockClear();

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(reconcileDevicePushAfterPermissionRestore).toHaveBeenCalled();
    expect(loadPushDeviceStatus).toHaveBeenCalled();
  });
});
