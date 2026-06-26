#!/usr/bin/env node
/**
 * Verify notification delivery pipeline (Milestone 3.6).
 * Enqueues a test row, processes batch, verifies notifications table, audits dedupe.
 *
 * Usage: node scripts/verify-notification-delivery.mjs [--recipient=uuid] [--cleanup]
 */
import { createClient } from "@supabase/supabase-js";
import { requireSupabase } from "./_load-env.mjs";

const TEST_EVENT = "new_inquiry";
const TEST_PREFIX = "verify-notif-delivery";

async function main() {
  const { url, key, env } = requireSupabase();
  const supabase = createClient(url, key);

  const recipientArg = process.argv.find((a) => a.startsWith("--recipient="));
  const recipientId = recipientArg?.split("=")[1] || env.NOTIFICATION_VERIFY_RECIPIENT_ID;

  if (!recipientId) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "Set --recipient=<uuid> or NOTIFICATION_VERIFY_RECIPIENT_ID in .env.local",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const dedupeKey = `${TEST_PREFIX}:${Date.now()}`;
  const payload = {
    dedupe_key: dedupeKey,
    inquiry_id: `${TEST_PREFIX}-inq`,
    conversation_id: `${TEST_PREFIX}-conv`,
    listing_id: "0",
    inquiry_type: "general",
    verify: true,
  };

  const { data: queueRow, error: enqueueError } = await supabase
    .from("notification_queue")
    .insert({
      event_type: TEST_EVENT,
      recipient_id: recipientId,
      payload,
      status: "pending",
    })
    .select("id,status")
    .single();

  if (enqueueError) {
    console.error(JSON.stringify({ ok: false, step: "enqueue", error: enqueueError.message }, null, 2));
    process.exit(1);
  }

  const { data: batch, error: batchError } = await supabase.rpc("process_notification_queue_batch", {
    p_limit: 5,
  });

  if (batchError) {
    console.error(JSON.stringify({ ok: false, step: "batch", error: batchError.message }, null, 2));
    process.exit(1);
  }

  const { data: notifications, error: notifError } = await supabase
    .from("notifications")
    .select("id,recipient_user_id,event_type,dedupe_key,title,read_at,queue_id")
    .eq("dedupe_key", dedupeKey);

  if (notifError) {
    console.error(JSON.stringify({ ok: false, step: "fetch", error: notifError.message }, null, 2));
    process.exit(1);
  }

  const { data: dupes } = await supabase
    .from("notifications")
    .select("id")
    .eq("dedupe_key", dedupeKey);

  const { data: queueAfter } = await supabase
    .from("notification_queue")
    .select("id,status,processed_at")
    .eq("id", queueRow.id)
    .maybeSingle();

  const duplicateCount = (dupes || []).length;
  const report = {
    ok:
      duplicateCount === 1 &&
      queueAfter?.status === "sent" &&
      (notifications || []).length === 1 &&
      notifications?.[0]?.queue_id === queueRow.id,
    queue_id: queueRow.id,
    queue_status: queueAfter?.status,
    notification_id: notifications?.[0]?.id ?? null,
    dedupe_key: dedupeKey,
    duplicate_count: duplicateCount,
    batch,
  };

  if (process.argv.includes("--cleanup") && notifications?.[0]?.id) {
    await supabase.from("notifications").delete().eq("id", notifications[0].id);
    await supabase.from("notification_queue").delete().eq("id", queueRow.id);
    report.cleaned_up = true;
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
