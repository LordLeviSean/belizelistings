#!/usr/bin/env node
/**
 * Verify listing_events migration state via service role.
 * Usage: node scripts/verify-listing-events-db.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      value = value.replace(/^["']|["']$/g, "");
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing credentials");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const report = { checks: [], errors: [] };

  async function check(name, fn) {
    try {
      const result = await fn();
      report.checks.push({ name, ok: true, ...result });
    } catch (e) {
      report.errors.push({ name, message: e.message });
      report.checks.push({ name, ok: false, error: e.message });
    }
  }

  await check("listing_events table", async () => {
    const { error } = await supabase.from("listing_events").select("id", { head: true, count: "exact" });
    if (error) throw new Error(error.message);
    return { accessible: true };
  });

  await check("listings verification columns", async () => {
    const { data, error } = await supabase
      .from("listings")
      .select("id, verification_status, verified_at, verified_by")
      .limit(1);
    if (error) throw new Error(error.message);
    return { sample: data?.[0] ?? null };
  });

  await check("append_listing_event RPC", async () => {
    const { data: listings } = await supabase.from("listings").select("id").limit(1);
    const listingId = listings?.[0]?.id;
    if (!listingId) return { skipped: "no listings" };

    const testCorr = crypto.randomUUID();
    const { data: id1, error: e1 } = await supabase.rpc("append_listing_event", {
      p_listing_id: listingId,
      p_event_type: "listing.created",
      p_visibility: "internal",
      p_payload: { note: "integrity-test" },
      p_source: "migration_backfill",
      p_correlation_id: testCorr,
    });
    if (e1) throw new Error(e1.message);

    const { data: id2, error: e2 } = await supabase.rpc("append_listing_event", {
      p_listing_id: listingId,
      p_event_type: "listing.created",
      p_visibility: "internal",
      p_payload: { note: "integrity-test-dup" },
      p_source: "migration_backfill",
      p_correlation_id: testCorr,
    });
    if (e2) throw new Error(e2.message);

    return { event_id: id1, idempotent: id1 === id2 };
  });

  await check("UPDATE rejected on listing_events", async () => {
    const { data: rows } = await supabase.from("listing_events").select("id").limit(1);
    const id = rows?.[0]?.id;
    if (!id) return { skipped: "no events" };
    const { error } = await supabase.from("listing_events").update({ payload: {} }).eq("id", id);
    return { rejected: !!error, message: error?.message ?? "unexpected success" };
  });

  await check("DELETE rejected on listing_events", async () => {
    const { data: rows } = await supabase.from("listing_events").select("id").limit(1);
    const id = rows?.[0]?.id;
    if (!id) return { skipped: "no events" };
    const { error } = await supabase.from("listing_events").delete().eq("id", id);
    return { rejected: !!error, message: error?.message ?? "unexpected success" };
  });

  await check("event counts summary", async () => {
    const { data: listings, error: le } = await supabase
      .from("listings")
      .select("id, created_at, status, lifecycle_status, verification_status, verified_at");
    if (le) throw new Error(le.message);

    const { data: events, error: ee } = await supabase
      .from("listing_events")
      .select("listing_id, event_type");
    if (ee) throw new Error(ee.message);

    const countsByListing = {};
    for (const e of events || []) {
      if (!countsByListing[e.listing_id]) countsByListing[e.listing_id] = {};
      countsByListing[e.listing_id][e.event_type] = (countsByListing[e.listing_id][e.event_type] || 0) + 1;
    }

    const typeTotals = {};
    for (const e of events || []) {
      typeTotals[e.event_type] = (typeTotals[e.event_type] || 0) + 1;
    }

    const orphaned = (listings || []).filter((l) => !countsByListing[l.id]);
    const withCreated = (listings || []).filter((l) => countsByListing[l.id]?.["listing.created"]);

    return {
      total_listings: (listings || []).length,
      total_events: (events || []).length,
      type_totals: typeTotals,
      listings_with_timeline: Object.keys(countsByListing).length,
      listings_missing_timeline: orphaned.length,
      listings_with_created_event: withCreated.length,
    };
  });

  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
