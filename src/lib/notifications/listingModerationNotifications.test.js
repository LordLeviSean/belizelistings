/** @jest-environment node */

import { buildListingModerationNotificationPayload } from "./listingModerationNotifications";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";
import { OWNERSHIP_ACTIONS } from "../../constants/ownershipModel";
import { LISTING_LIFECYCLE } from "../../constants/operationalModel";
import { buildNotificationPresentation } from "./notificationCopyRegistry";

describe("listingModerationNotifications", () => {
  test("approve builds one durable listing_approved notification payload", () => {
    const { eventType, payload } = buildListingModerationNotificationPayload({
      action: OWNERSHIP_ACTIONS.APPROVE,
      listingId: 42,
      listingTitle: "Coastal Home",
      moderationVersion: "2026-07-26T12:00:00.000Z",
    });
    expect(eventType).toBe(NOTIFICATION_EVENT_TYPES.LISTING_APPROVED);
    expect(payload.to_status).toBe(LISTING_LIFECYCLE.PUBLISHED);
    expect(payload.dedupe_key).toBe("listing_approved:42:2026-07-26T12:00:00.000Z");
  });

  test("reject builds one durable listing_rejected notification payload", () => {
    const { eventType, payload } = buildListingModerationNotificationPayload({
      action: OWNERSHIP_ACTIONS.REJECT,
      listingId: 7,
      listingTitle: "Lagoon Villa",
      moderationVersion: "2026-07-26T12:05:00.000Z",
    });
    expect(eventType).toBe(NOTIFICATION_EVENT_TYPES.LISTING_REJECTED);
    expect(payload.to_status).toBe(LISTING_LIFECYCLE.REJECTED);
    expect(payload.dedupe_key).toBe("listing_rejected:7:2026-07-26T12:05:00.000Z");
  });

  test("new moderation cycle uses a distinct dedupe key", () => {
    const first = buildListingModerationNotificationPayload({
      action: OWNERSHIP_ACTIONS.APPROVE,
      listingId: 42,
      moderationVersion: "2026-07-26T12:00:00.000Z",
    });
    const second = buildListingModerationNotificationPayload({
      action: OWNERSHIP_ACTIONS.APPROVE,
      listingId: 42,
      moderationVersion: "2026-07-28T09:00:00.000Z",
    });
    expect(first.payload.dedupe_key).not.toBe(second.payload.dedupe_key);
  });

  test("approved deep link routes to My Listings", () => {
    const { eventType, payload } = buildListingModerationNotificationPayload({
      action: OWNERSHIP_ACTIONS.APPROVE,
      listingId: 42,
      moderationVersion: "2026-07-26T12:00:00.000Z",
    });
    const pres = buildNotificationPresentation(eventType, payload);
    expect(pres.href).toBe("/dashboard/user?tab=my-listings&listing=42");
  });

  test("rejected deep link routes to editable My Listings row", () => {
    const { eventType, payload } = buildListingModerationNotificationPayload({
      action: OWNERSHIP_ACTIONS.REJECT,
      listingId: 42,
      moderationVersion: "2026-07-26T12:00:00.000Z",
    });
    const pres = buildNotificationPresentation(eventType, payload);
    expect(pres.href).toBe("/dashboard/user?tab=my-listings&listing=42");
  });
});
