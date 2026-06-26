jest.mock("./listingWriteContract", () => ({
  executeListingInsert: jest.fn(),
}));

jest.mock("./listingEvents", () => ({
  emitListingEventAfterMutation: jest.fn().mockResolvedValue({ ok: true, eventId: "evt-1" }),
  buildCreatedPayload: jest.fn(({ lifecycleStatus, title }) => ({
    lifecycle_status: lifecycleStatus,
    title,
  })),
  LISTING_EVENT_TYPES: { CREATED: "listing.created" },
}));

import { safeInsertListing } from "./listingPersistence";
import { executeListingInsert } from "./listingWriteContract";
import { emitListingEventAfterMutation, LISTING_EVENT_TYPES } from "./listingEvents";

describe("safeInsertListing lifecycle events", () => {
  beforeEach(() => {
    executeListingInsert.mockReset();
    emitListingEventAfterMutation.mockClear();
  });

  test("emits listing.created after successful insert", async () => {
    executeListingInsert.mockResolvedValue({
      data: { id: 91, title: "Corner Lot", status: "draft", lifecycle_status: "draft" },
      error: null,
      appliedPayload: { user_id: "user-1", title: "Corner Lot", lifecycle_status: "draft" },
      meta: { strippedKeys: [], attempts: 1, usedMinimalFinalSafe: false },
    });
    const supabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    };

    const result = await safeInsertListing(supabase, { title: "Corner Lot", user_id: "user-1" });

    expect(result.error).toBeNull();
    expect(emitListingEventAfterMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        client: supabase,
        listingId: "91",
        eventType: LISTING_EVENT_TYPES.CREATED,
        actorId: "user-1",
        actorRole: "agent",
      })
    );
  });
});
