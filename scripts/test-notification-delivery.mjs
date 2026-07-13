#!/usr/bin/env node
/**
 * Verify notification queue → inbox delivery via service-role batch processor.
 * Optionally hits deployed cron endpoint when CRON_SECRET + E2E_BASE_URL are set.
 *
 * Does not print secrets.
 */
import { createClient } from "@supabase/supabase-js";
import { mergeEnv, requireSupabase } from "./_load-env.mjs";

async function processViaRpc(admin) {
  const { data, error } = await admin.rpc("process_notification_queue_batch", { p_limit: 25 });
  if (error) return { ok: false, error: error.message, via: "rpc" };
  return { ok: true, via: "rpc", result: data };
}

async function processViaCron(baseUrl, cronSecret) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/cron/process-notifications?limit=25`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const body = await res.json().catch(() => ({}));
  return {
    ok: res.ok && body.ok === true,
    status: res.status,
    via: "cron_http",
    result: body,
  };
}

async function main() {
  const env = mergeEnv();
  const { url, key } = requireSupabase();
  const admin = createClient(url, key);

  const before = await admin
    .from("notification_queue")
    .select("id,status,event_type,created_at", { count: "exact" })
    .in("status", ["pending", "processing"])
    .limit(5);

  const inboxBefore = await admin.from("notifications").select("id", { count: "exact", head: true });

  const rpcResult = await processViaRpc(admin);

  let cronResult = { ok: false, skipped: true, reason: "CRON_SECRET not set" };
  const cronSecret = env.CRON_SECRET;
  const baseUrl =
    env.E2E_BASE_URL || env.QA_BASE_URL || env.NEXT_PUBLIC_SITE_URL || "https://belizelistings.bz";
  if (cronSecret) {
    cronResult = await processViaCron(baseUrl, cronSecret);
    cronResult.skipped = false;
  }

  const after = await admin
    .from("notification_queue")
    .select("id,status,event_type,processed_at", { count: "exact" })
    .order("processed_at", { ascending: false })
    .limit(5);

  const inboxAfter = await admin.from("notifications").select("id", { count: "exact", head: true });

  const delivered =
    (inboxAfter.count ?? 0) > (inboxBefore.count ?? 0) ||
    (after.data || []).some((r) => r.status === "delivered" || r.processed_at);

  const report = {
    ok: rpcResult.ok || cronResult.ok,
    queuePendingBefore: before.count ?? before.data?.length ?? 0,
    queueSample: before.data || [],
    inboxCountBefore: inboxBefore.count ?? 0,
    inboxCountAfter: inboxAfter.count ?? 0,
    deliveryObserved: delivered,
    rpc: rpcResult,
    cron: cronResult,
    note: "deliveryObserved true when inbox grew or queue rows processed. Run after a real product event for end-to-end proof.",
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
