/** @jest-environment node */

import {
  SELF_INQUIRY_MESSAGE,
  SELF_VIEWING_MESSAGE,
  isSelfListingContact,
  resolveListingCrmRecipientUserId,
  selfInquiryBlockedResult,
  selfViewingBlockedResult,
} from "./listingSelfContact";

describe("listingSelfContact", () => {
  test("resolveListingCrmRecipientUserId prefers listing.user_id", () => {
    expect(
      resolveListingCrmRecipientUserId({ id: 1, user_id: "owner-1" }, { userId: "contact-9" })
    ).toBe("owner-1");
  });

  test("owner cannot contact own listing", () => {
    expect(
      isSelfListingContact({
        viewerUserId: "owner-1",
        listing: { id: 1, user_id: "owner-1" },
      })
    ).toBe(true);
  });

  test("assigned agent on someone else's listing is not blocked", () => {
    expect(
      isSelfListingContact({
        viewerUserId: "agent-1",
        listing: { id: 1, user_id: "owner-1", managed_by: "agent-1" },
        recipientUserId: "owner-1",
      })
    ).toBe(false);
  });

  test("unrelated buyer is not blocked", () => {
    expect(
      isSelfListingContact({
        viewerUserId: "buyer-1",
        listing: { id: 1, user_id: "owner-1" },
        recipientUserId: "owner-1",
      })
    ).toBe(false);
  });

  test("admin browsing another listing is not blocked", () => {
    expect(
      isSelfListingContact({
        viewerUserId: "admin-1",
        listing: { id: 1, user_id: "owner-1" },
        recipientUserId: "owner-1",
      })
    ).toBe(false);
  });

  test("blocked result helpers expose stable codes and copy", () => {
    expect(selfInquiryBlockedResult().error.code).toBe("self_inquiry_not_allowed");
    expect(selfInquiryBlockedResult().error.message).toBe(SELF_INQUIRY_MESSAGE);
    expect(selfViewingBlockedResult().error.code).toBe("self_viewing_not_allowed");
    expect(selfViewingBlockedResult().error.message).toBe(SELF_VIEWING_MESSAGE);
  });
});
