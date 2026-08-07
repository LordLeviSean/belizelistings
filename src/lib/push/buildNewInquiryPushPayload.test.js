/** @jest-environment node */

import {
  buildNewInquiryPushPayload,
  NEW_INQUIRY_PUSH_BODY,
  NEW_INQUIRY_PUSH_TITLE,
  resolveNewInquiryPushDestination,
} from "./buildNewInquiryPushPayload";

describe("buildNewInquiryPushPayload", () => {
  test("uses privacy-conscious copy without contact details", () => {
    const built = buildNewInquiryPushPayload({
      notificationId: "11111111-1111-1111-1111-111111111111",
      dedupeKey: "new_inquiry:inq-1",
      href: "/dashboard/agent?tab=inbox&conversation=abc",
    });

    expect(built.ok).toBe(true);
    expect(built.payload).toEqual(
      expect.objectContaining({
        title: NEW_INQUIRY_PUSH_TITLE,
        body: NEW_INQUIRY_PUSH_BODY,
        eventType: "new_inquiry",
        href: "/dashboard/agent?tab=inbox&conversation=abc",
        tag: "new_inquiry:inq-1",
      })
    );
    expect(JSON.stringify(built.payload)).not.toMatch(/phone|email|@|token|bearer/i);
  });

  test("routes to role-aware inbox conversation destination", () => {
    expect(
      resolveNewInquiryPushDestination({
        recipientRole: "agent",
        payload: { conversation_id: "conv-1" },
      })
    ).toBe("/dashboard/agent?tab=inbox&conversation=conv-1");

    expect(
      resolveNewInquiryPushDestination({
        recipientRole: "user",
        payload: { conversation_id: "conv-2" },
      })
    ).toBe("/dashboard/user?tab=inbox&conversation=conv-2");
  });
});
