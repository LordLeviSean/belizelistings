#!/usr/bin/env node
/**
 * End-to-end CRM workflow validation (Milestone 3.3 Workstream B).
 *
 * Flow: Contact Agent → inquiry → conversation → inbox → reply → viewing →
 *       stage update → timeline event → notification_queue
 *
 * Usage: node scripts/validate-marketplace-workflow.mjs [--keep]
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY. QA_EMAIL/QA_PASSWORD optional for anon JWT path.
 */
import { createClient } from "@supabase/supabase-js";
import { mergeEnv, requireSupabase } from "./_load-env.mjs";

const keepData = process.argv.includes("--keep");

const TRANSITIONS = [
  { step: 1, action: "create_inquiry_with_conversation", expect: "inquiry + conversation + message + new_inquiry notification" },
  { step: 2, action: "agent_inbox_fetch", expect: "conversation visible to agent with pipeline_stage new_inquiry" },
  { step: 3, action: "agent_reply", expect: "message row, stage responded, agent_replied notification, listing.crm.agent_responded event" },
  { step: 4, action: "schedule_viewing", expect: "viewing_requests pending row" },
  { step: 5, action: "confirm_viewing", expect: "viewing confirmed, viewing_confirmed notification, listing.viewing.scheduled public event" },
  { step: 6, action: "buyer_panels", expect: "inquiry + viewing visible to buyer when sender_user_id set" },
];

async function signInAnon(env) {
  const email = env.QA_EMAIL || env.NEXT_PUBLIC_QA_EMAIL;
  const password = env.QA_PASSWORD || env.TEST_PASSWORD;
  if (!email || !password) return { client: null, user: null, blocked: "QA_EMAIL/QA_PASSWORD not set" };

  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) return { client: null, user: null, blocked: "NEXT_PUBLIC_SUPABASE_ANON_KEY missing" };

  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { client: null, user: null, blocked: error.message };
  return { client, user: data.user, blocked: null };
}

async function cleanup(supabase, ids) {
  if (keepData) return;
  const { viewingId, inquiryId, conversationId, listingId } = ids;
  if (viewingId) await supabase.from("viewing_requests").delete().eq("id", viewingId);
  if (conversationId) {
    await supabase.from("messages").delete().eq("conversation_id", conversationId);
    await supabase.from("viewing_requests").delete().eq("conversation_id", conversationId);
  }
  if (inquiryId) {
    await supabase.from("listing_inquiries").delete().eq("id", inquiryId);
    await supabase.from("notification_queue").delete().contains("payload", { inquiry_id: inquiryId });
  }
  if (conversationId) await supabase.from("conversations").delete().eq("id", conversationId);
  if (listingId) {
    await supabase
      .from("listing_events")
      .delete()
      .eq("listing_id", listingId)
      .in("event_type", [
        "listing.crm.conversation_created",
        "listing.crm.agent_responded",
        "listing.viewing.scheduled",
      ]);
  }
}

