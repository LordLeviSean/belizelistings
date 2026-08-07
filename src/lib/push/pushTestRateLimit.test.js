/** @jest-environment node */

import {
  __resetPushTestRateLimitForTests,
  checkPushTestRateLimit,
  recordPushTestSent,
  PUSH_TEST_COOLDOWN_MS,
} from "./pushTestRateLimit";

describe("pushTestRateLimit", () => {
  beforeEach(() => {
    __resetPushTestRateLimitForTests();
  });

  test("allows first send and blocks within cooldown", () => {
    expect(checkPushTestRateLimit("user-1", 1000)).toEqual({ allowed: true, retryAfterMs: 0 });
    recordPushTestSent("user-1", 1000);
    expect(checkPushTestRateLimit("user-1", 2000)).toEqual({
      allowed: false,
      retryAfterMs: PUSH_TEST_COOLDOWN_MS - 1000,
    });
  });
});
