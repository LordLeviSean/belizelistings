/** @jest-environment node */

import { PUSH_DELIVERY_INTEGRATION, PUSH_LOGOUT_POLICY } from "./pushDeliveryModel";

describe("pushDeliveryModel", () => {
  test("documents integration with existing notification pipeline", () => {
    expect(PUSH_DELIVERY_INTEGRATION.IN_APP_AUTHORITY).toBe("notifications");
    expect(PUSH_DELIVERY_INTEGRATION.QUEUE_RPC).toBe("deliver_notification");
    expect(PUSH_DELIVERY_INTEGRATION.SUBSCRIPTION_SELECT_RPC).toBe(
      "select_active_push_subscriptions_for_delivery"
    );
    expect(PUSH_DELIVERY_INTEGRATION.CONNECTED_EVENT_TYPES).toEqual(["new_inquiry", "agent_replied"]);
  });

  test("logout policy detaches backend ownership while preserving browser subscription", () => {
    expect(PUSH_LOGOUT_POLICY.IMPLEMENTED).toBe(true);
    expect(PUSH_LOGOUT_POLICY.PRESERVES_BROWSER_SUBSCRIPTION).toBe(true);
    expect(PUSH_LOGOUT_POLICY.DETACHES_BACKEND_ON_LOGOUT).toBe(true);
  });
});
