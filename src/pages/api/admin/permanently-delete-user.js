import { createClient } from "@supabase/supabase-js";
import {
  extractStoragePathsFromUserDeleteResult,
  formatPermanentUserDeleteServerConfigError,
  invokePermanentDeleteUserRpc,
  PARTIAL_AUTH_DELETE_CODE,
  PARTIAL_AUTH_DELETE_MESSAGE,
  permanentUserDeleteMigrationRequiredError,
  SUPABASE_SERVICE_ROLE_CONFIG_MISSING_CODE,
} from "../../../lib/userPermanentDelete";
import { fetchProfileRowWithTiers, PROFILE_ROLE_ONLY_SELECT } from "../../../lib/profileSelectContract";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LISTING_IMAGES_BUCKET = "listing-images";

async function deleteAuthUser(adminClient, targetId) {
  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(targetId);
  if (!authDeleteError) {
    return { ok: true };
  }
  const msg = String(authDeleteError.message || "").toLowerCase();
  if (msg.includes("not found") || msg.includes("user not found")) {
    return { ok: true, alreadyGone: true };
  }
  return { ok: false, error: authDeleteError };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!url || !serviceRole) {
    /** @type {string[]} */
    const missingEnvVars = [];
    if (!url) missingEnvVars.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!serviceRole) missingEnvVars.push("SUPABASE_SERVICE_ROLE_KEY");
    return res.status(503).json({
      error: formatPermanentUserDeleteServerConfigError(missingEnvVars),
      code: SUPABASE_SERVICE_ROLE_CONFIG_MISSING_CODE,
    });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const adminClient = createClient(url, serviceRole);
  const userClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });

  const {
    data: { user: currentUser },
  } = await userClient.auth.getUser();

  if (!currentUser?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data: profile } = await fetchProfileRowWithTiers(adminClient, currentUser.id, [
    PROFILE_ROLE_ONLY_SELECT,
  ]);

  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { userId, reason, retryAuthOnly } = req.body || {};
  const targetId = String(userId || "").trim();
  if (!targetId) {
    return res.status(400).json({ error: "User id is required" });
  }

  if (targetId === currentUser.id) {
    return res.status(400).json({ error: "You cannot permanently delete your own account." });
  }

  if (retryAuthOnly) {
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", targetId)
      .maybeSingle();

    if (existingProfile?.id) {
      return res.status(400).json({
        error: "User profile still exists. Run full delete first.",
      });
    }

    const authResult = await deleteAuthUser(adminClient, targetId);
    if (!authResult.ok) {
      return res.status(500).json({
        error: PARTIAL_AUTH_DELETE_MESSAGE,
        code: PARTIAL_AUTH_DELETE_CODE,
        partial: true,
      });
    }

    return res.status(200).json({
      ok: true,
      deleted_user_id: targetId,
      auth_only: true,
    });
  }

  const rpcResult = await invokePermanentDeleteUserRpc(userClient, targetId, reason);
  if (!rpcResult.ok) {
    if (rpcResult.unavailable) {
      return res.status(503).json({ error: permanentUserDeleteMigrationRequiredError().message });
    }
    return res.status(400).json({ error: rpcResult.error?.message || "Unable to delete user" });
  }

  const storagePaths = extractStoragePathsFromUserDeleteResult(rpcResult.data);
  if (storagePaths.length) {
    const { error: storageError } = await adminClient.storage
      .from(LISTING_IMAGES_BUCKET)
      .remove(storagePaths);
    if (storageError && typeof console !== "undefined") {
      console.warn("[permanent-user-delete] storage cleanup skipped", storageError.message || storageError);
    }
  }

  const authResult = await deleteAuthUser(adminClient, targetId);
  if (!authResult.ok) {
    return res.status(500).json({
      error: PARTIAL_AUTH_DELETE_MESSAGE,
      code: PARTIAL_AUTH_DELETE_CODE,
      partial: true,
      rpc: rpcResult.data,
    });
  }

  return res.status(200).json({
    ok: true,
    deleted_user_id: targetId,
    metadata: rpcResult.data?.metadata || {},
    storage_paths_removed: storagePaths.length,
  });
}
