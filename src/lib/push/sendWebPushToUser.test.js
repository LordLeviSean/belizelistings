/** @jest-environment node */

jest.mock("web-push", () => ({
  __esModule: true,
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
  },
}));

jest.mock("./webPushVapidConfig", () => ({
  readWebPushVapidConfig: jest.fn(),
}));

import webpush from "web-push";
import { readWebPushVapidConfig } from "./webPushVapidConfig";
import { sendWebPushToUser } from "./sendWebPushToUser";
import { buildPushTestPayload } from "./pushTestPayload";

function mockAdminClient(rows) {
  const rpc = jest.fn(async (name, args) => {
    if (name === "select_active_push_subscriptions_for_delivery") {
      return { data: rows, error: null };
    }
    if (name === "record_push_subscription_delivery") {
      return { data: { ok: true }, error: null };
    }
    if (name === "deactivate_push_subscription") {
      return { data: { deactivated: true }, error: null };
    }
    return { data: null, error: null };
  });
  return { rpc };
}

describe("sendWebPushToUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    readWebPushVapidConfig.mockReturnValue({
      configured: true,
      publicKey: "public",
      privateKey: "private",
      subject: "mailto:ops@belizelistings.bz",
    });
  });

  test("loads only active subscriptions for the requested user", async () => {
    const adminClient = mockAdminClient([
      {
        subscription_id: "sub-1",
        endpoint: "https://push.example/1",
        p256dh: "p256",
        auth_secret: "auth",
      },
    ]);
    webpush.sendNotification.mockResolvedValue(undefined);

    const built = buildPushTestPayload({ userId: "user-1", role: "user" });
    const result = await sendWebPushToUser(adminClient, "user-1", built);

    expect(adminClient.rpc).toHaveBeenCalledWith("select_active_push_subscriptions_for_delivery", {
      p_user_id: "user-1",
    });
    expect(result.ok).toBe(true);
    expect(result.attempted).toBe(1);
    expect(result.delivered).toBe(1);
  });

  test("delivers independently to each device", async () => {
    const adminClient = mockAdminClient([
      {
        subscription_id: "sub-1",
        endpoint: "https://push.example/1",
        p256dh: "p256-1",
        auth_secret: "auth-1",
      },
      {
        subscription_id: "sub-2",
        endpoint: "https://push.example/2",
        p256dh: "p256-2",
        auth_secret: "auth-2",
      },
    ]);
    webpush.sendNotification.mockResolvedValue(undefined);

    const built = buildPushTestPayload({ userId: "user-1" });
    const result = await sendWebPushToUser(adminClient, "user-1", built);

    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    expect(result.delivered).toBe(2);
  });

  test("404/410 deactivates only the failed subscription", async () => {
    const adminClient = mockAdminClient([
      {
        subscription_id: "sub-bad",
        endpoint: "https://push.example/bad",
        p256dh: "p256",
        auth_secret: "auth",
      },
      {
        subscription_id: "sub-good",
        endpoint: "https://push.example/good",
        p256dh: "p256",
        auth_secret: "auth",
      },
    ]);

    webpush.sendNotification
      .mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }))
      .mockResolvedValueOnce(undefined);

    const built = buildPushTestPayload({ userId: "user-1" });
    const result = await sendWebPushToUser(adminClient, "user-1", built);

    expect(adminClient.rpc).toHaveBeenCalledWith("deactivate_push_subscription", {
      p_subscription_id: "sub-bad",
      p_reason: "expired_subscription",
    });
    expect(result.deactivated).toBe(1);
    expect(result.delivered).toBe(1);
  });

  test("temporary failures do not deactivate subscriptions", async () => {
    const adminClient = mockAdminClient([
      {
        subscription_id: "sub-1",
        endpoint: "https://push.example/1",
        p256dh: "p256",
        auth_secret: "auth",
      },
    ]);

    webpush.sendNotification.mockRejectedValue(Object.assign(new Error("busy"), { statusCode: 503 }));

    const built = buildPushTestPayload({ userId: "user-1" });
    const result = await sendWebPushToUser(adminClient, "user-1", built);

    expect(adminClient.rpc).toHaveBeenCalledWith("record_push_subscription_delivery", {
      p_subscription_id: "sub-1",
      p_outcome: "temporary_failure",
    });
    expect(adminClient.rpc).not.toHaveBeenCalledWith(
      "deactivate_push_subscription",
      expect.anything()
    );
    expect(result.deactivated).toBe(0);
    expect(result.temporaryFailures).toBe(1);
  });

  test("VAPID errors do not deactivate subscriptions", async () => {
    const adminClient = mockAdminClient([
      {
        subscription_id: "sub-1",
        endpoint: "https://push.example/1",
        p256dh: "p256",
        auth_secret: "auth",
      },
    ]);

    webpush.sendNotification.mockRejectedValue(Object.assign(new Error("vapid"), { statusCode: 401 }));

    const built = buildPushTestPayload({ userId: "user-1" });
    const result = await sendWebPushToUser(adminClient, "user-1", built);

    expect(adminClient.rpc).not.toHaveBeenCalledWith(
      "deactivate_push_subscription",
      expect.anything()
    );
    expect(result.deactivated).toBe(0);
    expect(result.delivered).toBe(0);
  });

  test("returns aggregate counts without exposing endpoints or keys", async () => {
    const adminClient = mockAdminClient([
      {
        subscription_id: "sub-1",
        endpoint: "https://push.example/secret-endpoint",
        p256dh: "secret-p256",
        auth_secret: "secret-auth",
      },
    ]);
    webpush.sendNotification.mockResolvedValue(undefined);

    const built = buildPushTestPayload({ userId: "user-1" });
    const result = await sendWebPushToUser(adminClient, "user-1", built);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        attempted: 1,
        delivered: 1,
        temporaryFailures: 0,
        deactivated: 0,
      })
    );
    expect(JSON.stringify(result)).not.toContain("secret-endpoint");
    expect(JSON.stringify(result)).not.toContain("secret-p256");
    expect(JSON.stringify(result)).not.toContain("secret-auth");
  });

  test("returns vapid_not_configured without deactivating subscriptions", async () => {
    readWebPushVapidConfig.mockReturnValue({ configured: false });
    const adminClient = mockAdminClient([]);
    const built = buildPushTestPayload({ userId: "user-1" });
    const result = await sendWebPushToUser(adminClient, "user-1", built);
    expect(result.error).toBe("vapid_not_configured");
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
