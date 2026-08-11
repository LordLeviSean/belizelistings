/** @jest-environment jsdom */

jest.mock("./pushSubscriptionMutations", () => ({
  registerPushSubscription: jest.fn(),
  revokePushSubscription: jest.fn(),
  listMyPushSubscriptionDevices: jest.fn(),
}));

jest.mock("../pwa/registerServiceWorker", () => ({
  registerBelizeListingsServiceWorker: jest.fn(),
}));

jest.mock("./pushSubscriptionSupport", () => ({
  ...jest.requireActual("./pushSubscriptionSupport"),
  getPushCapability: jest.fn(() => ({
    capability: "default",
    canSubscribe: true,
    permission: "default",
    isIos: false,
    isStandalone: false,
  })),
  detectPushPlatformLabel: jest.fn(() => "desktop"),
}));

import { registerBelizeListingsServiceWorker } from "../pwa/registerServiceWorker";
import { registerPushSubscription, revokePushSubscription, listMyPushSubscriptionDevices } from "./pushSubscriptionMutations";
import { getPushCapability } from "./pushSubscriptionSupport";
import {
  disableDevicePushNotifications,
  enableDevicePushNotifications,
  pushSubscriptionToRpcPayload,
  reconcileDevicePushAfterPermissionRestore,
} from "./pushSubscriptionClient";

