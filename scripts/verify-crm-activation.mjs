#!/usr/bin/env node
/**
 * Verify CRM foundation migration (Milestone 3.2/3.3).
 * Usage: node scripts/verify-crm-activation.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { mergeEnv, requireSupabase } from "./_load-env.mjs";

const CRM_TABLES = [
  "listing_inquiries",
  "conversations",
  "messages",
  "viewing_requests",
  "notification_queue",
];

async function main() {
  const { url, key } = requireSupabase();
  const supabase = createClient(url, key);
  const report = { checks: [], errors: [], summary: {} };

  async function check(name, fn) {
    try {
      const result = await fn();
      report.checks.push({ name, ok: true, ...result });
    } catch (e) {
      report.errors.push({ name, message: e.message });
      report.checks.push({ name, ok: false, error: e.message });
    }
  }

  for (const table of CRM_TABLES) {
    await check(`${table} table`, async () => {
      const { error, count } = await supabase.from(table).select("id", { head: true, count: "exact" });
      if (error) throw new Error(error.message);
      return { accessible: true, row_count: count ?? 0 };
    });
  }

  await check("create_inquiry_with_conversation RPC", async () => {
    const { data: listings, error: le } = await supabase
      .from("listings")
      .select("id, user_id")
      .not("user_id", "is", null)
      .limit(1);
    if (le) throw new Error(le.message);
    const listing = listings?.[0];
    if (!listing) return { skipped: "no listings with owner" };

    const testEmail = `crm-verify-${Date.now()}@belizelistings.test`;
    const { data, error } = await supabase.rpc("create_inquiry_with_conversation", {
      p_listing_id: listing.id,
      p_agent_user_id: listing.user_id,
      p_sender_user_id: null,
      p_sender_name: "CRM Verify Script",
      p_sender_email: testEmail,
      p_sender_phone: null,
      p_inquiry_type: "general",
      p_message: "Automated CRM activation verification (safe to delete).",
      p_preferred_contact_method: "email",
      p_quality_score: null,
      p_requested_date: null,
      p_requested_time: null,
    });
    if (error) throw new Error(error.message);

    const inquiryId = data?.inquiry_id;
    const conversationId = data?.conversation_id;

    if (inquiryId) {
      await supabase.from("listing_inquiries").delete().eq("id", inquiryId);
    }
    if (conversationId) {
      await supabase.from("messages").delete().eq("conversation_id", conversationId);
      await supabase.from("conversations").delete().eq("id", conversationId);
    }
    await supabase.from("notification_queue").delete().contains("payload", { inquiry_id: inquiryId });

    return {
      rpc_ok: true,
      inquiry_id: inquiryId,
      conversation_id: conversationId,
      cleaned_up: true,
    };
  });

  await check("CRM listing event types present", async () => {
    const types = [
      "listing.crm.conversation_created",
      "listing.crm.agent_responded",
      "listing.crm.viewing_cancelled",
      "listing.viewing.scheduled",
    ];
    const { data, error } = await supabase
      .from("listing_events")
      .select("event_type")
      .in("event_type", types);
    if (error) throw new Error(error.message);
    const found = [...new Set((data || []).map((r) => r.event_type))];
    return { expected: types, found_in_db: found };
  });

  report.summary = {
    total_checks: report.checks.length,
    passed: report.checks.filter((c) => c.ok).length,
    failed: report.errors.length,
  };

  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
