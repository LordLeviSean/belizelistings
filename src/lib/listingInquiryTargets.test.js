/** @jest-environment node */

import { resolveListingAgentUserId } from "./listingInquiryTargets";

describe("resolveListingAgentUserId", () => {
  test("prefers listing.user_id when present", () => {
    expect(
      resolveListingAgentUserId({ id: 1, user_id: "owner-1" }, { userId: "contact-1" })
    ).toBe("owner-1");
  });

  test("falls back to contact.userId when listing user_id is hidden", () => {
    expect(resolveListingAgentUserId({ id: 1 }, { userId: "owner-from-rpc" })).toBe("owner-from-rpc");
  });

  test("returns null when neither source is available", () => {
    expect(resolveListingAgentUserId({ id: 1 }, null)).toBeNull();
  });
});
