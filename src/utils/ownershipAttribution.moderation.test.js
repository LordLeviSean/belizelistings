/** @jest-environment node */

jest.mock("../lib/notifications/notificationEvents", () => ({
  enqueueNotificationEvent: jest.fn().mockResolvedValue({ ok: true, queueId: "queue-1" }),
  NOTIFICATION_EVENT_TYPES: {
    LISTING_APPROVED: "listing_approved",
    LISTING_REJECTED: "listing_rejected",
    LISTING_MARKED_SOLD: "listing_marked_sold",
    LISTING_MARKED_RENTED: "listing_marked_rented",
  },
}));

jest.mock("../lib/listingWriteContract", () => ({
  buildModerationApprovePatch: jest.fn(() => ({
    status: "approved",
    lifecycle_status: "published",
    moderation_status: "approved",
    updated_at: "2026-07-26T12:00:00.000Z",
  })),
  buildModerationApproveFallback: jest.fn(),
  buildModerationRejectPatch: jest.fn(),
  buildModerationRejectFallback: jest.fn(),
  buildModerationArchivePatch: jest.fn(),
  buildModerationArchiveFallback: jest.fn(),
  buildModerationResubmitPatch: jest.fn(),
  buildModerationResubmitFallback: jest.fn(),
  buildRecentlyRentedPatch: jest.fn(),
  buildRecentlyRentedFallback: jest.fn(),
  buildRecentlySoldPatch: jest.fn(),
  buildRecentlySoldFallback: jest.fn(),
  executeListingUpdate: jest.fn(),
}));

jest.mock("../lib/listingEvents/writeListingEvent", () => ({
  emitListingEventAfterMutation: jest.fn(),
  lifecycleActionToEventDescriptor: jest.fn(() => ({ eventType: "listing.published" })),
  resolveEventWriteParams: jest.fn(),
}));

import { applyListingLifecycleAction } from "./ownershipAttribution";
import { OWNERSHIP_ACTIONS } from "../constants/ownershipModel";
import { enqueueNotificationEvent } from "../lib/notifications/notificationEvents";
import { executeListingUpdate } from "../lib/listingWriteContract";

function buildSupabase(priorRow) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: priorRow, error: null }),
        })),
      })),
    })),
    rpc: jest.fn(),
  };
}

describe("applyListingLifecycleAction moderation notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    executeListingUpdate.mockResolvedValue({
      error: null,
      appliedPayload: {
        status: "approved",
        lifecycle_status: "published",
        moderation_status: "approved",
        updated_at: "2026-07-26T12:00:00.000Z",
      },
      meta: { attempts: 1 },
    });
  });

  test("approve enqueues listing_approved for listing owner with cycle dedupe key", async () => {
    const supabase = buildSupabase({
      user_id: "owner-1",
      title: "Coastal Home",
      status: "pending",
      lifecycle_status: "pending",
    });

    await applyListingLifecycleAction(supabase, {
      listingId: 42,
      action: OWNERSHIP_ACTIONS.APPROVE,
    });

    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        eventType: "listing_approved",
        recipientId: "owner-1",
        payload: expect.objectContaining({
          listing_id: 42,
          listing_title: "Coastal Home",
          dedupe_key: "listing_approved:42:2026-07-26T12:00:00.000Z",
        }),
      })
    );
  });

  test("reject enqueues listing_rejected for listing owner", async () => {
    executeListingUpdate.mockResolvedValueOnce({
      error: null,
      appliedPayload: {
        status: "rejected",
        lifecycle_status: "rejected",
        moderation_status: "rejected",
        updated_at: "2026-07-26T12:05:00.000Z",
      },
      meta: { attempts: 1 },
    });
    const supabase = buildSupabase({
      user_id: "owner-2",
      title: "Lagoon Villa",
      status: "pending",
      lifecycle_status: "pending",
    });

    await applyListingLifecycleAction(supabase, {
      listingId: 7,
      action: OWNERSHIP_ACTIONS.REJECT,
    });

    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        eventType: "listing_rejected",
        recipientId: "owner-2",
      })
    );
  });
});
