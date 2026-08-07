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
import { registerPushSubscription, revokePushSubscription } from "./pushSubscriptionMutations";
import {
  disableDevicePushNotifications,
  enableDevicePushNotifications,
  pushSubscriptionToRpcPayload,
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
    expect(window.localStorage.getItem("bl_push_device_sub_user-1")).toContain("sub-123");
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
});
