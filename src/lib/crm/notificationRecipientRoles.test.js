/** @jest-environment node */

import {
  isListingOwnerRecipient,
  withNotificationRecipientRole,
} from "./notificationRecipientRoles";

describe("notificationRecipientRoles", () => {
  test("platform-user listing owner gets user role and owner side", () => {
    const payload = withNotificationRecipientRole(
      "owner-1",
      { listingOwnerUserId: "owner-1" },
      { recipient_role: "agent" }
    );
    expect(payload).toEqual({
      recipient_role: "user",
      recipient_side: "owner",
    });
  });

  test("agent dashboard listing owner keeps agent role", () => {
    const payload = withNotificationRecipientRole(
      "owner-1",
      { listingOwnerUserId: "owner-1", ownerDashboardRole: "agent" },
      {}
    );
    expect(payload).toEqual({
      recipient_role: "agent",
      recipient_side: "agent",
    });
  });

  test("buyer requester gets buyer side", () => {
    const payload = withNotificationRecipientRole(
      "buyer-2",
      { requesterId: "buyer-2" },
      {}
    );
    expect(payload).toEqual({
      recipient_role: "user",
      recipient_side: "buyer",
    });
  });

  test("isListingOwnerRecipient matches listing owner id", () => {
    expect(isListingOwnerRecipient("u1", "u1")).toBe(true);
    expect(isListingOwnerRecipient("u2", "u1")).toBe(false);
  });
});
