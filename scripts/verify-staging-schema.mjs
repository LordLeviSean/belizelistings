#!/usr/bin/env node
/**
 * Verify staging schema markers for open-beta migrations — no secrets printed.
 */
import { createClient } from "@supabase/supabase-js";
import { mergeEnv, requireSupabase } from "./_load-env.mjs";

const CHECKS = [
  {
    id: "viewing_requests.proposed_by",
    migration: "20260712140000_open_beta_communication_loop.sql",
    async run(admin) {
      const { error } = await admin.from("viewing_requests").select("proposed_by").limit(1);
      return { ok: !error, detail: error?.message || "column readable" };
    },
  },
  {
    id: "viewing_requests table",
    migration: "20260626160000_crm_foundation.sql",
    async run(admin) {
      const { error } = await admin.from("viewing_requests").select("id").limit(1);
      return { ok: !error, detail: error?.message || "table readable" };
    },
  },
  {
    id: "notification_queue table",
    migration: "20260627120000_notification_delivery.sql",
    async run(admin) {
      const { error } = await admin.from("notification_queue").select("id").limit(1);
      return { ok: !error, detail: error?.message || "table readable" };
    },
  },
  {
    id: "notifications inbox table",
    migration: "20260627120000_notification_delivery.sql",
    async run(admin) {
      const { error } = await admin.from("notifications").select("id").limit(1);
      return { ok: !error, detail: error?.message || "table readable" };
    },
  },
  {
    id: "listings.lifecycle_status",
    migration: "20260710200000_recently_closed_listing_lifecycle.sql",
    async run(admin) {
      const { error } = await admin.from("listings").select("lifecycle_status").limit(1);
      return { ok: !error, detail: error?.message || "column readable" };
    },
  },
  {
    id: "create_inquiry_with_conversation rpc",
    migration: "20260712120000_p0_marketplace_security.sql",
    async run(admin) {
      const { error } = await admin.rpc("create_inquiry_with_conversation", {
        p_listing_id: -1,
        p_agent_user_id: "00000000-0000-0000-0000-000000000000",
        p_message: "probe",
      });
      const msg = String(error?.message || "");
      const exists =
        msg.includes("listing not found") ||
        msg.includes("authentication_required") ||
        msg.includes("listing_id and agent_user_id");
      return { ok: exists, detail: exists ? "rpc callable" : msg || "unknown" };
    },
  },
  {
    id: "enqueue_notification_event rpc",
    migration: "20260712120000_p0_marketplace_security.sql",
    async run(admin) {
      const { error } = await admin.rpc("enqueue_notification_event", {
        p_event_type: "new_inquiry",
        p_recipient_id: "00000000-0000-0000-0000-000000000000",
        p_payload: { dedupe_key: `probe-${Date.now()}` },
      });
      const msg = String(error?.message || "");
      const exists = !msg.includes("Could not find the function");
      return { ok: exists, detail: exists ? "rpc callable" : msg };
    },
  },
  {
    id: "process_notification_queue_batch rpc",
    migration: "20260627120000_notification_delivery.sql",
    async run(admin) {
      const { error } = await admin.rpc("process_notification_queue_batch", { p_limit: 1 });
      const msg = String(error?.message || "");
      const exists = !msg.includes("Could not find the function");
      return { ok: exists, detail: exists ? "rpc callable" : msg };
    },
  },
];

async function main() {
  const env = mergeEnv();
  let url;
  let key;
  try {
    ({ url, key } = requireSupabase());
  } catch (err) {
    console.log(JSON.stringify({ ok: false, blockers: [err.message], checks: [] }, null, 2));
    process.exit(1);
  }

  const admin = createClient(url, key);
  const results = [];
  let allOk = true;

  for (const check of CHECKS) {
    let result;
    try {
      result = await check.run(admin);
    } catch (err) {
      result = { ok: false, detail: err.message || String(err) };
    }
    if (!result.ok) allOk = false;
    results.push({
      id: check.id,
      migration: check.migration,
      ok: result.ok,
      detail: result.detail,
    });
  }

  const report = {
    ok: allOk,
    projectUrl: env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT SET",
    serviceRole: env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "NOT SET",
    databaseUrl: env.DATABASE_URL || env.DIRECT_URL ? "SET" : "NOT SET",
    checks: results,
    note: "Schema probes via PostgREST/RPC only. Does not prove SQL migrations were applied if objects pre-existed.",
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
