import {
  bestEffortRemoveListingImageStorage,
  extractListingImageStoragePaths,
} from "./listingPermanentDelete";

export const RPC_PERMANENT_DELETE_USER = "permanently_delete_user";

/** Shown when `permanently_delete_user` RPC is not deployed yet. */
export const PERMANENT_USER_DELETE_MIGRATION_REQUIRED_MESSAGE =
  "Permanent user delete requires database migration 20260630140000 — apply in Supabase SQL editor";

/** RPC succeeded but auth.admin.deleteUser failed — profile/data already removed. */
export const PARTIAL_AUTH_DELETE_CODE = "AUTH_DELETE_FAILED_AFTER_RPC";
export const PARTIAL_AUTH_DELETE_MESSAGE =
  "User data was successfully removed, but the authentication account could not be deleted. Please retry cleanup.";

/** Expected audit metadata count keys (pre-delete snapshot). */
export const USER_DELETE_AUDIT_COUNT_KEYS = [
  "listings",
  "images",
  "favorites",
  "notifications",
  "conversations",
  "messages",
  "viewing_requests",
];

/**
 * @param {{ message?: string } | string | null | undefined} error
 * @returns {Error}
 */
export function mapPermanentUserDeleteRpcError(error) {
  const msg = String(error?.message ?? error ?? "").trim();
  const lower = msg.toLowerCase();

  if (lower.includes("user_id is required")) {
    return new Error("User id is required.");
  }
  if (lower.includes("authentication required")) {
    return new Error("Sign in to permanently delete this user.");
  }
  if (lower.includes("admin authorization required")) {
    return new Error("Admin access is required to permanently delete users.");
  }
  if (lower.includes("cannot permanently delete your own account")) {
    return new Error("You cannot permanently delete your own account.");
  }
  if (lower.includes("cannot permanently delete another admin")) {
    return new Error("Admin accounts cannot be permanently deleted.");
  }
  if (/user not found/i.test(msg)) {
    return new Error("User no longer exists.");
  }
  if (/profile delete failed/i.test(msg)) {
    return new Error("Unable to remove user profile.");
  }
  if (/foreign key|violates foreign key|23503/i.test(msg)) {
    return new Error("Unable to delete user because related records still exist.");
  }

  return new Error(msg || "Unable to permanently delete user.");
}

/**
 * @param {{ error?: string, code?: string, partial?: boolean } | null | undefined} payload
 * @param {number} [status]
 * @returns {Error}
 */
export function mapPermanentUserDeleteApiError(payload, status) {
  const code = String(payload?.code || "").trim();
  if (payload?.partial || code === PARTIAL_AUTH_DELETE_CODE) {
    return new Error(payload?.error || PARTIAL_AUTH_DELETE_MESSAGE);
  }

  const msg = String(payload?.error || "").trim();
  if (msg) {
    if (/admin access required/i.test(msg)) {
      return new Error("Admin access is required to permanently delete users.");
    }
    if (/unauthorized/i.test(msg)) {
      return new Error("Sign in to permanently delete this user.");
    }
    if (/user id is required/i.test(msg)) {
      return new Error("User id is required.");
    }
    if (/cannot permanently delete your own account/i.test(msg)) {
      return new Error("You cannot permanently delete your own account.");
    }
    if (/profile still exists/i.test(msg)) {
      return new Error("User profile still exists. Run full delete first.");
    }
    if (/missing supabase service role/i.test(msg)) {
      return new Error("Server configuration error. Contact support.");
    }
    return new Error(msg);
  }

  if (status === 401) {
    return new Error("Sign in to permanently delete this user.");
  }
  if (status === 403) {
    return new Error("Admin access is required to permanently delete users.");
  }
  if (status === 503) {
    return permanentUserDeleteMigrationRequiredError();
  }

  return new Error("Unable to permanently delete user.");
}

/**
 * @param {unknown} metadata
 * @returns {Record<string, number>}
 */
export function normalizeUserDeleteAuditCounts(metadata) {
  const source = metadata && typeof metadata === "object" ? metadata : {};
  /** @type {Record<string, number>} */
  const counts = {};
  for (const key of USER_DELETE_AUDIT_COUNT_KEYS) {
    const raw = source[key];
    counts[key] = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  }
  return counts;
}

/**
 * @param {{ message?: string } | null | undefined} error
 */
export function isPermanentUserDeleteRpcUnavailable(error) {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const code = String(error.code || "").toLowerCase();
  return (
    msg.includes("permanently_delete_user") ||
    msg.includes("could not find the function") ||
    msg.includes("function public.permanently_delete_user") ||
    code === "42883" ||
    code === "pgrst202"
  );
}

/**
 * @returns {Error}
 */
export function permanentUserDeleteMigrationRequiredError() {
  return new Error(PERMANENT_USER_DELETE_MIGRATION_REQUIRED_MESSAGE);
}

/**
 * @param {unknown} rpcData
 * @returns {string[]}
 */
export function extractStoragePathsFromUserDeleteResult(rpcData) {
  const payload = rpcData && typeof rpcData === "object" ? rpcData : {};
  const imageUrls = Array.isArray(payload.image_urls) ? payload.image_urls : [];
  const rows = imageUrls.map((url) => ({ image_url: url }));
  return extractListingImageStoragePaths(rows);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} [reason]
 */
export async function invokePermanentDeleteUserRpc(supabase, userId, reason = "") {
  const id = String(userId || "").trim();
  if (!id) {
    return { ok: false, error: new Error("User id is required.") };
  }
  if (!supabase?.rpc) {
    return { ok: false, unavailable: true, error: permanentUserDeleteMigrationRequiredError() };
  }

  const { data, error } = await supabase.rpc(RPC_PERMANENT_DELETE_USER, {
    p_user_id: id,
    p_reason: String(reason || "").trim() || null,
  });

  if (error) {
    if (isPermanentUserDeleteRpcUnavailable(error)) {
      return { ok: false, unavailable: true, error: permanentUserDeleteMigrationRequiredError() };
    }
    return { ok: false, error: mapPermanentUserDeleteRpcError(error) };
  }

  return { ok: true, data };
}

/**
 * Admin permanent delete via API route (RPC + storage + auth removal).
 * @param {{ userId: string, reason?: string, accessToken?: string, retryAuthOnly?: boolean }} params
 */
export async function permanentlyDeleteUserViaApi({
  userId,
  reason = "",
  accessToken = "",
  retryAuthOnly = false,
}) {
  const id = String(userId || "").trim();
  if (!id) {
    return { ok: false, error: new Error("User id is required.") };
  }

  let response;
  try {
    response = await fetch("/api/admin/permanently-delete-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        userId: id,
        reason: String(reason || "").trim() || null,
        retryAuthOnly: Boolean(retryAuthOnly),
      }),
    });
  } catch (err) {
    return { ok: false, error: new Error(err?.message || "Network error while deleting user.") };
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const partial =
      Boolean(payload?.partial) || String(payload?.code || "") === PARTIAL_AUTH_DELETE_CODE;
    return {
      ok: false,
      partial,
      dataRemoved: partial,
      error: mapPermanentUserDeleteApiError(payload, response.status),
    };
  }

  return { ok: true, data: payload };
}

/**
 * Best-effort storage cleanup from RPC/API result payload.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {unknown} resultPayload
 */
export async function bestEffortRemoveUserDeleteStorage(supabase, resultPayload) {
  const paths = extractStoragePathsFromUserDeleteResult(resultPayload);
  if (!paths.length) return;
  await bestEffortRemoveListingImageStorage(
    supabase,
    paths.map((path) => ({ image_url: path }))
  );
}
