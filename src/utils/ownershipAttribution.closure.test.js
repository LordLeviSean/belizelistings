/** @jest-environment node */

jest.mock("../lib/listingEvents/writeListingEvent", () => ({
  emitListingEventAfterMutation: jest.fn(),
  lifecycleActionToEventDescriptor: jest.fn(() => null),
  resolveEventWriteParams: jest.fn(),
}));

jest.mock("../lib/notifications/notificationEvents", () => ({
  enqueueNotificationEvent: jest.fn().mockResolvedValue({ ok: true }),
  NOTIFICATION_EVENT_TYPES: {
    LISTING_MARKED_SOLD: "listing_marked_sold",
    LISTING_MARKED_RENTED: "listing_marked_rented",
  },
}));

jest.mock("../lib/listingWriteContract", () => {
  const actual = jest.requireActual("../lib/listingWriteContract");
  return {
    ...actual,
    executeListingUpdate: jest.fn(),
  };
});

import { OWNERSHIP_ACTIONS } from "../constants/ownershipModel";
import {
  buildModerationApprovePatch,
  buildModerationResubmitPatch,
  buildRecentlySoldPatch,
  executeListingUpdate,
} from "../lib/listingWriteContract";
import {
  applyListingLifecycleAction,
  resolveListingLifecycleMutationPayload,
} from "./ownershipAttribution";

function buildSupabase(priorRow) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: priorRow?.user_id || "owner-1" } } }),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: priorRow, error: null }),
        })),
      })),
    })),
  };
}

describe("ownershipAttribution closure lifecycle payloads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    executeListingUpdate.mockResolvedValue({
      error: null,
      appliedPayload: {},
      meta: { attempts: 1 },
    });
  });

  test("resolveListingLifecycleMutationPayload preserves sold_at and closed_at for mark sold", () => {
    const patch = buildRecentlySoldPatch({ closedAt: "2026-07-26T19:00:00.000Z" });
    const payload = resolveListingLifecycleMutationPayload(OWNERSHIP_ACTIONS.CLOSE_SOLD);
    expect(payload.sold_at).toBeTruthy();
    expect(payload.closed_at).toBeTruthy();
    expect(payload.archived_at).toBeNull();
    expect(payload.lifecycle_status).toBe(patch.lifecycle_status);
  });

  test("resolveListingLifecycleMutationPayload preserves closure reset on approve and resubmit", () => {
    expect(resolveListingLifecycleMutationPayload(OWNERSHIP_ACTIONS.APPROVE)).toMatchObject(
      buildModerationApprovePatch()
    );
    expect(resolveListingLifecycleMutationPayload(OWNERSHIP_ACTIONS.REPUBLISH)).toMatchObject(
      buildModerationResubmitPatch()
    );
    expect(resolveListingLifecycleMutationPayload(OWNERSHIP_ACTIONS.APPROVE).sold_at).toBeNull();
    expect(resolveListingLifecycleMutationPayload(OWNERSHIP_ACTIONS.REPUBLISH).archived_at).toBeNull();
  });

  test("applyListingLifecycleAction sends closure timestamps to executeListingUpdate for mark sold", async () => {
    const supabase = buildSupabase({
      user_id: "db0127ba-21e6-40b7-a596-b2fcb9015cc0",
      title: "D St. Corner Lot",
      status: "approved",
      lifecycle_status: "approved",
      listing_type: "sale",
    });

    await applyListingLifecycleAction(supabase, {
      listingId: 108,
      action: OWNERSHIP_ACTIONS.CLOSE_SOLD,
    });

    expect(executeListingUpdate).toHaveBeenCalledWith(
      supabase,
      108,
      expect.objectContaining({
        lifecycle_status: "recently_sold",
        sold_at: expect.any(String),
        closed_at: expect.any(String),
        archived_at: null,
        rented_at: null,
      }),
      expect.objectContaining({ logTag: "lifecycle:close_sold" })
    );
  });
});