async function main() {
  const env = mergeEnv();
  const { url, key } = requireSupabase();
  const admin = createClient(url, key);
  const anonAttempt = await signInAnon(env);

  const report = {
    transitions: TRANSITIONS,
    steps: [],
    blockers: [],
    ok: false,
  };

  if (anonAttempt.blocked) {
    report.blockers.push({ path: "anon_jwt", reason: anonAttempt.blocked });
  }

  const { data: listings } = await admin
    .from("listings")
    .select("id,user_id,title")
    .not("user_id", "is", null)
    .limit(1);

  const listing = listings?.[0];
  if (!listing) {
    report.blockers.push({ path: "service_role", reason: "No listing with owner found" });
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const testEmail = `workflow-${Date.now()}@belizelistings.test`;
  const ids = { listingId: listing.id };

  try {
    // Step 1 — RPC lead capture
    const { data: created, error: createErr } = await admin.rpc("create_inquiry_with_conversation", {
      p_listing_id: listing.id,
      p_agent_user_id: listing.user_id,
      p_sender_user_id: anonAttempt.user?.id ?? null,
      p_sender_name: "Workflow Test Buyer",
      p_sender_email: testEmail,
      p_sender_phone: null,
      p_inquiry_type: "general",
      p_message: "E2E workflow validation message.",
      p_preferred_contact_method: "email",
    });
    if (createErr) throw new Error(`Step 1 failed: ${createErr.message}`);
    ids.inquiryId = created.inquiry_id;
    ids.conversationId = created.conversation_id;

    const { count: notifCount } = await admin
      .from("notification_queue")
      .select("id", { head: true, count: "exact" })
      .eq("event_type", "new_inquiry")
      .contains("payload", { inquiry_id: ids.inquiryId });

    report.steps.push({
      step: 1,
      ok: !!ids.inquiryId && !!ids.conversationId,
      inquiry_id: ids.inquiryId,
      conversation_id: ids.conversationId,
      new_inquiry_notifications: notifCount ?? 0,
    });

    // Step 2 — Agent inbox
    const { data: inbox } = await admin
      .from("conversations")
      .select("id,pipeline_stage,agent_id")
      .eq("agent_id", listing.user_id)
      .eq("id", ids.conversationId)
      .maybeSingle();

    report.steps.push({
      step: 2,
      ok: inbox?.pipeline_stage === "new_inquiry",
      pipeline_stage: inbox?.pipeline_stage,
    });

    // Step 3 — Agent reply (service role simulates agent write)
    const now = new Date().toISOString();
    const { data: msg, error: msgErr } = await admin
      .from("messages")
      .insert({
        conversation_id: ids.conversationId,
        sender_id: listing.user_id,
        sender_role: "agent",
        body: "Thanks for reaching out — happy to help.",
        channel: "in_app",
      })
      .select("id")
      .single();
    if (msgErr) throw new Error(`Step 3 message failed: ${msgErr.message}`);

    await admin
      .from("conversations")
      .update({ pipeline_stage: "responded", stage: "responded", last_message_at: now, updated_at: now })
      .eq("id", ids.conversationId);

    await admin
      .from("listing_inquiries")
      .update({ status: "responded", pipeline_stage: "responded", responded_at: now, updated_at: now })
      .eq("id", ids.inquiryId);

    await admin.from("notification_queue").insert({
      event_type: "agent_replied",
      recipient_id: anonAttempt.user?.id ?? null,
      recipient_email: anonAttempt.user ? null : testEmail,
      payload: { conversation_id: ids.conversationId, message_id: msg.id },
      status: "pending",
      scheduled_at: now,
    });

    const { data: agentEventId, error: agentEventErr } = await admin.rpc("append_listing_event", {
      p_listing_id: listing.id,
      p_event_type: "listing.crm.agent_responded",
      p_visibility: "internal",
      p_payload: { conversation_id: ids.conversationId, message_id: msg.id },
      p_actor_id: listing.user_id,
      p_actor_role: "agent",
      p_source: "migration_backfill",
      p_correlation_id: msg.id,
    });
    if (agentEventErr) throw new Error(`Step 3 timeline failed: ${agentEventErr.message}`);

    report.steps.push({ step: 3, ok: !!msg?.id, message_id: msg.id, event_id: agentEventId });

    // Step 4 — Viewing request
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    const { data: viewing, error: viewErr } = await admin
      .from("viewing_requests")
      .insert({
        listing_id: listing.id,
        conversation_id: ids.conversationId,
        requester_id: anonAttempt.user?.id ?? null,
        requester_email: testEmail,
        requester_name: "Workflow Test Buyer",
        agent_user_id: listing.user_id,
        requested_date: dateStr,
        requested_time: "10:00:00",
        status: "pending",
      })
      .select("id")
      .single();
    if (viewErr) throw new Error(`Step 4 failed: ${viewErr.message}`);
    ids.viewingId = viewing.id;

    report.steps.push({ step: 4, ok: !!viewing?.id, viewing_id: viewing.id });

    // Step 5 — Confirm viewing
    await admin
      .from("viewing_requests")
      .update({ status: "confirmed", confirmed_by: listing.user_id, confirmed_at: now, updated_at: now })
      .eq("id", ids.viewingId);

    await admin
      .from("conversations")
      .update({ pipeline_stage: "viewing_scheduled", stage: "viewing_scheduled", updated_at: now })
      .eq("id", ids.conversationId);

    await admin.from("notification_queue").insert({
      event_type: "viewing_confirmed",
      recipient_id: anonAttempt.user?.id ?? null,
      recipient_email: anonAttempt.user ? null : testEmail,
      payload: { viewing_id: ids.viewingId, listing_id: listing.id },
      status: "pending",
      scheduled_at: now,
    });

    const { data: viewingEventId, error: viewingEventErr } = await admin.rpc("append_listing_event", {
      p_listing_id: listing.id,
      p_event_type: "listing.viewing.scheduled",
      p_visibility: "public",
      p_payload: { viewing_id: ids.viewingId, requested_date: dateStr, requested_time: "10:00:00" },
      p_actor_id: listing.user_id,
      p_actor_role: "agent",
      p_source: "migration_backfill",
      p_correlation_id: ids.viewingId,
    });
    if (viewingEventErr) throw new Error(`Step 5 timeline failed: ${viewingEventErr.message}`);

    const { data: timeline } = await admin
      .from("listing_events")
      .select("event_type,visibility")
      .eq("listing_id", listing.id)
      .in("event_type", ["listing.crm.agent_responded", "listing.viewing.scheduled"]);

    report.steps.push({
      step: 5,
      ok: (timeline || []).some((e) => e.event_type === "listing.viewing.scheduled" && e.visibility === "public"),
      timeline_events: timeline,
      viewing_event_id: viewingEventId,
    });

    // Step 6 — Buyer visibility (only when QA user signed in)
    if (anonAttempt.user?.id) {
      const buyerId = anonAttempt.user.id;
      const { data: buyerInq } = await admin
        .from("listing_inquiries")
        .select("id")
        .eq("id", ids.inquiryId)
        .or(`sender_user_id.eq.${buyerId},sender_id.eq.${buyerId}`);
      const { data: buyerView } = await admin
        .from("viewing_requests")
        .select("id")
        .eq("id", ids.viewingId)
        .eq("requester_id", buyerId);

      report.steps.push({
        step: 6,
        ok: (buyerInq || []).length > 0 && (buyerView || []).length > 0,
        buyer_inquiries: (buyerInq || []).length,
        buyer_viewings: (buyerView || []).length,
        path: "authenticated_buyer",
      });
    } else {
      report.steps.push({
        step: 6,
        ok: true,
        skipped: true,
        reason: "Guest inquiry path — buyer panels require authenticated sender_user_id",
        path: "guest",
      });
    }

    report.ok = report.steps.every((s) => s.ok || s.skipped);
  } catch (e) {
    report.steps.push({ error: e.message });
    report.ok = false;
  } finally {
    await cleanup(admin, ids);
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
