import {
  PARTIAL_AUTH_DELETE_CODE,
  PARTIAL_AUTH_DELETE_MESSAGE,
  PERMANENT_USER_DELETE_MIGRATION_REQUIRED_MESSAGE,
  RPC_PERMANENT_DELETE_USER,
  USER_DELETE_AUDIT_COUNT_KEYS,
  extractStoragePathsFromUserDeleteResult,
  invokePermanentDeleteUserRpc,
  isPermanentUserDeleteRpcUnavailable,
  mapPermanentUserDeleteApiError,
  mapPermanentUserDeleteRpcError,
  normalizeUserDeleteAuditCounts,
  permanentUserDeleteMigrationRequiredError,
  permanentlyDeleteUserViaApi,
} from "./userPermanentDelete";

describe("userPermanentDelete", () => {
  test("mapPermanentUserDeleteRpcError maps admin guard", () => {
    const err = mapPermanentUserDeleteRpcError({
      message: "admin authorization required",
    });
    expect(err.message).toBe("Admin access is required to permanently delete users.");
  });

  test("mapPermanentUserDeleteRpcError maps self-delete guard", () => {
    const err = mapPermanentUserDeleteRpcError({
      message: "cannot permanently delete your own account",
    });
    expect(err.message).toBe("You cannot permanently delete your own account.");
  });

  test("mapPermanentUserDeleteRpcError maps admin target guard", () => {
    const err = mapPermanentUserDeleteRpcError({
      message: "cannot permanently delete another admin account",
    });
    expect(err.message).toBe("Admin accounts cannot be permanently deleted.");
  });

  test("mapPermanentUserDeleteRpcError maps missing user", () => {
    const err = mapPermanentUserDeleteRpcError({ message: "user not found: abc" });
    expect(err.message).toBe("User no longer exists.");
  });

  test("mapPermanentUserDeleteRpcError maps FK violations", () => {
    const err = mapPermanentUserDeleteRpcError({
      message: "violates foreign key constraint",
    });
    expect(err.message).toBe("Unable to delete user because related records still exist.");
  });

  test("mapPermanentUserDeleteApiError maps partial auth delete failure", () => {
    const err = mapPermanentUserDeleteApiError({
      partial: true,
      code: PARTIAL_AUTH_DELETE_CODE,
      error: PARTIAL_AUTH_DELETE_MESSAGE,
    });
    expect(err.message).toBe(PARTIAL_AUTH_DELETE_MESSAGE);
  });

  test("mapPermanentUserDeleteApiError maps unauthorized status", () => {
    const err = mapPermanentUserDeleteApiError({}, 401);
    expect(err.message).toBe("Sign in to permanently delete this user.");
  });

  test("mapPermanentUserDeleteApiError maps migration unavailable", () => {
    const err = mapPermanentUserDeleteApiError({}, 503);
    expect(err.message).toBe(PERMANENT_USER_DELETE_MIGRATION_REQUIRED_MESSAGE);
  });

  test("normalizeUserDeleteAuditCounts returns expected shape", () => {
    const counts = normalizeUserDeleteAuditCounts({
      listings: 2,
      images: 5,
      favorites: 1,
      notifications: 0,
      conversations: 3,
      messages: 12,
      viewing_requests: 4,
      profile_role: "user",
    });
    expect(Object.keys(counts).sort()).toEqual([...USER_DELETE_AUDIT_COUNT_KEYS].sort());
    expect(counts.listings).toBe(2);
    expect(counts.messages).toBe(12);
    expect(counts.notifications).toBe(0);
  });

  test("normalizeUserDeleteAuditCounts defaults missing keys to zero", () => {
    const counts = normalizeUserDeleteAuditCounts({ listings: 1 });
    expect(counts.images).toBe(0);
    expect(counts.viewing_requests).toBe(0);
  });

  test("isPermanentUserDeleteRpcUnavailable detects missing RPC", () => {
    expect(
      isPermanentUserDeleteRpcUnavailable({
        message: "Could not find the function permanently_delete_user",
      })
    ).toBe(true);
    expect(isPermanentUserDeleteRpcUnavailable({ code: "PGRST202" })).toBe(true);
    expect(isPermanentUserDeleteRpcUnavailable({ message: "admin authorization required" })).toBe(
      false
    );
  });

  test("permanentUserDeleteMigrationRequiredError returns actionable message", () => {
    expect(permanentUserDeleteMigrationRequiredError().message).toBe(
      PERMANENT_USER_DELETE_MIGRATION_REQUIRED_MESSAGE
    );
  });

  test("extractStoragePathsFromUserDeleteResult parses RPC image_urls", () => {
    const paths = extractStoragePathsFromUserDeleteResult({
      image_urls: [
        "https://example.supabase.co/storage/v1/object/public/listing-images/user-1/171000-0-photo.webp",
      ],
    });
    expect(paths).toEqual(["listing-images/user-1/171000-0-photo.webp"]);
  });

  test("invokePermanentDeleteUserRpc calls RPC with reason", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: { ok: true, image_urls: [] },
        error: null,
      }),
    };

    const result = await invokePermanentDeleteUserRpc(client, "user-uuid", "policy violation");
    expect(result.ok).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith(RPC_PERMANENT_DELETE_USER, {
      p_user_id: "user-uuid",
      p_reason: "policy violation",
    });
  });

  test("invokePermanentDeleteUserRpc maps authorization errors", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "admin authorization required" },
      }),
    };

    const result = await invokePermanentDeleteUserRpc(client, "user-uuid");
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe("Admin access is required to permanently delete users.");
  });

  test("invokePermanentDeleteUserRpc surfaces migration message when RPC missing", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST202", message: "Could not find the function" },
      }),
    };

    const result = await invokePermanentDeleteUserRpc(client, "user-uuid");
    expect(result.ok).toBe(false);
    expect(result.unavailable).toBe(true);
    expect(result.error.message).toBe(PERMANENT_USER_DELETE_MIGRATION_REQUIRED_MESSAGE);
  });

  test("permanentlyDeleteUserViaApi posts to admin API route", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, deleted_user_id: "user-uuid" }),
    });

    const result = await permanentlyDeleteUserViaApi({
      userId: "user-uuid",
      reason: "test",
      accessToken: "token",
    });

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/permanently-delete-user",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
        body: JSON.stringify({
          userId: "user-uuid",
          reason: "test",
          retryAuthOnly: false,
        }),
      })
    );
  });

  test("permanentlyDeleteUserViaApi maps API errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Admin access required" }),
    });

    const result = await permanentlyDeleteUserViaApi({ userId: "user-uuid" });
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe("Admin access is required to permanently delete users.");
  });

  test("permanentlyDeleteUserViaApi maps partial auth delete failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        partial: true,
        code: PARTIAL_AUTH_DELETE_CODE,
        error: PARTIAL_AUTH_DELETE_MESSAGE,
      }),
    });

    const result = await permanentlyDeleteUserViaApi({ userId: "user-uuid" });
    expect(result.ok).toBe(false);
    expect(result.partial).toBe(true);
    expect(result.dataRemoved).toBe(true);
    expect(result.error.message).toBe(PARTIAL_AUTH_DELETE_MESSAGE);
  });

  test("permanentlyDeleteUserViaApi supports retryAuthOnly mode", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, auth_only: true }),
    });

    await permanentlyDeleteUserViaApi({
      userId: "user-uuid",
      retryAuthOnly: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/permanently-delete-user",
      expect.objectContaining({
        body: JSON.stringify({
          userId: "user-uuid",
          reason: null,
          retryAuthOnly: true,
        }),
      })
    );
  });
});
