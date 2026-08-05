import {
  createAuthedSupabaseClient,
  updateVisualModePlatformConfig,
} from "../../../lib/visualModeConfigServer";
import { validateVisualModePatch } from "../../../lib/visualModeConfig";

function logVisualModeFailure(stage, details) {
  if (typeof console !== "undefined") {
    console.error("[admin/visual-mode]", stage, details);
  }
}

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    logVisualModeFailure("config_missing", { hasUrl: Boolean(url), hasAnonKey: Boolean(anonKey) });
    return res.status(503).json({ error: "Missing Supabase configuration", code: "config_missing" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return res.status(401).json({ error: "Unauthorized", code: "auth_required" });
  }

  let config;
  try {
    config = validateVisualModePatch(req.body ?? {});
  } catch (err) {
    logVisualModeFailure("validation_failed", { message: err.message, code: err.code || "invalid_payload" });
    return res.status(400).json({ error: err.message, code: err.code || "invalid_payload" });
  }

  const userClient = createAuthedSupabaseClient(token);
  if (!userClient) {
    logVisualModeFailure("config_missing", { stage: "authed_client" });
    return res.status(503).json({ error: "Missing Supabase configuration", code: "config_missing" });
  }

  const {
    data: { user: currentUser },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !currentUser?.id) {
    logVisualModeFailure("auth_failed", {
      message: userError?.message ?? "missing_user",
      code: userError?.code ?? "auth_invalid",
    });
    return res.status(401).json({ error: "Unauthorized", code: "auth_invalid" });
  }

  const result = await updateVisualModePlatformConfig(userClient, config);
  if (!result.ok) {
    logVisualModeFailure("update_failed", {
      userId: currentUser.id,
      error: result.error,
      message: result.message,
      pgCode: result.pgCode ?? null,
    });

    if (result.error === "admin_required") {
      return res.status(403).json({ error: "Admin access required", code: result.error });
    }
    if (result.error === "invalid_intensity") {
      return res.status(400).json({ error: "Invalid sea flow intensity", code: result.error });
    }
    if (result.error === "invalid_intensity_storage") {
      return res.status(500).json({
        error: "Failed to update visual mode configuration",
        code: result.error,
      });
    }
    return res.status(500).json({
      error: "Failed to update visual mode configuration",
      code: result.error || "update_failed",
    });
  }

  return res.status(200).json({ ...result.config, source: "server" });
}
