/** @jest-environment node */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const SW_LOGIC_PATH = path.join(ROOT, "public", "sw-push-logic.js");
const SW_PATH = path.join(ROOT, "public", "sw.js");

function loadPushLogic() {
  const source = fs.readFileSync(SW_LOGIC_PATH, "utf8");
  const sandbox = { self: {}, URL };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.self.BL_PUSH;
}

describe("sw-push-logic", () => {
  let BL_PUSH;

  beforeAll(() => {
    BL_PUSH = loadPushLogic();
  });

  test("service worker registers push and notificationclick listeners", () => {
    const swSource = fs.readFileSync(SW_PATH, "utf8");
    expect(swSource).toMatch(/addEventListener\s*\(\s*['"]push['"]/);
    expect(swSource).toMatch(/addEventListener\s*\(\s*['"]notificationclick['"]/);
    expect(swSource).not.toMatch(/addEventListener\s*\(\s*['"]fetch['"]/);
    expect(swSource).not.toMatch(/caches\.open\s*\(/);
    expect(swSource).not.toMatch(/cache\.put\s*\(/);
  });

  test("valid payload builds expected notification options", () => {
    const payload = BL_PUSH.normalizePushPayload({
      notificationId: "abc-123",
      eventType: "push_test",
      title: "BelizeListings notifications are active",
      body: "This device can now receive important BelizeListings updates.",
      href: "/dashboard/user?tab=profile",
      tag: "push_test",
    });

    const built = BL_PUSH.buildNotificationOptions(payload);
    expect(built.title).toBe("BelizeListings notifications are active");
    expect(built.options).toEqual(
      expect.objectContaining({
        body: "This device can now receive important BelizeListings updates.",
        tag: "push_test",
        icon: "/apple-touch-icon.png",
        data: {
          notificationId: "abc-123",
          eventType: "push_test",
          href: "/dashboard/user?tab=profile",
        },
      })
    );
    expect(JSON.stringify(built.options)).not.toMatch(/token|bearer|authorization/i);
  });

  test("malformed push data falls back safely", () => {
    const fromEmpty = BL_PUSH.parsePushEventData({});
    expect(fromEmpty.title).toBe(BL_PUSH.DEFAULT_TITLE);
    expect(fromEmpty.body).toBe(BL_PUSH.DEFAULT_BODY);
    expect(fromEmpty.href).toBe(BL_PUSH.FALLBACK_HREF);

    const fromBadJson = BL_PUSH.parsePushEventData({
      data: {
        json: () => {
          throw new Error("bad json");
        },
        text: () => "not-json",
      },
    });
    expect(fromBadJson.title).toBe(BL_PUSH.DEFAULT_TITLE);
  });

  test("rejects unsafe external, protocol-relative and malformed destinations", () => {
    expect(BL_PUSH.isSafeRelativePath("https://evil.example/phish")).toBe(false);
    expect(BL_PUSH.isSafeRelativePath("//evil.example/phish")).toBe(false);
    expect(BL_PUSH.isSafeRelativePath("dashboard/user")).toBe(false);
    expect(BL_PUSH.resolveNotificationTarget("https://evil.example", "https://belizelistings.bz")).toBe(
      "https://belizelistings.bz/dashboard/user?tab=profile"
    );
    expect(BL_PUSH.resolveNotificationTarget("//evil.example", "https://belizelistings.bz")).toBe(
      "https://belizelistings.bz/dashboard/user?tab=profile"
    );
  });

  test("accepts valid relative inbox, viewings and profile paths", () => {
    expect(BL_PUSH.isSafeRelativePath("/dashboard/user?tab=inbox&conversation=abc")).toBe(true);
    expect(BL_PUSH.isSafeRelativePath("/dashboard/user?tab=viewings&viewing=1")).toBe(true);
    expect(BL_PUSH.isSafeRelativePath("/dashboard/agent?tab=profile")).toBe(true);
    expect(BL_PUSH.resolveNotificationTarget("/dashboard/user?tab=inbox", "https://belizelistings.bz")).toBe(
      "https://belizelistings.bz/dashboard/user?tab=inbox"
    );
  });

  test("handlePushEvent displays notification", async () => {
    const showNotification = jest.fn().mockResolvedValue(undefined);
    await BL_PUSH.handlePushEvent(
      {
        data: {
          json: () => ({
            notificationId: "n1",
            eventType: "push_test",
            title: "Test",
            body: "Body",
            href: "/dashboard/user?tab=profile",
            tag: "push_test",
          }),
        },
      },
      { showNotification }
    );
    expect(showNotification).toHaveBeenCalledWith(
      "Test",
      expect.objectContaining({
        body: "Body",
        data: expect.objectContaining({ href: "/dashboard/user?tab=profile" }),
      })
    );
  });

  test("notification click navigates existing client to exact inbox conversation", async () => {
    const close = jest.fn();
    const focus = jest.fn().mockResolvedValue(undefined);
    const navigate = jest.fn().mockResolvedValue(undefined);
    const matchAll = jest.fn().mockResolvedValue([
      {
        url: "https://belizelistings.bz/dashboard/user",
        focus,
        navigate,
      },
    ]);
    const openWindow = jest.fn();

    await BL_PUSH.handleNotificationClick(
      {
        notification: {
          close,
          data: { href: "/dashboard/user?tab=inbox&conversation=conv-buyer-1" },
        },
      },
      { matchAll, openWindow },
      "https://belizelistings.bz"
    );

    expect(close).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      "https://belizelistings.bz/dashboard/user?tab=inbox&conversation=conv-buyer-1"
    );
    expect(focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  test("notification click posts in-app navigation when Client.navigate is unavailable", async () => {
    const postMessage = jest.fn();
    const focus = jest.fn().mockResolvedValue(undefined);
    const matchAll = jest.fn().mockResolvedValue([
      {
        url: "https://belizelistings.bz/dashboard/user",
        focus,
        postMessage,
      },
    ]);

    await BL_PUSH.handleNotificationClick(
      {
        notification: {
          close: jest.fn(),
          data: { href: "/dashboard/user?tab=inbox&conversation=conv-buyer-2" },
        },
      },
      { matchAll, openWindow: jest.fn() },
      "https://belizelistings.bz"
    );

    expect(postMessage).toHaveBeenCalledWith({
      type: "bl-push-navigate",
      href: "/dashboard/user?tab=inbox&conversation=conv-buyer-2",
    });
  });

  test("notification click focuses existing client when possible", async () => {
    const close = jest.fn();
    const focus = jest.fn().mockResolvedValue(undefined);
    const navigate = jest.fn().mockResolvedValue(undefined);
    const matchAll = jest.fn().mockResolvedValue([
      {
        url: "https://belizelistings.bz/dashboard/user",
        focus,
        navigate,
      },
    ]);
    const openWindow = jest.fn();

    await BL_PUSH.handleNotificationClick(
      {
        notification: {
          close,
          data: { href: "/dashboard/user?tab=profile" },
        },
      },
      { matchAll, openWindow },
      "https://belizelistings.bz"
    );

    expect(close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("https://belizelistings.bz/dashboard/user?tab=profile");
    expect(openWindow).not.toHaveBeenCalled();
  });

  test("notification click opens a new window when no suitable client exists", async () => {
    const openWindow = jest.fn().mockResolvedValue(undefined);
    await BL_PUSH.handleNotificationClick(
      {
        notification: {
          close: jest.fn(),
          data: { href: "/dashboard/user?tab=profile" },
        },
      },
      {
        matchAll: jest.fn().mockResolvedValue([]),
        openWindow,
      },
      "https://belizelistings.bz"
    );
    expect(openWindow).toHaveBeenCalledWith("https://belizelistings.bz/dashboard/user?tab=profile");
  });
});
