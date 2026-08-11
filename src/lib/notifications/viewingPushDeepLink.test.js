import { resolveViewingRequestedPushDestination } from "@/lib/push/buildViewingRequestedPushPayload";
import { resolveViewingConfirmedPushDestination } from "@/lib/push/buildViewingConfirmedPushPayload";
import { buildNotificationPresentation } from "@/lib/notifications/notificationCopyRegistry";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";

describe("viewing_requested push deep-link routing", () => {
  test("push href opens agent viewings on exact viewing request", () => {
    const href = resolveViewingRequestedPushDestination({
      recipientRole: "agent",
      payload: {
        viewing_id: "view-push-1",
        recipient_side: "agent",
      },
    });
    expect(href).toBe("/dashboard/agent?tab=viewings&viewing=view-push-1");
  });

  test("owner on user dashboard gets user viewings deep link", () => {
    const href = resolveViewingRequestedPushDestination({
      recipientRole: "user",
      payload: {
        viewing_id: "view-owner-1",
        recipient_side: "owner",
      },
    });
    expect(href).toBe("/dashboard/user?tab=viewings&viewing=view-owner-1");
  });

  test("in-app presentation matches push destination", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED, {
      viewing_id: "view-push-2",
      recipient_role: "agent",
      recipient_side: "agent",
      recipient_user_id: "agent-1",
      requested_date: "2026-07-15",
      requested_time: "08:00",
      sender_name: "Alexis Marie",
      listing_title: "Finca Solana",
    });
    expect(pres.href).toBe("/dashboard/agent?tab=viewings&viewing=view-push-2");
  });
});

describe("viewing_confirmed push deep-link routing", () => {
  test("push href opens buyer viewings on exact viewing request", () => {
    const href = resolveViewingConfirmedPushDestination({
      recipientRole: "user",
      payload: {
        viewing_id: "view-confirmed-1",
        recipient_side: "buyer",
      },
    });
    expect(href).toBe("/dashboard/user?tab=viewings&viewing=view-confirmed-1");
  });

  test("in-app presentation matches push destination for buyer", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED, {
      viewing_id: "view-confirmed-2",
      recipient_role: "user",
      recipient_side: "buyer",
      recipient_user_id: "buyer-1",
      requested_date: "2026-07-15",
      requested_time: "10:00",
      listing_title: "Finca Solana",
    });
    expect(pres.href).toBe("/dashboard/user?tab=viewings&viewing=view-confirmed-2");
    expect(pres.body).toContain("10:00 AM");
  });
});
