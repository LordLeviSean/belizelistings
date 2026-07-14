#!/usr/bin/env node
/** Summarize notification_queue status counts — no PII. */
import { createClient } from "@supabase/supabase-js";
import { mergeEnv, requireSupabase } from "./_load-env.mjs";

async function main() {
  const { url, key } = requireSupabase();
  const admin = createClient(url, key);

  const statuses = ["pending", "processing", "sent", "failed", "skipped"];
  const counts = {};
  for (const status of statuses) {
    const { count, error } = await admin
      .from("notification_queue")
      .select("id", { head: true, count: "exact" })
      .eq("status", status);
    if (error) {
      console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
      process.exit(1);
    }
    counts[status] = count ?? 0;
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentDelivered } = await admin
    .from("notification_queue")
    .select("id", { head: true, count: "exact" })
    .eq("status", "sent")
    .gte("updated_at", oneHourAgo);

  const { count: recentPending } = await admin
    .from("notification_queue")
    .select("id", { head: true, count: "exact" })
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString());

  const { count: notifTotal } = await admin.from("notifications").select("id", { head: true, count: "exact" });
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: notifRecent } = await admin
    .from("notifications")
    .select("id", { head: true, count: "exact" })
    .gte("created_at", weekAgo);

  const { data: recentQueue } = await admin
    .from("notification_queue")
    .select("status,event_type,updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  console.log(
    JSON.stringify(
      {
        ok: true,
        counts,
        recent_delivered_last_hour: recentDelivered ?? 0,
        due_pending_now: recentPending ?? 0,
        queue_moving: (recentDelivered ?? 0) > 0 || counts.sent > 0,
        notifications_total: notifTotal ?? 0,
        notifications_last_7d: notifRecent ?? 0,
        in_app_pipeline_active: (notifTotal ?? 0) > 0,
        recent_queue: recentQueue || [],
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
