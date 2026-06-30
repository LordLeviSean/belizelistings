import {
  RPC_PERMANENT_DELETE,
  extractListingImageStoragePaths,
  invokePermanentDeleteListingRpc,
  isPermanentDeleteRpcUnavailable,
  mapPermanentDeleteRpcError,
} from "./listingPermanentDelete";

describe("listingPermanentDelete", () => {
  test("mapPermanentDeleteRpcError maps archived guard", () => {
    const err = mapPermanentDeleteRpcError({
      message: "permanent deletion is restricted to archived listings",
    });
    expect(err.message).toBe("Permanent deletion is restricted to archived listings.");
  });

  test("mapPermanentDeleteRpcError maps admin authorization", () => {
    const err = mapPermanentDeleteRpcError({
      message: "not authorized to permanently delete this listing",
    });
    expect(err.message).toBe("You are not allowed to permanently delete this listing.");
  });

  test("mapPermanentDeleteRpcError maps missing listing", () => {
    const err = mapPermanentDeleteRpcError({ message: "listing not found: 42" });
    expect(err.message).toBe("Listing no longer exists.");
  });

  test("isPermanentDeleteRpcUnavailable detects missing RPC", () => {
    expect(
      isPermanentDeleteRpcUnavailable({
        message: "Could not find the function permanently_delete_archived_listing",
      })
    ).toBe(true);
    expect(isPermanentDeleteRpcUnavailable({ message: "not authorized" })).toBe(false);
  });

  test("extractListingImageStoragePaths parses public URLs", () => {
    const paths = extractListingImageStoragePaths([
      {
        image_url:
          "https://example.supabase.co/storage/v1/object/public/listing-images/user-1/171000-0-photo.webp",
      },
    ]);
    expect(paths).toEqual(["listing-images/user-1/171000-0-photo.webp"]);
  });

  test("invokePermanentDeleteListingRpc calls RPC", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    const result = await invokePermanentDeleteListingRpc(client, "12");
    expect(result.ok).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith(RPC_PERMANENT_DELETE, { p_listing_id: 12 });
  });

  test("invokePermanentDeleteListingRpc maps authorization errors", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "not authorized to permanently delete this listing" },
      }),
    };

    const result = await invokePermanentDeleteListingRpc(client, "12");
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe("You are not allowed to permanently delete this listing.");
  });
});
