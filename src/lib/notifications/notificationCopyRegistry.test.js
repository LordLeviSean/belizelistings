/** @jest-environment node */

import {
  buildNotificationPresentation,
  mapNotificationRowToCenterItem,
  NOTIFICATION_CATEGORIES,
} from "./notificationCopyRegistry";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";

describe("notificationCopyRegistry", () => {
  test("new_inquiry uses inquiry category and agent href", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, {
      inquiry_id: "inq-1",
      conversation_id: "conv-1",
      inquiry_type: "general",
    });
    expect(pres.category).toBe(NOTIFICATION_CATEGORIES.INQUIRY);
    expect(pres.title).toMatch(/inquiry/i);
    expect(pres.href).toBe("/dashboard/agent");
    expect(pres.dedupeKey).toBe("new_inquiry:inq-1");
  });

  test("schedule_viewing inquiry uses viewing copy", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, {
      inquiry_id: "inq-2",
      inquiry_type: "schedule_viewing",
    });
    expect(pres.body).toMatch(/viewing/i);
  });

  test("agent_replied dedupe includes message id", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.AGENT_REPLIED, {
      conversation_id: "c1",
      message_id: "m1",
    });
    expect(pres.dedupeKey).toBe("agent_replied:c1:m1");
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
  });
});
