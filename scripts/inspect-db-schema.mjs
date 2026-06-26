#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const raw = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnvLocal();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: listing, error: e1 } = await sb.from("listings").select("*").limit(1).maybeSingle();
console.log("listings sample id type:", typeof listing?.id, listing?.id);
console.log("listings columns:", listing ? Object.keys(listing).sort().join(", ") : e1?.message);

const { data: ev, error: e2 } = await sb.from("listing_events").select("*").limit(1);
console.log("listing_events error:", e2?.message ?? "none");
console.log("listing_events count probe ok:", !e2);
