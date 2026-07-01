import { LISTING_LIFECYCLE } from "../constants/operationalModel";

jest.mock("./listingPermanentDelete", () => {
  const actual = jest.requireActual("./listingPermanentDelete");
  return {
    ...actual,
    bestEffortRemoveListingImageStorage: jest.fn().mockResolvedValue(undefined),
    invokePermanentDeleteListingRpc: jest.fn(),
  };
});

import { discardDraftListing } from "./listingPersistence";
import {
  bestEffortRemoveListingImageStorage,
  invokePermanentDeleteListingRpc,
} from "./listingPermanentDelete";

function mockSupabaseForDiscardDraft({ listingRow, imageRows = [] }) {
  const from = jest.fn((table) => {
    if (table === "listings") {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: listingRow, error: null }),
      };
    }
    if (table === "listing_images") {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: imageRows, error: null }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
  });
  return { from };
}

describe("discardDraftListing", () => {
  beforeEach(() => {
    invokePermanentDeleteListingRpc.mockReset();
    bestEffortRemoveListingImageStorage.mockClear();
  });

  test("rejects non-draft listing before RPC", async () => {
    const supabase = mockSupabaseForDiscardDraft({
      listingRow: {
        id: 5,
        user_id: "owner-1",
        status: "approved",
        lifecycle_status: "published",
      },
    });

    const { error } = await discardDraftListing(supabase, {
      listingId: "5",
      userId: "owner-1",
    });
    expect(error?.message).toBe("Only drafts can be discarded from here.");
    expect(invokePermanentDeleteListingRpc).not.toHaveBeenCalled();
  });

  test("owner discard calls RPC and cleans up storage", async () => {
    const imageRows = [
      { image_url: "https://example.test/storage/v1/object/public/listing-images/a.webp" },
    ];
    const supabase = mockSupabaseForDiscardDraft({
      listingRow: {
        id: 12,
        user_id: "owner-1",
        status: LISTING_LIFECYCLE.DRAFT,
        lifecycle_status: LISTING_LIFECYCLE.DRAFT,
      },
      imageRows,
    });
    invokePermanentDeleteListingRpc.mockResolvedValue({ ok: true });

    const { error } = await discardDraftListing(supabase, {
      listingId: "12",
      userId: "owner-1",
    });
    expect(error).toBeNull();
    expect(invokePermanentDeleteListingRpc).toHaveBeenCalledWith(supabase, "12");
    expect(bestEffortRemoveListingImageStorage).toHaveBeenCalledWith(supabase, imageRows);
  });

  test("admin discard delegates authorization to RPC", async () => {
    const supabase = mockSupabaseForDiscardDraft({
      listingRow: {
        id: 12,
        user_id: "other-owner",
        status: LISTING_LIFECYCLE.DRAFT,
        lifecycle_status: LISTING_LIFECYCLE.DRAFT,
      },
    });
    invokePermanentDeleteListingRpc.mockResolvedValue({ ok: true });

    const { error } = await discardDraftListing(supabase, {
      listingId: "12",
      userId: "admin-user",
    });
    expect(error).toBeNull();
    expect(invokePermanentDeleteListingRpc).toHaveBeenCalledWith(supabase, "12");
  });

  test("non-owner blocked via RPC error mapping", async () => {
    const supabase = mockSupabaseForDiscardDraft({
      listingRow: {
        id: 12,
        user_id: "owner-1",
        status: LISTING_LIFECYCLE.DRAFT,
        lifecycle_status: LISTING_LIFECYCLE.DRAFT,
      },
    });
    invokePermanentDeleteListingRpc.mockResolvedValue({
      ok: false,
      error: new Error("You are not allowed to permanently delete this listing."),
    });

    const { error } = await discardDraftListing(supabase, {
      listingId: "12",
      userId: "intruder",
    });
    expect(error?.message).toBe("You are not allowed to permanently delete this listing.");
    expect(bestEffortRemoveListingImageStorage).not.toHaveBeenCalled();
  });

  test("maps listing_events trigger text from RPC (no raw trigger)", async () => {
    const supabase = mockSupabaseForDiscardDraft({
      listingRow: {
        id: 12,
        user_id: "owner-1",
        status: LISTING_LIFECYCLE.DRAFT,
        lifecycle_status: LISTING_LIFECYCLE.DRAFT,
      },
    });
    invokePermanentDeleteListingRpc.mockResolvedValue({
      ok: false,
      error: new Error("Unable to permanently delete listing. Apply migration 20260701130000."),
    });

    const { error } = await discardDraftListing(supabase, {
      listingId: "12",
      userId: "owner-1",
    });
    expect(error?.message).not.toMatch(/append-only/i);
    expect(error?.message).toContain("20260701130000");
  });
});
