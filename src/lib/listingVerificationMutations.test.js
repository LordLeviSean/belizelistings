jest.mock("./listingEvents", () => {
  const actual = jest.requireActual("./listingEvents");
  return {
    ...actual,
    emitListingEventAfterMutation: jest.fn().mockResolvedValue({ ok: true, eventId: "event-id" }),
  };
});

import {
  buildListingVerificationPatch,
  applyListingVerificationAction,
} from "./listingVerificationMutations";
import { emitListingEventAfterMutation } from "./listingEvents";
import { VERIFICATION_STATUS } from "../constants/trustModel";

describe("listingVerificationMutations", () => {
  beforeEach(() => {
    emitListingEventAfterMutation.mockClear();
    emitListingEventAfterMutation.mockResolvedValue({ ok: true, eventId: "event-id" });
  });

  test("buildListingVerificationPatch sets metadata on verify", () => {
    const patch = buildListingVerificationPatch({
      verified: true,
      adminUserId: "admin-uuid",
    });
    expect(patch.verification_status).toBe(VERIFICATION_STATUS.VERIFIED);
    expect(patch.verified_by).toBe("admin-uuid");
    expect(patch.verified_at).toBeTruthy();
  });

  test("buildListingVerificationPatch clears metadata on unverify", () => {
    const patch = buildListingVerificationPatch({
      verified: false,
      adminUserId: "admin-uuid",
    });
    expect(patch.verification_status).toBe(VERIFICATION_STATUS.UNVERIFIED);
    expect(patch.verified_by).toBeNull();
    expect(patch.verified_at).toBeNull();
  });

  test("applyListingVerificationAction rejects missing ids", async () => {
    const result = await applyListingVerificationAction({
      listingId: "",
      verified: true,
      adminUserId: "",
      client: {},
    });
    expect(result.ok).toBe(false);
  });

  test("applyListingVerificationAction emits verification approved event after patch", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      from: jest.fn(() => ({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: "listing-1",
                  verification_status: "verified",
                  verified_at: "2026-06-26T12:00:00.000Z",
                  verified_by: "admin-uuid",
                },
                error: null,
              }),
            }),
          }),
        }),
      })),
    };

    const result = await applyListingVerificationAction({
      listingId: "listing-1",
      verified: true,
      adminUserId: "admin-uuid",
      client,
    });

    expect(result.ok).toBe(true);
    expect(result.eventEmitted).toBe(true);
    expect(emitListingEventAfterMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: "listing-1",
        eventType: "listing.verification.approved",
        visibility: "public",
      })
    );
  });
});
