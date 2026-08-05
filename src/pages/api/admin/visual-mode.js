import {
  createAuthedSupabaseClient,
  updateVisualModePlatformConfig,
} from "../../../lib/visualModeConfigServer";
import { validateVisualModePatch } from "../../../lib/visualModeConfig";

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return res.status(503).json({ error: "Missing Supabase configuration" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let config;
  try {
    config = validateVisualModePatch(req.body ?? {});
  } catch (err) {
    return res.status(400).json({ error: err.message, code: err.code || "invalid_payload" });
  }

  const userClient = createAuthedSupabaseClient(token);
  if (!userClient) {
    return res.status(503).json({ error: "Missing Supabase configuration" });
  }

  const {
    data: { user: currentUser },
  } = await userClient.auth.getUser();

  if (!currentUser?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result = await updateVisualModePlatformConfig(userClient, config);
  if (!result.ok) {
    if (result.error === "admin_required") {
      return res.status(403).json({ error: "Admin access required", code: result.error });
    }
    if (result.error === "invalid_intensity") {
      return res.status(400).json({ error: "Invalid sea flow intensity", code: result.error });
    }
    return res.status(500).json({ error: "Failed to update visual mode configuration" });
  }

  return res.status(200).json({ ...result.config, source: "server" });
}
