/** @jest-environment node */

import { resolveNewInquiryNotificationHref } from "./newInquiryNotificationRouting";
import { resolveNewInquiryPushDestination } from "../push/buildNewInquiryPushPayload";

describe("newInquiryNotificationRouting", () => {
  test("push and in-app resolvers agree for agent inbox conversation", () => {
    const input = {
      recipientRole: "agent",
      payload: { conversation_id: "conv-123" },
    };

    expect(resolveNewInquiryNotificationHref(input)).toBe(
      "/dashboard/agent?tab=inbox&conversation=conv-123"
    );
    expect(resolveNewInquiryPushDestination(input)).toBe(
      "/dashboard/agent?tab=inbox&conversation=conv-123"
    );
  });

  test("routes user-owner inbox conversation", () => {
    expect(
      resolveNewInquiryNotificationHref({
        recipientRole: "user",
        payload: { conversation_id: "conv-456" },
      })
    ).toBe("/dashboard/user?tab=inbox&conversation=conv-456");
  });

  test("routes admin inbox conversation", () => {
    expect(
      resolveNewInquiryNotificationHref({
        recipientRole: "admin",
        payload: { conversation_id: "conv-admin" },
      })
    ).toBe("/admin?tab=inbox&conversation=conv-admin");
  });
});