describe("pushSubscriptionClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.PushManager = function PushManager() {};
    global.Notification = {
      permission: "default",
      requestPermission: jest.fn().mockResolvedValue("granted"),
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      writable: true,
      value: global.Notification,
    });
  });

  test("pushSubscriptionToRpcPayload maps PushSubscription JSON", () => {
    const payload = pushSubscriptionToRpcPayload({
      toJSON: () => ({
        endpoint: "https://push.example/device",
        expirationTime: null,
        keys: { p256dh: "p256", auth: "auth" },
      }),
    });
    expect(payload).toEqual(
      expect.objectContaining({
        endpoint: "https://push.example/device",
        p256dh: "p256",
        authSecret: "auth",
      })
    );
  });

  test("enableDevicePushNotifications registers after permission grant", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, publicKey: "BMkB", subject: "mailto:ops@belizelistings.bz" }),
    });

    registerBelizeListingsServiceWorker.mockReturnValue({
      registered: true,
      registrationPromise: Promise.resolve({ registered: true }),
    });

    const subscribe = jest.fn().mockResolvedValue({
      toJSON: () => ({
        endpoint: "https://push.example/device",
        keys: { p256dh: "p256", auth: "auth" },
      }),
      unsubscribe: jest.fn(),
    });

    const registration = {
      pushManager: {
        getSubscription: jest.fn().mockResolvedValue(null),
        subscribe,
      },
    };

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve(registration),
      },
    });

    registerPushSubscription.mockResolvedValue({
      ok: true,
      subscriptionId: "sub-123",
      error: null,
    });

    const result = await enableDevicePushNotifications({
      client: { rpc: jest.fn() },
      userId: "user-1",
      getAccessToken: async () => "token",
    });

    expect(result.ok).toBe(true);
    expect(registerPushSubscription).toHaveBeenCalled();
    expect(global.Notification.requestPermission).toHaveBeenCalled();
    expect(window.localStorage.getItem("bl_push_device_sub_user-1")).toContain("sub-123");
  });

  test("enableDevicePushNotifications skips requestPermission when already granted", async () => {
    getPushCapability.mockReturnValue({
      capability: "granted",
      canSubscribe: true,
      permission: "granted",
      isIos: false,
      isStandalone: false,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, publicKey: "BMkB", subject: "mailto:ops@belizelistings.bz" }),
    });

    registerBelizeListingsServiceWorker.mockReturnValue({
      registered: true,
      registrationPromise: Promise.resolve({ registered: true }),
    });

    const browserSubscription = {
      toJSON: () => ({
        endpoint: "https://push.example/device",
        keys: { p256dh: "p256", auth: "auth" },
      }),
      unsubscribe: jest.fn(),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: jest.fn().mockResolvedValue(browserSubscription),
            subscribe: jest.fn(),
          },
        }),
      },
    });

    registerPushSubscription.mockResolvedValue({
      ok: true,
      subscriptionId: "sub-granted",
      error: null,
    });

    const result = await enableDevicePushNotifications({
      client: { rpc: jest.fn() },
      userId: "user-2",
      getAccessToken: async () => "token",
    });

    expect(result.ok).toBe(true);
    expect(global.Notification.requestPermission).not.toHaveBeenCalled();
  });

  test("disableDevicePushNotifications revokes and clears storage", async () => {
    window.localStorage.setItem(
      "bl_push_device_sub_user-1",
      JSON.stringify({ subscriptionId: "sub-123" })
    );

    revokePushSubscription.mockResolvedValue({ ok: true, error: null });

    registerBelizeListingsServiceWorker.mockReturnValue({
      registered: true,
      registrationPromise: Promise.resolve({ registered: true }),
    });

    const unsubscribe = jest.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: jest.fn().mockResolvedValue({ unsubscribe }),
          },
        }),
      },
    });

    const result = await disableDevicePushNotifications({
      client: { rpc: jest.fn() },
      userId: "user-1",
    });

    expect(result.ok).toBe(true);
    expect(revokePushSubscription).toHaveBeenCalledWith({ rpc: expect.anything() }, "sub-123");
    expect(unsubscribe).toHaveBeenCalled();
    expect(window.localStorage.getItem("bl_push_device_sub_user-1")).toBeNull();
  });

  test("reconcileDevicePushAfterPermissionRestore no-ops when permission is not granted", async () => {
    getPushCapability.mockReturnValue({
      capability: "denied",
      canSubscribe: false,
      permission: "denied",
      isIos: false,
      isStandalone: false,
    });

    const result = await reconcileDevicePushAfterPermissionRestore({
      client: { rpc: jest.fn() },
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: true, reconciled: false, reason: "permission_not_granted" })
    );
    expect(registerPushSubscription).not.toHaveBeenCalled();
  });

  test("reconcileDevicePushAfterPermissionRestore registers existing browser subscription without subscribe()", async () => {
    getPushCapability.mockReturnValue({
      capability: "granted",
      canSubscribe: true,
      permission: "granted",
      isIos: false,
      isStandalone: false,
    });

    const browserSubscription = {
      toJSON: () => ({
        endpoint: "https://push.example/device",
        keys: { p256dh: "p256", auth: "auth" },
      }),
    };

    const subscribe = jest.fn();
    registerBelizeListingsServiceWorker.mockReturnValue({
      registered: true,
      registrationPromise: Promise.resolve({ registered: true }),
    });

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: jest.fn().mockResolvedValue(browserSubscription),
            subscribe,
          },
        }),
      },
    });

    listMyPushSubscriptionDevices.mockResolvedValue({
      ok: true,
      devices: [],
    });

    registerPushSubscription.mockResolvedValue({
      ok: true,
      subscriptionId: "sub-restored",
      error: null,
    });

    const result = await reconcileDevicePushAfterPermissionRestore({
      client: { rpc: jest.fn() },
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: true, reconciled: true, subscriptionId: "sub-restored" })
    );
    expect(registerPushSubscription).toHaveBeenCalledTimes(1);
    expect(subscribe).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("bl_push_device_sub_user-1")).toContain("sub-restored");
  });

  test("reconcileDevicePushAfterPermissionRestore skips when device already registered", async () => {
    getPushCapability.mockReturnValue({
      capability: "granted",
      canSubscribe: true,
      permission: "granted",
      isIos: false,
      isStandalone: false,
    });

    window.localStorage.setItem(
      "bl_push_device_sub_user-1",
      JSON.stringify({ subscriptionId: "sub-existing" })
    );

    registerBelizeListingsServiceWorker.mockReturnValue({
      registered: true,
      registrationPromise: Promise.resolve({ registered: true }),
    });

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: jest.fn().mockResolvedValue({
              toJSON: () => ({
                endpoint: "https://push.example/device",
                keys: { p256dh: "p256", auth: "auth" },
              }),
            }),
          },
        }),
      },
    });

    listMyPushSubscriptionDevices.mockResolvedValue({
      ok: true,
      devices: [{ subscription_id: "sub-existing", is_active: true }],
    });

    const result = await reconcileDevicePushAfterPermissionRestore({
      client: { rpc: jest.fn() },
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: true, reconciled: false, reason: "already_registered" })
    );
    expect(registerPushSubscription).not.toHaveBeenCalled();
  });
});
