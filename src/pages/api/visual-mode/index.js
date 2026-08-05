import { createAnonSupabaseClient, fetchPublicVisualModeConfig } from "../../../lib/visualModeConfigServer";
import { VISUAL_MODE_DEFAULTS } from "../../../lib/visualModeConfig";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const client = createAnonSupabaseClient();
  if (!client) {
    return res.status(503).json({ ...VISUAL_MODE_DEFAULTS, source: "defaults" });
  }

  const result = await fetchPublicVisualModeConfig(client);
  if (!result.ok) {
    return res.status(200).json({ ...VISUAL_MODE_DEFAULTS, source: "defaults" });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ...result.config, source: "server" });
}
