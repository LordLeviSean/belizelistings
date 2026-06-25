#!/usr/bin/env node
/**
 * Audit listing verification_status across all listings.
 * Usage: node scripts/audit-listing-verification.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

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
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    value = value.replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

const TRUSTED_ROLES = new Set(["agent", "broker", "admin"]);

function classifyAnomaly(listing, profile) {
  const userId = listing.user_id;
  if (!userId) return "missing_owner_user_id";
  if (!profile) return "missing_owner_profile";
  const role = String(profile.role || "")
    .trim()
    .toLowerCase();
  if (!role) return "owner_role_empty";
  if (TRUSTED_ROLES.has(role)) return "trusted_role_still_unverified";
  return "user_role_unverified_expected";
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiKey = serviceKey || anonKey;

  if (!url || !apiKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and a Supabase key in .env.local (SUPABASE_SERVICE_ROLE_KEY preferred)."
    );
    process.exit(1);
  }

  const supabase = createClient(url, apiKey);
  const usingServiceRole = Boolean(serviceKey);

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, user_id, verification_status, verified_at, verified_by, created_at");

  if (listingsError) {
    if (/verification_status/i.test(listingsError.message || "")) {
      const fallback = await supabase
        .from("listings")
        .select("id, title, user_id, created_at");
      if (fallback.error) {
        console.error("Listings query failed:", fallback.error.message);
        process.exit(1);
      }
      const report = {
        generated_at: new Date().toISOString(),
        credentials: usingServiceRole ? "service_role" : "anon_key_rls_limited",
        migration_status: "verification_status column missing — apply 20260625120000_listing_verification_status.sql",
        totals: {
          total: (fallback.data || []).length,
          verified: null,
          unverified: null,
        },
        anomaly_buckets: {},
        trusted_role_unverified_count: 0,
        anomalies: [],
        truncated: false,
      };
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.error("Listings query failed:", listingsError.message);
    process.exit(1);
  }

  const rows = listings || [];
  const ownerIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];

  const { data: profiles, error: profilesError } = ownerIds.length
    ? await supabase.from("profiles").select("id, role, username").in("id", ownerIds)
    : { data: [], error: null };

  if (profilesError) {
    console.error("Profiles query failed:", profilesError.message);
    process.exit(1);
  }

  const profileMap = new Map((profiles || []).map((p) => [String(p.id), p]));

  let verified = 0;
  let unverified = 0;
  const anomalies = [];
  const buckets = {};

  for (const listing of rows) {
    const status = String(listing.verification_status || "unverified")
      .trim()
      .toLowerCase();
    if (status === "verified") verified += 1;
    else unverified += 1;

    if (status !== "unverified") continue;

    const profile = profileMap.get(String(listing.user_id || ""));
    const reason = classifyAnomaly(listing, profile);
    if (reason === "user_role_unverified_expected") continue;

    buckets[reason] = (buckets[reason] || 0) + 1;
    anomalies.push({
      id: listing.id,
      title: listing.title || "(untitled)",
      user_id: listing.user_id,
      owner_role: profile?.role ?? null,
      reason,
      verification_status: listing.verification_status,
      created_at: listing.created_at,
    });
  }

  const report = {
    generated_at: new Date().toISOString(),
    credentials: usingServiceRole ? "service_role" : "anon_key_rls_limited",
    totals: {
      total: rows.length,
      verified,
      unverified,
    },
    anomaly_buckets: buckets,
    trusted_role_unverified_count: anomalies.length,
    anomalies: anomalies.slice(0, 50),
    truncated: anomalies.length > 50,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
