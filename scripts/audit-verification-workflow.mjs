#!/usr/bin/env node
/**
 * Audit verification workflow + event integrity (service role reads; admin RPC if creds present).
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
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

const env = { ...loadEnvLocal(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const qaEmail = env.QA_EMAIL || env.NEXT_PUBLIC_QA_EMAIL;
const qaPassword = env.QA_PASSWORD || env.TEST_PASSWORD;

if (!url || !serviceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const admin = createClient(url, serviceKey);

async function countPublicVerificationEvents(listingId) {
  const { data } = await admin
    .from("listing_events")
    .select("id, event_type, visibility, correlation_id, occurred_at")
    .eq("listing_id", listingId)
    .eq("event_type", "listing.verification.approved")
    .eq("visibility", "public");
  return data || [];
}

async function runAdminVerificationCycle(listingId, adminUserId) {
  if (!qaEmail || !qaPassword || !anonKey) {
    return { skipped: true, reason: "QA_EMAIL/QA_PASSWORD not set for admin RPC auth" };
  }

  const userClient = createClient(url, anonKey);
  const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
    email: qaEmail,
    password: qaPassword,
  });
  if (signErr) {
    return { skipped: true, reason: `sign-in failed: ${signErr.message}` };
  }

  const uid = signIn.user?.id;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (String(profile?.role || "").toLowerCase() !== "admin") {
    await userClient.auth.signOut();
    return { skipped: true, reason: `QA user role is ${profile?.role || "unknown"}, not admin` };
  }

  const steps = [];
  const publicBefore = await countPublicVerificationEvents(listingId);

  for (const [label, verified] of [
    ["verify", true],
    ["remove", false],
    ["verify-again", true],
  ]) {
    const { data, error } = await userClient.rpc("apply_listing_verification_with_event", {
      p_listing_id: listingId,
      p_verified: verified,
      p_admin_user_id: uid,
    });

    const { data: listing } = await admin
      .from("listings")
      .select("verification_status, verified_at, verified_by")
      .eq("id", listingId)
      .maybeSingle();

    const { data: events } = await admin
      .from("listing_events")
      .select("event_type, visibility, correlation_id")
      .eq("listing_id", listingId)
      .order("occurred_at", { ascending: false })
      .limit(5);

    steps.push({
      step: label,
      ok: !error,
      error: error?.message,
      listing,
      rpc: data,
      recent_events: events,
    });
  }

  const publicAfter = await countPublicVerificationEvents(listingId);
  await userClient.auth.signOut();

  return {
    skipped: false,
    listing_id: listingId,
    admin_user_id: uid,
    public_verification_events_before: publicBefore.length,
    public_verification_events_after: publicAfter.length,
    no_duplicate_public_events: publicAfter.length <= publicBefore.length + 1,
    steps,
  };
}

async function main() {
  const report = { generated_at: new Date().toISOString(), sections: [] };

  const { data: listings } = await admin.from("listings").select("id, title, verification_status").order("id");
  report.sections.push({
    name: "listings_audit",
    total: listings?.length ?? 0,
    listings: listings ?? [],
  });

  const { data: events } = await admin.from("listing_events").select("listing_id, event_type, visibility, correlation_id");
  const byListing = {};
  const typeTotals = {};
  for (const e of events || []) {
    byListing[e.listing_id] = (byListing[e.listing_id] || 0) + 1;
    typeTotals[e.event_type] = (typeTotals[e.event_type] || 0) + 1;
  }

  const orphaned = (listings || []).filter((l) => !byListing[l.id]);
  report.sections.push({
    name: "event_counts",
    total_events: events?.length ?? 0,
    type_totals: typeTotals,
    per_listing: byListing,
    orphaned_listings: orphaned.map((l) => l.id),
  });

  const dupCorr = {};
  for (const e of events || []) {
    if (!e.correlation_id) continue;
    const k = `${e.listing_id}:${e.correlation_id}`;
    dupCorr[k] = (dupCorr[k] || 0) + 1;
  }
  const duplicateCorrelations = Object.entries(dupCorr).filter(([, n]) => n > 1);
  report.sections.push({
    name: "integrity",
    duplicate_correlation_ids: duplicateCorrelations,
    update_delete_triggers: "verified separately in verify-listing-events-db.mjs",
  });

  const testListingId = listings?.[0]?.id;
  if (testListingId) {
    report.sections.push({
      name: "verification_workflow",
      result: await runAdminVerificationCycle(testListingId, null),
    });
  }

  const { data: idempotentRun } = await admin.rpc("append_listing_event", {
    p_listing_id: testListingId,
    p_event_type: "listing.created",
    p_visibility: "internal",
    p_payload: { note: "idempotency-rerun" },
    p_source: "migration_backfill",
    p_correlation_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  });
  const { data: idempotentRun2 } = await admin.rpc("append_listing_event", {
    p_listing_id: testListingId,
    p_event_type: "listing.created",
    p_visibility: "internal",
    p_payload: { note: "idempotency-rerun-2" },
    p_source: "migration_backfill",
    p_correlation_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  });

  report.sections.push({
    name: "backfill_idempotency",
    same_correlation_returns_same_id: idempotentRun === idempotentRun2,
    event_id: idempotentRun,
  });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
