/** @jest-environment node */

import {
  WEB_PUSH_DELIVERY_STATUS,
  claimWebPushDeliveryAttempt,
  isWebPushDeliveryRetryable,
  readWebPushDeliveryState,
} from "./webPushDeliveryState";

describe("webPushDeliveryState", () => {
  test("reads legacy delivered flag", () => {
    expect(readWebPushDeliveryState({ _web_push_delivered: true }).status).toBe("delivered");
  });

  test("retryable states include not_attempted and temporary_failure", () => {
    expect(isWebPushDeliveryRetryable(WEB_PUSH_DELIVERY_STATUS.NOT_ATTEMPTED)).toBe(true);
    expect(isWebPushDeliveryRetryable(WEB_PUSH_DELIVERY_STATUS.TEMPORARY_FAILURE)).toBe(true);
    expect(isWebPushDeliveryRetryable(WEB_PUSH_DELIVERY_STATUS.DELIVERED)).toBe(false);
    expect(isWebPushDeliveryRetryable(WEB_PUSH_DELIVERY_STATUS.NO_SUBSCRIPTION)).toBe(false);
  });

  test("claimWebPushDeliveryAttempt rejects already delivered notifications", async () => {
    const adminClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: "n1",
                payload: { _web_push: { status: "delivered" } },
              },
              error: null,
            }),
          })),
        })),
      })),
    };

    const claim = await claimWebPushDeliveryAttempt(adminClient, "n1");
    expect(claim.claimed).toBe(false);
    expect(claim.reason).toBe("already_delivered");
  });
});
