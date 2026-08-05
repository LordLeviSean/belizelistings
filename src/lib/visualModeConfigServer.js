import { createClient } from "@supabase/supabase-js";
import { normalizeVisualModeConfig, VISUAL_MODE_DEFAULTS } from "./visualModeConfig";

export function createAnonSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

export function createAuthedSupabaseClient(accessToken) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

/** Fetch authoritative visual-mode config via public RPC. */
export async function fetchPublicVisualModeConfig(client) {
  if (!client?.rpc) {
    return { ok: false, config: { ...VISUAL_MODE_DEFAULTS }, error: "client_unavailable" };
  }

  const { data, error } = await client.rpc("get_public_visual_mode_config");
  if (error) {
    return { ok: false, config: { ...VISUAL_MODE_DEFAULTS }, error: error.message };
  }

  return { ok: true, config: normalizeVisualModeConfig(data) };
}

/** Server-side fetch for _app getInitialProps (SSR first paint). */
export async function fetchPublicVisualModeConfigServerSide() {
  const client = createAnonSupabaseClient();
  const result = await fetchPublicVisualModeConfig(client);
  return result.config;
}

/** Admin update via DB RPC (is_admin() enforced in Postgres). */
export async function updateVisualModePlatformConfig(client, config) {
  if (!client?.rpc) {
    return { ok: false, error: "client_unavailable" };
  }

  const { data, error } = await client.rpc("update_visual_mode_platform_config", {
    p_live_palette_mode: config.livePalette,
    p_pulse_mode: config.pulse,
    p_sea_flow_mode: config.seaFlow,
    p_sea_flow_intensity: config.seaFlowIntensity,
  });

  if (error) {
    const code =
      error.message?.includes("admin_required") || error.code === "42501"
        ? "admin_required"
        : error.message?.includes("invalid_sea_flow_intensity") || error.code === "22023"
          ? "invalid_intensity"
          : "update_failed";
    return { ok: false, error: code, message: error.message };
  }

  return { ok: true, config: normalizeVisualModeConfig(data) };
}
