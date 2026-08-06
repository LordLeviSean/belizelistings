/** @jest-environment node */

import { PUSH_DELIVERY_INTEGRATION, PUSH_LOGOUT_POLICY } from "./pushDeliveryModel";

describe("pushDeliveryModel", () => {
  test("documents integration with existing notification pipeline", () => {
    expect(PUSH_DELIVERY_INTEGRATION.IN_APP_AUTHORITY).toBe("notifications");
    expect(PUSH_DELIVERY_INTEGRATION.QUEUE_RPC).toBe("deliver_notification");
    expect(PUSH_DELIVERY_INTEGRATION.SUBSCRIPTION_SELECT_RPC).toBe(
      "select_active_push_subscriptions_for_delivery"
    );
  });

  test("logout policy is documented but not implemented in 5A", () => {
    expect(PUSH_LOGOUT_POLICY.IMPLEMENTED).toBe(false);
    expect(PUSH_LOGOUT_POLICY.RECOMMENDATION).toMatch(/preserve_subscription/);
  });
});
