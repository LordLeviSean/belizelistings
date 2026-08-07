/** @jest-environment node */

import {
  listMyPushSubscriptionDevices,
  registerPushSubscription,
  revokePushSubscription,
} from "./pushSubscriptionMutations";

describe("pushSubscriptionMutations", () => {
  test("registerPushSubscription forwards RPC payload", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: { ok: true, subscription_id: "sub-1", registered: true },
        error: null,
      }),
    };

    const result = await registerPushSubscription(client, {
      endpoint: "https://push.example/abc",
      p256dh: "key1",
      authSecret: "secret1",
      platformLabel: "desktop",
    });

    expect(result.ok).toBe(true);
    expect(result.subscriptionId).toBe("sub-1");
    expect(client.rpc).toHaveBeenCalledWith("register_push_subscription", {
      p_endpoint: "https://push.example/abc",
      p_p256dh: "key1",
      p_auth_secret: "secret1",
      p_expiration_time: null,
      p_platform_label: "desktop",
    });
  });

  test("revokePushSubscription surfaces RPC errors", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: { ok: false, error: "not_found_or_already_revoked" },
        error: null,
      }),
    };

    const result = await revokePushSubscription(client, "sub-9");
    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe("not_found_or_already_revoked");
  });

  test("listMyPushSubscriptionDevices returns device rows", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: [{ subscription_id: "sub-1", is_active: true, platform_label: "ios" }],
        error: null,
      }),
    };

    const result = await listMyPushSubscriptionDevices(client);
    expect(result.ok).toBe(true);
    expect(result.devices).toHaveLength(1);
  });
});
