#!/usr/bin/env node
/**
 * Verify production listings columns used by dashboard SELECT tiers.
 * No secrets printed.
 */
import { createClient } from "@supabase/supabase-js";
import { mergeEnv, requireSupabase } from "./_load-env.mjs";

mergeEnv();
const { url, serviceKey } = requireSupabase({ service: true });
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const CORE_SELECT =
  "id,user_id,title,price,district,region_slug,community_id,map_region_slug,locality_id,highway_id,highway_mile,subregion_slug,created_at,updated_at,status,lifecycle_status,moderation_status";
const MARKET_SELECT = "listing_type,market_type,property_type";
const LEGACY_SELECT = "id,user_id,title,price,district,created_at,updated_at,status";
const MINIMAL_SELECT = "id,user_id,title,price,district,created_at,status";

const COLUMN_CHECKS = ["listing_type", "market_type", "property_type", "lifecycle_status", "user_id"];

async function columnReadable(col) {
  const { error } = await admin.from("listings").select(col).limit(1);
  return { col, ok: !error, detail: error?.message || "readable" };
}

async function selectProbe(label, select) {
  const { data, error } = await admin.from("listings").select(select).limit(3);
  return {
    label,
    ok: !error,
    sampleCount: Array.isArray(data) ? data.length : data ? 1 : 0,
    detail: error?.message || "ok",
  };
}

async function ownershipSample() {
  const { count, error } = await admin
    .from("listings")
    .select("id", { count: "exact", head: true });
  return { totalListings: error ? null : count, detail: error?.message || "ok" };
}

const cols = await Promise.all(COLUMN_CHECKS.map(columnReadable));
const tiers = await Promise.all([
  selectProbe("tier0-market-full", `${CORE_SELECT},${MARKET_SELECT}`),
  selectProbe("tier1-core-full", CORE_SELECT),
  selectProbe("tier3-legacy-core", LEGACY_SELECT),
  selectProbe("tier9-minimal-core", MINIMAL_SELECT),
]);
const ownership = await ownershipSample();

const report = { columns: cols, tiers, ownership };
console.log(JSON.stringify(report, null, 2));

const marketMissing = cols.find((c) => c.col === "market_type" && !c.ok);
const coreTierOk = tiers.find((t) => t.label === "tier1-core-full")?.ok;
if (marketMissing) {
  console.log("\nDiagnosis: market_type column missing or unreadable in production.");
}
if (coreTierOk) {
  console.log("Core dashboard tier (without market columns) succeeds against production.");
}

process.exit(coreTierOk ? 0 : 1);
