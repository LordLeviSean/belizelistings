/**
 * Production timeline investigation — run with: node scripts/investigate-timeline-production.mjs
 * Reads .env.local for Supabase credentials.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const raw = readFileSync(resolve(root, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function coerceListingIdForDb(listingId) {
  const s = String(listingId ?? "").trim();
  if (!s) return s;
  if (/^\d+$/.test(s)) return Number(s);
  return s;
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("=== PROJECT ===");
  console.log("URL:", url);
  console.log("Ref: xyepbzezoroaeagzzzui");

  // Count all events (service role bypasses RLS)
  const { count: eventCount, error: countErr } = await admin
    .from("listing_events")
    .select("*", { count: "exact", head: true });

  console.log("\n=== COUNT listing_events (service role) ===");
  if (countErr) {
    console.log("ERROR:", countErr.message, countErr.code, countErr.details);
  } else {
    console.log("COUNT:", eventCount);
  }

  // Events by listing
  const { data: allEvents, error: eventsErr } = await admin
    .from("listing_events")
    .select("listing_id, event_type, visibility, occurred_at, created_at, payload")
    .order("listing_id")
    .order("occurred_at", { ascending: false });

  console.log("\n=== ALL EVENTS (service role) ===");
  if (eventsErr) {
    console.log("ERROR:", eventsErr.message);
  } else {
    console.log("ROWS:", allEvents?.length ?? 0);
    console.log(JSON.stringify(allEvents, null, 2));
  }

  // Listings table
  const { data: listings, error: listingsErr } = await admin
    .from("listings")
    .select("id, title, verification_status, status")
    .order("id");

  console.log("\n=== ALL LISTINGS (service role) ===");
  if (listingsErr) {
    console.log("ERROR:", listingsErr.message);
  } else {
    console.log("ROWS:", listings?.length ?? 0);
    console.log(JSON.stringify(listings, null, 2));
  }

  // Latest listings
  const { data: latest, error: latestErr } = await admin
    .from("listings")
    .select("id, title, created_at, verification_status")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("\n=== LATEST 5 LISTINGS ===");
  if (latestErr) {
    console.log("ERROR:", latestErr.message);
  } else {
    console.log(JSON.stringify(latest, null, 2));
  }

  // Anon RLS tests for specific listing IDs
  const testIds = [86, 87, 88];
  if (latest?.length) {
    for (const l of latest) {
      if (!testIds.includes(l.id)) testIds.push(l.id);
    }
  }

  console.log("\n=== ANON RLS TESTS (fetchListingTimeline logic) ===");
  for (const listingId of testIds) {
    const coerced = coerceListingIdForDb(String(listingId));
    const { data, error } = await anon
      .from("listing_events")
      .select("id, event_type, occurred_at, payload, visibility, source")
      .eq("listing_id", coerced)
      .eq("visibility", "public")
      .order("occurred_at", { ascending: false })
      .limit(50);

    console.log(`\n--- listing_id=${listingId} (coerced=${coerced}, type=${typeof coerced}) ---`);
    if (error) {
      console.log("ERROR:", JSON.stringify(error, null, 2));
    } else {
      console.log("ROWS:", data?.length ?? 0);
      console.log(JSON.stringify(data, null, 2));
    }

    // Also test with string listing_id (no coercion)
    const { data: dataStr, error: errStr } = await anon
      .from("listing_events")
      .select("id, event_type")
      .eq("listing_id", String(listingId))
      .eq("visibility", "public")
      .limit(5);
    console.log(`--- string listing_id="${listingId}" (no coerce) ---`);
    if (errStr) console.log("ERROR:", errStr.message);
    else console.log("ROWS:", dataStr?.length ?? 0);
  }

  // Check RLS policies via pg if possible - use rpc or raw query
  // Try append_listing_event RPC existence
  console.log("\n=== RPC append_listing_event test (service role) ===");
  const { error: rpcErr } = await admin.rpc("append_listing_event", {
    p_listing_id: 999999,
    p_event_type: "test.probe",
    p_visibility: "internal",
    p_payload: {},
    p_actor_id: null,
    p_actor_role: null,
    p_source: "investigation",
    p_correlation_id: null,
    p_occurred_at: null,
  });
  if (rpcErr) {
    console.log("RPC ERROR (expected if listing missing):", rpcErr.message, rpcErr.code);
  } else {
    console.log("RPC exists and callable");
  }

  // Check listing_events table schema via sample row
  const { data: sampleRow } = await admin.from("listing_events").select("*").limit(1);
  if (sampleRow?.[0]) {
    console.log("\n=== SAMPLE ROW listing_id type ===");
    const lid = sampleRow[0].listing_id;
    console.log("listing_id value:", lid, "typeof:", typeof lid);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
