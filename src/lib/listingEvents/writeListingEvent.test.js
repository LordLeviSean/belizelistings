import {
  buildVerificationApprovedPayload,
  buildVerificationRemovedPayload,
  lifecycleActionToEventDescriptor,
} from "./buildListingEventPayload";
import { LISTING_EVENT_TYPES } from "./listingEventTypes";
import { OWNERSHIP_ACTIONS } from "../../constants/ownershipModel";
import { writeListingEvent } from "./writeListingEvent";

describe("buildListingEventPayload", () => {
  test("buildVerificationApprovedPayload includes admin metadata", () => {
    const payload = buildVerificationApprovedPayload({
      verifiedAt: "2026-06-26T12:00:00.000Z",
      verifiedBy: "admin-1",
      adminUserId: "admin-1",
    });
    expect(payload.verification_status).toBe("verified");
    expect(payload.verified_by).toBe("admin-1");
    expect(payload.verified_at).toBe("2026-06-26T12:00:00.000Z");
  });

  test("buildVerificationRemovedPayload preserves previous stamp", () => {
    const payload = buildVerificationRemovedPayload({
      previousVerifiedAt: "2026-06-25T10:00:00.000Z",
      previousVerifiedBy: "admin-1",
    });
    expect(payload.verification_status).toBe("unverified");
    expect(payload.previous_verified_by).toBe("admin-1");
  });

  test("lifecycleActionToEventDescriptor maps approve to published", () => {
    const descriptor = lifecycleActionToEventDescriptor(OWNERSHIP_ACTIONS.APPROVE, {
      fromStatus: "pending",
      toStatus: "approved",
    });
    expect(descriptor.eventType).toBe(LISTING_EVENT_TYPES.PUBLISHED);
  });
});

describe("writeListingEvent", () => {
  test("attempts RPC even when read feature flag is disabled", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: "event-uuid", error: null }),
    };
    const result = await writeListingEvent({
      client,
      listingId: "listing-1",
      eventType: LISTING_EVENT_TYPES.VERIFICATION_APPROVED,
    });
    expect(result.ok).toBe(true);
    expect(result.eventId).toBe("event-uuid");
    expect(result.skipped).toBeUndefined();
    expect(client.rpc).toHaveBeenCalledWith("append_listing_event", expect.any(Object));
  });

  test("skips gracefully when listing_events RPC is unavailable", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "could not find the function append_listing_event" },
      }),
    };
    const result = await writeListingEvent({
      client,
      listingId: "listing-1",
      eventType: LISTING_EVENT_TYPES.VERIFICATION_APPROVED,
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });

  test("calls append_listing_event RPC when forced", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: "event-uuid", error: null }),
    };
    const result = await writeListingEvent({
      client,
      listingId: "listing-1",
      eventType: LISTING_EVENT_TYPES.VERIFICATION_APPROVED,
      payload: { verified_by: "admin-1" },
      visibility: "public",
      actorId: "admin-1",
      actorRole: "admin",
      source: "admin",
      force: true,
    });
    expect(result.ok).toBe(true);
    expect(result.eventId).toBe("event-uuid");
    expect(client.rpc).toHaveBeenCalledWith(
      "append_listing_event",
      expect.objectContaining({
        p_listing_id: "listing-1",
        p_event_type: LISTING_EVENT_TYPES.VERIFICATION_APPROVED,
        p_visibility: "public",
      })
    );
  });

  test("coerces numeric listing id for bigint RPC", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: "event-uuid", error: null }),
    };
    await writeListingEvent({
      client,
      listingId: "12345",
      eventType: LISTING_EVENT_TYPES.CREATED,
      force: true,
    });
    expect(client.rpc).toHaveBeenCalledWith(
      "append_listing_event",
      expect.objectContaining({ p_listing_id: 12345 })
    );
  });

  test("rejects missing listingId", async () => {
    const result = await writeListingEvent({
      client: { rpc: jest.fn() },
      listingId: "",
      eventType: LISTING_EVENT_TYPES.PUBLISHED,
      force: true,
    });
    expect(result.ok).toBe(false);
  });
});
