/**
 * Read-only reconciliation: listing_inquiries rows vs canonical Inbox KPI.
 *
 * Usage (linked Supabase CLI auth required):
 *   node scripts/reconcile-inquiry-kpi.mjs [agent_user_id]
 *
 * Default agent: production affected account from CRM cleanup.
 */
import { execFileSync } from "node:child_process";

const agentId = process.argv[2] || "db0127ba-21e6-40b7-a596-b2fcb9015cc0";

function query(sql) {
  const out = execFileSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--output-format", "json", sql],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
  const start = out.indexOf("{");
  const json = JSON.parse(out.slice(start));
  return json.rows || [];
}

const inquiries = query(`
  SELECT li.id, li.listing_id, li.inquiry_type, li.status, li.conversation_id,
         li.sender_user_id, li.created_at,
         c.id AS conv_id, c.agent_deleted_at, c.agent_archived_at
  FROM public.listing_inquiries li
  LEFT JOIN public.conversations c ON c.inquiry_id = li.id
  WHERE li.agent_user_id = '${agentId}'
  ORDER BY li.created_at DESC
`);

const inbox = query(`
  SELECT c.id, c.listing_id, c.inquiry_id, li.inquiry_type, c.agent_deleted_at, c.agent_archived_at
  FROM public.conversations c
  LEFT JOIN public.listing_inquiries li ON li.id = c.inquiry_id
  WHERE c.agent_id = '${agentId}'
    AND c.agent_deleted_at IS NULL
    AND c.agent_archived_at IS NULL
    AND COALESCE(li.inquiry_type, 'general') <> 'schedule_viewing'
  ORDER BY c.updated_at DESC
`);

const viewings = query(`
  SELECT id, listing_id, status, created_at
  FROM public.viewing_requests
  WHERE agent_user_id = '${agentId}'
  ORDER BY created_at DESC
`);

console.log(JSON.stringify({
  agent_user_id: agentId,
  listing_inquiries_raw: inquiries.length,
  canonical_inbox_inquiries: inbox.length,
  viewing_requests: viewings.length,
  rows: inquiries.map((r) => ({
    inquiry_id: r.id,
    listing_id: r.listing_id,
    inquiry_type: r.inquiry_type,
    status: r.status,
    conversation_id: r.conversation_id || r.conv_id || null,
    agent_deleted_at: r.agent_deleted_at,
    counts_toward_kpi:
      Boolean(r.conv_id) &&
      !r.agent_deleted_at &&
      !r.agent_archived_at &&
      r.inquiry_type !== "schedule_viewing",
    reason: !r.conv_id
      ? "orphaned_no_conversation"
      : r.inquiry_type === "schedule_viewing"
        ? "synthetic_schedule_viewing"
        : r.agent_deleted_at
          ? "agent_deleted_conversation"
          : r.agent_archived_at
            ? "agent_archived_conversation"
            : "active_inbox",
  })),
  inbox_conversation_ids: inbox.map((r) => r.id),
  viewing_ids: viewings.map((r) => r.id),
}, null, 2));
