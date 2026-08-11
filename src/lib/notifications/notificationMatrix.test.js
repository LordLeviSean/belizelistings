/** @jest-environment node */

import { buildNotificationPresentation } from "./notificationCopyRegistry";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";

const LISTING = "Finca Solana Seaview Residential";
const SENDER = "Alexis Marie";
const SLOT = "Wednesday, July 15 • 8:00 AM";

describe("CRM notification matrix", () => {
  test("buyer message notifies owner with listing and sender", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, {
      conversation_id: "conv-1",
      message_id: "msg-1",
      listing_title: LISTING,
      sender_name: SENDER,
      recipient_role: "agent",
      recipient_side: "owner",
    });
    expect(pres.title).toBe("New message received");
    expect(pres.body).toContain(SENDER);
    expect(pres.body).toContain(LISTING);
    expect(pres.href).toBe("/dashboard/agent?tab=inbox&conversation=conv-1");
    expect(pres.dedupeKey).toBe("new_inquiry:msg-1");
  });

  test("owner reply notifies buyer", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.AGENT_REPLIED, {
      conversation_id: "conv-2",
      message_id: "msg-2",
      recipient_user_id: "buyer-9",
      listing_title: LISTING,
      recipient_role: "user",
    });
    expect(pres.title).toBe("You received a reply");
    expect(pres.body).toContain(LISTING);
    expect(pres.href).toBe("/dashboard/user?tab=inbox&conversation=conv-2");
    expect(pres.dedupeKey).toBe("agent_replied:msg-2:buyer-9");
  });

  test("viewing requested notifies owner with slot", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED, {
      viewing_id: "v-1",
      listing_title: LISTING,
      sender_name: SENDER,
      slot_label: SLOT,
      recipient_role: "user",
      recipient_side: "owner",
    });
    expect(pres.title).toBe("New viewing request");
    expect(pres.body).toContain(SENDER);
    expect(pres.body).toContain(LISTING);
    expect(pres.body).toContain("July 15");
    expect(pres.href).toBe("/dashboard/user?tab=viewings&viewing=v-1");
  });

  test("viewing confirmed notifies buyer", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED, {
      viewing_id: "v-2",
      listing_title: LISTING,
      slot_label: SLOT,
      recipient_role: "user",
    });
    expect(pres.title).toBe("Viewing confirmed");
    expect(pres.body).toContain(LISTING);
    expect(pres.href).toBe("/dashboard/user?tab=viewings&viewing=v-2");
  });

  test("viewing declined notifies buyer", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED, {
      viewing_id: "v-3",
      listing_title: LISTING,
      recipient_role: "user",
    });
    expect(pres.title).toBe("Viewing declined");
    expect(pres.body).toContain(LISTING);
  });

  test("viewing rescheduled notifies recipient with proposed slot", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_RESCHEDULED, {
      viewing_id: "v-4",
      listing_title: LISTING,
      proposed_date: "2026-07-16",
      proposed_time: "10:30",
      slot_label: "Thursday, July 16 • 10:30 AM",
      recipient_role: "user",
    });
    expect(pres.title).toBe("Viewing rescheduled");
    expect(pres.body).toContain(LISTING);
    expect(pres.body).toContain("July 16");
  });

  test("buyer declining proposed time notifies owner", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_RESCHEDULED, {
      viewing_id: "v-5",
      listing_title: LISTING,
      sender_name: SENDER,
      reschedule_declined: true,
      recipient_role: "agent",
    });
    expect(pres.title).toBe("Reschedule declined");
    expect(pres.body).toContain(SENDER);
    expect(pres.body).toContain(LISTING);
  });

  test("viewing cancelled deep links to viewings", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_CANCELLED, {
      viewing_id: "v-6",
      listing_title: LISTING,
      recipient_role: "user",
    });
    expect(pres.href).toBe("/dashboard/user?tab=viewings&viewing=v-6");
  });

  test("viewing completed is future-ready", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_COMPLETED, {
      viewing_id: "v-7",
      listing_title: LISTING,
      recipient_role: "user",
    });
    expect(pres.title).toBe("Viewing completed");
    expect(pres.body).toContain(LISTING);
    expect(pres.dedupeKey).toBe("viewing_completed:v-7");
  });
});
