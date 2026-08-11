import { resolveNewInquiryNotificationHref } from "./newInquiryNotificationRouting";
import { resolveNotificationDestination } from "@/lib/dashboardCrmRoutes";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";
import { buildNotificationPresentation } from "./notificationCopyRegistry";

describe("inquiry push deep-link routing", () => {
  test("new_inquiry push href opens agent inbox on exact conversation", () => {
    const href = resolveNewInquiryNotificationHref({
      recipientRole: "agent",
      payload: { conversation_id: "conv-push-1", inquiry_id: "inq-1" },
    });
    expect(href).toBe("/dashboard/agent?tab=inbox&conversation=conv-push-1");
  });

  test("new_inquiry in-app presentation matches push destination", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, {
      conversation_id: "conv-push-2",
      recipient_role: "agent",
      listing_title: "Beach House",
      sender_name: "Buyer",
    });
    expect(pres.href).toBe("/dashboard/agent?tab=inbox&conversation=conv-push-2");
  });

  test("agent_replied href opens buyer inbox on exact conversation", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.AGENT_REPLIED,
      role: "user",
      payload: {
        conversation_id: "conv-reply-1",
        recipient_role: "user",
        recipient_side: "buyer",
      },
    });
    expect(href).toBe("/dashboard/user?tab=inbox&conversation=conv-reply-1");
  });
});
