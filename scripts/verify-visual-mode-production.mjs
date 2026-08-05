#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const env = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const KEYS = [
  "live_palette_mode",
  "pulse_mode",
  "sea_flow_mode",
  "sea_flow_intensity",
];

const anon = createClient(url, anonKey);
const service = createClient(url, serviceKey);

const { data: rpcData, error: rpcError } = await anon.rpc("get_public_visual_mode_config");
const { data: rows, error: rowError } = await anon
  .from("platform_runtime_config")
  .select("config_key, config_value")
  .in("config_key", KEYS);

const { data: secretRow, error: secretError } = await anon
  .from("platform_runtime_config")
  .select("config_key")
  .eq("config_key", "listing_closed_archive_minutes")
  .maybeSingle();

console.log(
  JSON.stringify(
    {
      rpc: { data: rpcData, error: rpcError?.message ?? null },
      publicRows: { data: rows, error: rowError?.message ?? null },
      secretRowBlocked: {
        data: secretRow,
        error: secretError?.message ?? null,
        blocked: !secretRow && Boolean(secretError),
      },
      serviceRows: (
        await service.from("platform_runtime_config").select("config_key, config_value").in("config_key", KEYS)
      ).data,
    },
    null,
    2
  )
);
