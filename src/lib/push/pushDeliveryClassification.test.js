/** @jest-environment node */

import {
  classifyPushHttpStatus,
  isolateFailedSubscription,
  mapOutcomeToSubscriptionRecord,
  PUSH_DELIVERY_OUTCOMES,
  shouldDeactivateSubscription,
} from "./pushDeliveryClassification";

describe("pushDeliveryClassification", () => {
  test("classifies success", () => {
    expect(classifyPushHttpStatus(201).outcome).toBe(PUSH_DELIVERY_OUTCOMES.SUCCESS);
  });

  test("classifies permanent expired/gone subscriptions for deactivation", () => {
    expect(classifyPushHttpStatus(410)).toEqual(
      expect.objectContaining({
        outcome: PUSH_DELIVERY_OUTCOMES.EXPIRED_SUBSCRIPTION,
        deactivateSubscription: true,
        retryEligible: false,
      })
    );
    expect(classifyPushHttpStatus(404).deactivateSubscription).toBe(true);
  });

  test("classifies temporary failures without permanent deactivation", () => {
    const result = classifyPushHttpStatus(503);
    expect(result.outcome).toBe(PUSH_DELIVERY_OUTCOMES.TEMPORARY_SERVICE_FAILURE);
    expect(result.deactivateSubscription).toBe(false);
    expect(result.retryEligible).toBe(true);
    expect(shouldDeactivateSubscription(result.outcome)).toBe(false);
    expect(mapOutcomeToSubscriptionRecord(result.outcome)).toBe("temporary_failure");
  });

  test("classifies VAPID configuration failures", () => {
    const result = classifyPushHttpStatus(401);
    expect(result.outcome).toBe(PUSH_DELIVERY_OUTCOMES.VAPID_CONFIG_ERROR);
  });

  test("one failed device does not affect other subscriptions", () => {
    expect(
      isolateFailedSubscription({
        userSubscriptionCount: 3,
        failedSubscriptionId: "sub-1",
      })
    ).toEqual({
      failedSubscriptionId: "sub-1",
      remainingActiveSubscriptions: 2,
      otherDevicesUnaffected: true,
    });
  });
});
