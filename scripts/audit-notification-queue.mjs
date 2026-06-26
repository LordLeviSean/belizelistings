#!/usr/bin/env node
/**
 * Audit notification_queue integrity (Milestone 3.3 Workstream C).
 * Usage: node scripts/audit-notification-queue.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { requireSupabase } from "./_load-env.mjs";

const EXPECTED_EVENT_TYPES = [
  "new_inquiry",
  "agent_replied",
  "viewing_scheduled",
  "viewing_confirmed",
  "viewing_cancelled",
  "conversation_created",
];

function isValidPayload(payload) {
  if (payload == null) return false;
  if (typeof payload !== "object" || Array.isArray(payload)) return false;
  return true;
}

async function main() {
  const { url, key } = requireSupabase();
  const supabase = createClient(url, key);

  const { data: rows, error } = await supabase
    .from("notification_queue")
    .select("id,event_type,recipient_id,recipient_email,status,payload,created_at,scheduled_at,attempts")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  }

  const byType = {};
  const byStatus = {};
  const issues = [];

  for (const row of rows || []) {
    byType[row.event_type] = (byType[row.event_type] || 0) + 1;
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;

    if (!EXPECTED_EVENT_TYPES.includes(row.event_type)) {
      issues.push({ id: row.id, kind: "unknown_event_type", event_type: row.event_type });
    }
    if (!row.recipient_id && !row.recipient_email) {
      issues.push({ id: row.id, kind: "orphan_recipient", event_type: row.event_type });
    }
    if (!isValidPayload(row.payload)) {
      issues.push({ id: row.id, kind: "invalid_payload", event_type: row.event_type });
    }
    if (row.status === "failed") {
      issues.push({ id: row.id, kind: "failed_delivery", event_type: row.event_type });
    }
  }

  const duplicateKeys = new Map();
  for (const row of rows || []) {
    const key = `${row.event_type}|${row.recipient_id || row.recipient_email}|${JSON.stringify(row.payload)}`;
    if (!duplicateKeys.has(key)) duplicateKeys.set(key, []);
    duplicateKeys.get(key).push(row.id);
  }
  const duplicates = [...duplicateKeys.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids, count: ids.length }));

  const report = {
    ok: issues.length === 0 && duplicates.length === 0,
    total_rows: (rows || []).length,
    by_event_type: byType,
    by_status: byStatus,
    expected_event_types: EXPECTED_EVENT_TYPES,
    missing_event_types: EXPECTED_EVENT_TYPES.filter((t) => !byType[t]),
    issues,
    duplicate_groups: duplicates,
    pending: byStatus.pending || 0,
    failed: byStatus.failed || 0,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok && process.argv.includes("--strict")) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
