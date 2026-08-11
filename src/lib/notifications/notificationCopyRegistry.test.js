/** @jest-environment node */

import {
  buildNotificationPresentation,
  mapNotificationRowToCenterItem,
  NOTIFICATION_CATEGORIES,
} from "./notificationCopyRegistry";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";

describe("notificationCopyRegistry", () => {
  test("new_inquiry uses inquiry category and agent inbox href", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, {
      inquiry_id: "inq-1",
      conversation_id: "conv-1",
      inquiry_type: "general",
      sender_name: "Alexis Marie",
      listing_title: "Finca Solana",
      recipient_role: "agent",
    });
    expect(pres.category).toBe(NOTIFICATION_CATEGORIES.INQUIRY);
    expect(pres.title).toBe("New property inquiry");
    expect(pres.body).toContain("Finca Solana");
    expect(pres.href).toBe("/dashboard/agent?tab=inbox&conversation=conv-1");
    expect(pres.dedupeKey).toBe("new_inquiry:inq-1");
  });

  test("schedule_viewing inquiry uses viewing copy", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, {
      inquiry_id: "inq-2",
      inquiry_type: "schedule_viewing",
      sender_name: "Buyer",
      listing_title: "Coastal Home",
    });
    expect(pres.title).toBe("New viewing request");
    expect(pres.body).toMatch(/viewing/i);
  });

  test("agent_replied routes buyer to inbox with conversation", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.AGENT_REPLIED, {
      conversation_id: "c1",
      message_id: "m1",
      recipient_user_id: "buyer-1",
      listing_title: "Finca Solana",
      recipient_role: "user",
    });
    expect(pres.dedupeKey).toBe("agent_replied:m1:buyer-1");
    expect(pres.href).toBe("/dashboard/user?tab=inbox&conversation=c1");
  });

  test("viewing_requested includes listing and slot in body", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED, {
      viewing_id: "v1",
      listing_id: 12,
      listing_title: "Finca Solana",
      sender_name: "Alexis Marie",
      requested_date: "2026-07-15",
      requested_time: "08:00",
      slot_label: "Wednesday, July 15 · 8:00 AM",
      recipient_role: "agent",
      recipient_side: "agent",
      recipient_user_id: "agent-1",
    });
    expect(pres.title).toBe("New viewing request");
    expect(pres.body).toContain("Alexis Marie");
    expect(pres.body).toContain("Finca Solana");
    expect(pres.body).toContain("8:00 AM");
    expect(pres.dedupeKey).toBe("viewing_requested:v1:agent-1");
    expect(pres.href).toBe("/dashboard/agent?tab=viewings&viewing=v1");
  });

  test("viewing_declined preserves viewing entity_id for deep link", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED, {
      viewing_id: "v-decline-1",
      listing_title: "Finca Solana",
      recipient_role: "user",
    });
    expect(pres.title).toBe("Viewing declined");
    expect(pres.entityId).toBe("v-decline-1");
    expect(pres.href).toBe("/dashboard/user?tab=viewings&viewing=v-decline-1");
  });

  test("viewing_rescheduled preserves viewing entity_id for deep link", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.VIEWING_RESCHEDULED, {
      viewing_id: "v-resched-1",
      listing_title: "Finca Solana",
      slot_label: "Thursday, July 16 · 10:30 AM",
      proposed_date: "2026-07-16",
      recipient_role: "agent",
    });
    expect(pres.title).toBe("Viewing rescheduled");
    expect(pres.entityId).toBe("v-resched-1");
    expect(pres.href).toBe("/dashboard/agent?tab=viewings&viewing=v-resched-1");
  });

  test("mapNotificationRowToCenterItem preserves unread state", () => {
    const item = mapNotificationRowToCenterItem({
      id: "n1",
      event_type: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
      category: "inquiry",
      title: "Viewing confirmed",
      body: "Confirmed.",
      payload: { viewing_id: "v1" },
      read_at: null,
      created_at: "2026-06-27T12:00:00.000Z",
    });
    expect(item.unread).toBe(true);
    expect(item.id).toBe("notif-n1");
    expect(item.notificationId).toBe("n1");
    expect(item.href).toBe("/dashboard/user?tab=viewings&viewing=v1");
  });
});
