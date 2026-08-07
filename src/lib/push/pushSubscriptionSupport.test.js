/** @jest-environment jsdom */

import {
  getPushCapability,
  detectPushPlatformLabel,
  urlBase64ToUint8Array,
  PUSH_CAPABILITY,
} from "./pushSubscriptionSupport";

describe("pushSubscriptionSupport", () => {
  test("detects unsupported when PushManager is missing", () => {
    const result = getPushCapability({
      window: {},
      navigator: { serviceWorker: {} },
      location: { protocol: "https:", hostname: "belizelistings.bz" },
    });
    expect(result.capability).toBe(PUSH_CAPABILITY.UNSUPPORTED);
    expect(result.canSubscribe).toBe(false);
  });

  test("detects iOS Safari before home screen install", () => {
    const result = getPushCapability({
      window: {
        PushManager: function PushManager() {},
        Notification: { permission: "default" },
      },
      navigator: {
        serviceWorker: {},
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        platform: "iPhone",
        maxTouchPoints: 5,
      },
      location: { protocol: "https:", hostname: "belizelistings.bz" },
    });
    expect(result.capability).toBe(PUSH_CAPABILITY.IOS_NOT_INSTALLED);
    expect(result.canSubscribe).toBe(false);
    expect(result.isIos).toBe(true);
  });

  test("detects installed iOS PWA as subscribable", () => {
    const result = getPushCapability({
      window: {
        PushManager: function PushManager() {},
        Notification: { permission: "default" },
        matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
      },
      navigator: {
        serviceWorker: {},
        standalone: true,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        platform: "iPhone",
        maxTouchPoints: 5,
      },
      location: { protocol: "https:", hostname: "belizelistings.bz" },
    });
    expect(result.capability).toBe(PUSH_CAPABILITY.IOS_INSTALLED);
    expect(result.canSubscribe).toBe(true);
  });

  test("detects denied permission", () => {
    const result = getPushCapability({
      window: {
        PushManager: function PushManager() {},
        Notification: { permission: "denied" },
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
      },
      navigator: {
        serviceWorker: {},
        userAgent: "Mozilla/5.0 (Linux; Android 14)",
      },
      location: { protocol: "https:", hostname: "belizelistings.bz" },
    });
    expect(result.capability).toBe(PUSH_CAPABILITY.PERMISSION_DENIED);
    expect(result.canSubscribe).toBe(false);
  });

  test("detectPushPlatformLabel maps common agents", () => {
    expect(
      detectPushPlatformLabel({ navigator: { userAgent: "iPhone" } })
    ).toBe("ios");
    expect(
      detectPushPlatformLabel({ navigator: { userAgent: "Android 14" } })
    ).toBe("android");
    expect(
      detectPushPlatformLabel({ navigator: { userAgent: "Macintosh" } })
    ).toBe("desktop");
  });

  test("urlBase64ToUint8Array decodes VAPID public keys", () => {
    const bytes = urlBase64ToUint8Array("BMkB");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
