#!/usr/bin/env node
/**
 * Verify live geography schema, run backfill + notification broadcast.
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 *
 * Usage: node scripts/activate-geography-production.mjs [--skip-backfill] [--skip-broadcast]
 */
import { createClient } from "@supabase/supabase-js";
import { mergeEnv, requireSupabase } from "./_load-env.mjs";

const GEO_MIGRATIONS = [
  "20260713200000_belize_geography_v1_schema.sql",
  "20260713210000_belize_geography_v1_seed.sql",
  "20260713215000_belize_geography_v1_listing_columns.sql",
  "20260713220000_belize_geography_v1_backfill.sql",
  "20260713230000_geographic_update_notification.sql",
];

const EXPECTED = {
  map_regions: 8,
  communities: 232,
  localities: 107,
  highways: 5,
  highway_map_regions: 11,
  road_corridors: 22,
  aliases: 16,
  total_geography: 374,
};

const args = new Set(process.argv.slice(2));
const skipBackfill = args.has("--skip-backfill");
const skipBroadcast = args.has("--skip-broadcast");

async function countTable(admin, table) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const { url, key } = requireSupabase(mergeEnv());
  const admin = createClient(url, key, { auth: { persistSession: false } });

  console.log("=== Belize Geography V1 — Production Activation ===\n");

  const counts = {
    map_regions: await countTable(admin, "geo_map_regions"),
    communities: await countTable(admin, "geo_communities"),
    localities: await countTable(admin, "geo_localities"),
    highways: await countTable(admin, "geo_highways"),
    highway_map_regions: await countTable(admin, "geo_highway_map_regions"),
    road_corridors: await countTable(admin, "geo_road_corridors"),
    aliases: await countTable(admin, "geo_aliases"),
  };
  counts.total_geography =
    counts.map_regions +
    counts.communities +
    counts.localities +
    counts.highways +
    counts.road_corridors;

  console.log("Live geography counts:");
  for (const [k, v] of Object.entries(counts)) {
    const exp = EXPECTED[k];
    const ok = exp == null || v === exp;
    console.log(`  ${k}: ${v}${exp != null ? ` (expected ${exp})` : ""}${ok ? "" : " [MISMATCH]"}`);
  }

  const { data: migRows, error: migErr } = await admin
    .from("schema_migrations")
    .select("version")
    .in(
      "version",
      GEO_MIGRATIONS.map((f) => f.replace(".sql", ""))
    );
  if (migErr) {
    console.log("\nMigration history: unable to read schema_migrations (", migErr.message, ")");
  } else {
    const applied = new Set((migRows || []).map((r) => `${r.version}.sql`));
    console.log("\nMigration history:");
    for (const m of GEO_MIGRATIONS) {
      console.log(`  ${applied.has(m) ? "✓" : "✗"} ${m}`);
    }
  }

  const schemaOk = Object.entries(EXPECTED).every(([k, exp]) => counts[k] === exp);
  console.log(`\nSchema verification: ${schemaOk ? "PASS" : "FAIL"}`);

  let backfill = null;
  if (!skipBackfill) {
    const { data, error } = await admin.rpc("backfill_listing_geography_v1");
    if (error) {
      console.error("\nBackfill FAILED:", error.message);
      process.exitCode = 1;
    } else {
      backfill = Array.isArray(data) ? data[0] : data;
      console.log("\nBackfill results:");
      console.log(`  total_rows: ${backfill?.total_rows}`);
      console.log(`  exact_count: ${backfill?.exact_count}`);
      console.log(`  partial_count: ${backfill?.partial_count}`);
      console.log(`  alias_count: ${backfill?.alias_count}`);
      console.log(`  unmatched_count: ${backfill?.unmatched_count}`);
      console.log(`  skipped_already_migrated: ${backfill?.skipped_already_migrated}`);
    }
  }

  let broadcast = null;
  if (!skipBroadcast) {
    const { data, error } = await admin.rpc("broadcast_geographic_update_v1");
    if (error) {
      console.error("\nBroadcast FAILED:", error.message);
      process.exitCode = 1;
    } else {
      broadcast = Array.isArray(data) ? data[0] : data;
      console.log("\nNotification broadcast:");
      console.log(`  recipients_targeted: ${broadcast?.recipients_targeted}`);
      console.log(`  notifications_inserted: ${broadcast?.notifications_inserted}`);
      console.log(`  notifications_skipped: ${broadcast?.notifications_skipped}`);
      console.log(`  dedupe_key: geographic_update_v1:2026-07-13`);
    }
  }

  if (!schemaOk) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
