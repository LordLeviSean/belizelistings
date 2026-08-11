/** @jest-environment jsdom */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("./pushSubscriptionClient", () => ({
  reconcileDevicePushAfterPermissionRestore: jest.fn(),
}));

jest.mock("./pushSubscriptionMutations", () => ({
  revokePushSubscription: jest.fn(),
}));

import { reconcileDevicePushAfterPermissionRestore } from "./pushSubscriptionClient";
import { revokePushSubscription } from "./pushSubscriptionMutations";
import {
  detachPushSubscriptionOnLogout,
  syncPushSubscriptionForAuthenticatedUser,
} from "./pushSubscriptionSessionSync";

describe("pushSubscriptionSessionSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  test("syncPushSubscriptionForAuthenticatedUser reuses existing browser subscription", async () => {
    reconcileDevicePushAfterPermissionRestore.mockResolvedValue({
      ok: true,
      reconciled: true,
      subscriptionId: "sub-b",
    });

    const result = await syncPushSubscriptionForAuthenticatedUser({
      client: { rpc: jest.fn() },
      userId: "user-b",
    });

    expect(result.reconciled).toBe(true);
    expect(reconcileDevicePushAfterPermissionRestore).toHaveBeenCalledWith({
      client: { rpc: expect.anything() },
      userId: "user-b",
    });
  });

  test("detachPushSubscriptionOnLogout revokes backend row without browser unsubscribe", async () => {
    window.localStorage.setItem(
      "bl_push_device_sub_user-a",
      JSON.stringify({ subscriptionId: "sub-a" })
    );
    revokePushSubscription.mockResolvedValue({ ok: true, error: null });

    const result = await detachPushSubscriptionOnLogout({
      client: { rpc: jest.fn() },
      userId: "user-a",
    });

    expect(result.detached).toBe(true);
    expect(revokePushSubscription).toHaveBeenCalledWith({ rpc: expect.anything() }, "sub-a");
    expect(window.localStorage.getItem("bl_push_device_sub_user-a")).toBeNull();
  });

  test("account switch flow: detach A then sync B associates device with new user", async () => {
    window.localStorage.setItem(
      "bl_push_device_sub_user-a",
      JSON.stringify({ subscriptionId: "sub-a" })
    );
    revokePushSubscription.mockResolvedValue({ ok: true, error: null });
    reconcileDevicePushAfterPermissionRestore.mockResolvedValue({
      ok: true,
      reconciled: true,
      subscriptionId: "sub-b",
    });

    await detachPushSubscriptionOnLogout({
      client: { rpc: jest.fn() },
      userId: "user-a",
    });

    const syncResult = await syncPushSubscriptionForAuthenticatedUser({
      client: { rpc: jest.fn() },
      userId: "user-b",
    });

    expect(revokePushSubscription).toHaveBeenCalledWith({ rpc: expect.anything() }, "sub-a");
    expect(syncResult.reconciled).toBe(true);
    expect(reconcileDevicePushAfterPermissionRestore).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-b" })
    );
  });
});
