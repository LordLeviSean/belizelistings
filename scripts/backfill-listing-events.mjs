#!/usr/bin/env node
/**
 * Backfill listing_events from existing listing row timestamps.
 * Usage: node scripts/backfill-listing-events.mjs [--dry-run] [--limit N]
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
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

const EVENT_TYPES = {
  CREATED: "listing.created",
  PUBLISHED: "listing.published",
  VERIFICATION_APPROVED: "listing.verification.approved",
  ARCHIVED: "listing.archived",
  SOLD: "listing.sold",
  RENTED: "listing.rented",
};

function buildBackfillDescriptors(listing) {
  const rows = [];

  if (listing.created_at) {
    rows.push({
      event_type: EVENT_TYPES.CREATED,
      visibility: "internal",
      occurred_at: listing.created_at,
      payload: { note: "Backfilled from listings.created_at" },
    });
  }

  if (listing.published_at) {
    rows.push({
      event_type: EVENT_TYPES.PUBLISHED,
      visibility: "public",
      occurred_at: listing.published_at,
      payload: { note: "Backfilled from listings.published_at" },
    });
  }

  if (
    String(listing.verification_status || "").toLowerCase() === "verified" &&
    listing.verified_at
  ) {
    rows.push({
      event_type: EVENT_TYPES.VERIFICATION_APPROVED,
      visibility: "public",
      occurred_at: listing.verified_at,
      payload: {
        verification_status: "verified",
        verified_at: listing.verified_at,
        verified_by: listing.verified_by ?? null,
        note: "Backfilled from listings.verified_at",
      },
    });
  }

  if (listing.archived_at) {
    rows.push({
      event_type: EVENT_TYPES.ARCHIVED,
      visibility: "public",
      occurred_at: listing.archived_at,
      payload: { note: "Backfilled from listings.archived_at" },
    });
  }

  if (listing.sold_at) {
    rows.push({
      event_type: EVENT_TYPES.SOLD,
      visibility: "public",
      occurred_at: listing.sold_at,
      payload: { note: "Backfilled from listings.sold_at" },
    });
  }

  if (listing.rented_at) {
    rows.push({
      event_type: EVENT_TYPES.RENTED,
      visibility: "public",
      occurred_at: listing.rented_at,
      payload: { note: "Backfilled from listings.rented_at" },
    });
  }

  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  let query = supabase
    .from("listings")
    .select(
      "id, created_at, published_at, verification_status, verified_at, verified_by, archived_at, sold_at, rented_at"
    )
    .order("created_at", { ascending: true });

  if (limit && Number.isFinite(limit)) {
    query = query.limit(limit);
  }

  const { data: listings, error: listingsError } = await query;

  if (listingsError) {
    console.error("Listings query failed:", listingsError.message);
    process.exit(1);
  }

  const report = {
    generated_at: new Date().toISOString(),
    dry_run: dryRun,
    listings_scanned: (listings || []).length,
    events_attempted: 0,
    events_inserted: 0,
    events_skipped: 0,
    errors: [],
  };

  for (const listing of listings || []) {
    const descriptors = buildBackfillDescriptors(listing);
    for (const descriptor of descriptors) {
      report.events_attempted += 1;

      if (dryRun) {
        console.log("[dry-run]", listing.id, descriptor.event_type, descriptor.occurred_at);
        report.events_inserted += 1;
        continue;
      }

      const { count, error: existsError } = await supabase
        .from("listing_events")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listing.id)
        .eq("event_type", descriptor.event_type)
        .eq("source", "migration_backfill");

      if (!existsError && (count || 0) > 0) {
        report.events_skipped += 1;
        continue;
      }

      const { data, error } = await supabase.rpc("append_listing_event", {
        p_listing_id: listing.id,
        p_event_type: descriptor.event_type,
        p_visibility: descriptor.visibility,
        p_payload: descriptor.payload,
        p_actor_id: listing.verified_by ?? null,
        p_actor_role: null,
        p_source: "migration_backfill",
        p_correlation_id: null,
        p_occurred_at: descriptor.occurred_at,
      });

      if (error) {
        if (/duplicate|unique|already exists/i.test(error.message || "")) {
          report.events_skipped += 1;
          continue;
        }
        report.errors.push({ listing_id: listing.id, event_type: descriptor.event_type, message: error.message });
        continue;
      }

      if (data) report.events_inserted += 1;
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
