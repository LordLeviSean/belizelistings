#!/usr/bin/env node
/**
 * Safe CRM integrity repairs (Workstream G).
 * Usage: node scripts/repair-crm-integrity.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { requireSupabase } from "./_load-env.mjs";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const { url, key } = requireSupabase();
  const supabase = createClient(url, key);
  const repairs = [];

  const { data: missingOwner } = await supabase
    .from("listing_inquiries")
    .select("id,agent_user_id")
    .is("listing_owner_id", null);

  for (const row of missingOwner || []) {
    if (!row.agent_user_id) continue;
    repairs.push({
      action: "set_listing_owner_id",
      inquiry_id: row.id,
      value: row.agent_user_id,
    });
    if (!dryRun) {
      await supabase
        .from("listing_inquiries")
        .update({ listing_owner_id: row.agent_user_id, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id,inquiry_id")
    .not("inquiry_id", "is", null);

  for (const conv of conversations || []) {
    const { data: inq } = await supabase
      .from("listing_inquiries")
      .select("id,conversation_id")
      .eq("id", conv.inquiry_id)
      .maybeSingle();

    if (inq && inq.conversation_id !== conv.id) {
      repairs.push({
        action: "link_inquiry_conversation_id",
        inquiry_id: inq.id,
        conversation_id: conv.id,
      });
      if (!dryRun) {
        await supabase
          .from("listing_inquiries")
          .update({ conversation_id: conv.id, updated_at: new Date().toISOString() })
          .eq("id", inq.id);
      }
    }
  }

  const manual = [
    "duplicate_conversations (same listing + buyer) — review and merge manually",
    "viewing_orphan_listing — delete or reassign viewing_requests.listing_id",
    "listings without user_id — assign owner in admin or archive listing",
    "inquiry_agent_mismatch — verify listing ownership transfer history",
  ];

  console.log(
    JSON.stringify(
      {
        dry_run: dryRun,
        repairs_applied: repairs.length,
        repairs,
        manual_cases: manual,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
