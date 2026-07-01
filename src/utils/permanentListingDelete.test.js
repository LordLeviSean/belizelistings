import { LISTING_LIFECYCLE } from "../constants/operationalModel";
import { permanentlyDeleteArchivedListing } from "./ownershipAttribution";
import {
  PERMANENT_DELETE_MIGRATION_REQUIRED_MESSAGE,
  RPC_PERMANENT_DELETE,
} from "../lib/listingPermanentDelete";

jest.mock("../lib/listingPermanentDelete", () => {
  const actual = jest.requireActual("../lib/listingPermanentDelete");
  return {
    ...actual,
    bestEffortRemoveListingImageStorage: jest.fn().mockResolvedValue(undefined),
    invokePermanentDeleteListingRpc: jest.fn(),
  };
});

import {
  bestEffortRemoveListingImageStorage,
  invokePermanentDeleteListingRpc,
} from "../lib/listingPermanentDelete";

function mockSupabaseForPermanentDelete({ listingRow, imageRows = [] }) {
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

  return { from, rpc: jest.fn() };
}

describe("permanentlyDeleteArchivedListing", () => {
  beforeEach(() => {
    invokePermanentDeleteListingRpc.mockReset();
    bestEffortRemoveListingImageStorage.mockClear();
  });

  test("rejects missing listing id", async () => {
    const supabase = mockSupabaseForPermanentDelete({ listingRow: null });
    const { error } = await permanentlyDeleteArchivedListing(supabase, { listingId: "" });
    expect(error?.message).toBe("Listing id is required.");
    expect(invokePermanentDeleteListingRpc).not.toHaveBeenCalled();
  });

  test("rejects non-archived listing before RPC", async () => {
    const supabase = mockSupabaseForPermanentDelete({
      listingRow: {
        id: 7,
        status: "approved",
        lifecycle_status: "published",
        moderation_status: "approved",
      },
    });

    const { error } = await permanentlyDeleteArchivedListing(supabase, { listingId: "7" });
    expect(error?.message).toBe("Permanent deletion is restricted to archived listings.");
    expect(invokePermanentDeleteListingRpc).not.toHaveBeenCalled();
  });

  test("calls RPC for archived listing and maps RPC errors", async () => {
    const supabase = mockSupabaseForPermanentDelete({
      listingRow: {
        id: 12,
        status: LISTING_LIFECYCLE.ARCHIVED,
        lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
        moderation_status: LISTING_LIFECYCLE.ARCHIVED,
      },
      imageRows: [{ image_url: "https://example.test/storage/v1/object/public/listing-images/a.webp" }],
    });

    invokePermanentDeleteListingRpc.mockResolvedValue({
      ok: false,
      error: new Error("You are not allowed to permanently delete this listing."),
    });

    const { error } = await permanentlyDeleteArchivedListing(supabase, { listingId: "12" });
    expect(invokePermanentDeleteListingRpc).toHaveBeenCalledWith(supabase, "12");
    expect(error?.message).toBe("You are not allowed to permanently delete this listing.");
    expect(bestEffortRemoveListingImageStorage).not.toHaveBeenCalled();
  });

  test("cleans up storage after successful RPC", async () => {
    const imageRows = [{ image_url: "https://example.test/storage/v1/object/public/listing-images/a.webp" }];
    const supabase = mockSupabaseForPermanentDelete({
      listingRow: {
        id: 12,
        status: LISTING_LIFECYCLE.ARCHIVED,
      },
      imageRows,
    });

    invokePermanentDeleteListingRpc.mockResolvedValue({ ok: true });

    const { error } = await permanentlyDeleteArchivedListing(supabase, { listingId: "12" });
    expect(error).toBeNull();
    expect(invokePermanentDeleteListingRpc).toHaveBeenCalledWith(supabase, "12");
    expect(bestEffortRemoveListingImageStorage).toHaveBeenCalledWith(supabase, imageRows);
  });

  test("returns migration message when RPC is not deployed (no client fallback)", async () => {
    const supabase = mockSupabaseForPermanentDelete({
      listingRow: {
        id: 12,
        status: LISTING_LIFECYCLE.ARCHIVED,
      },
    });

    invokePermanentDeleteListingRpc.mockResolvedValue({
      ok: false,
      unavailable: true,
      error: new Error(PERMANENT_DELETE_MIGRATION_REQUIRED_MESSAGE),
    });

    const { error } = await permanentlyDeleteArchivedListing(supabase, { listingId: "12" });
    expect(error?.message).toBe(PERMANENT_DELETE_MIGRATION_REQUIRED_MESSAGE);
    expect(bestEffortRemoveListingImageStorage).not.toHaveBeenCalled();
  });

  test("RPC constant matches migration function name", () => {
    expect(RPC_PERMANENT_DELETE).toBe("permanently_delete_listing");
  });
});
