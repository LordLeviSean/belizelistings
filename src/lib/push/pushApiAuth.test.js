/** @jest-environment node */

import { isAuthorizedPushMutationRequest, readBearerToken } from "./pushApiAuth";

describe("pushApiAuth", () => {
  test("accepts allowed origin and referer", () => {
    expect(
      isAuthorizedPushMutationRequest({
        headers: { origin: "https://belizelistings.bz" },
      })
    ).toBe(true);
    expect(
      isAuthorizedPushMutationRequest({
        headers: { referer: "https://belizelistings.bz/dashboard/user?tab=profile" },
      })
    ).toBe(true);
    expect(
      isAuthorizedPushMutationRequest({
        headers: { origin: "https://evil.example" },
      })
    ).toBe(false);
  });

  test("reads bearer token", () => {
    expect(readBearerToken({ headers: { authorization: "Bearer abc123" } })).toBe("abc123");
  });
});
