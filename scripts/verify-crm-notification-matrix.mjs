#!/usr/bin/env node
/**
 * Verify CRM notification matrix migration (20260714180000) on linked Supabase.
 * No secrets printed.
 */
import { createClient } from "@supabase/supabase-js";
import { mergeEnv, requireSupabase } from "./_load-env.mjs";

const TARGET_MIGRATIONS = [
  "20260714150000_crm_viewing_inbox_separation.sql",
  "20260714180000_crm_notification_matrix.sql",
];

const MATRIX_EVENTS = [
  {
    event: "new_inquiry",
    payload: {
      listing_title: "Finca Solana Seaview Residential",
      sender_name: "Alexis Marie",
      conversation_id: "00000000-0000-0000-0000-000000000001",
      message_id: "00000000-0000-0000-0000-000000000002",
    },
    expectTitle: "New message received",
    expectBodyIncludes: ["Alexis Marie", "Finca Solana"],
  },
  {
    event: "agent_replied",
    payload: {
      listing_title: "Finca Solana Seaview Residential",
      conversation_id: "00000000-0000-0000-0000-000000000001",
      message_id: "00000000-0000-0000-0000-000000000003",
    },
    expectTitle: "You received a reply",
    expectBodyIncludes: ["Finca Solana"],
  },
  {
    event: "viewing_requested",
    payload: {
      listing_title: "Finca Solana Seaview Residential",
      sender_name: "Alexis Marie",
      viewing_id: "00000000-0000-0000-0000-000000000010",
      slot_label: "Wednesday, July 15 • 8:00 AM",
    },
    expectTitle: "New viewing request",
    expectBodyIncludes: ["Alexis Marie", "Finca Solana", "July 15"],
  },
  {
    event: "viewing_confirmed",
    payload: {
      listing_title: "Finca Solana Seaview Residential",
      viewing_id: "00000000-0000-0000-0000-000000000010",
      slot_label: "Wednesday, July 15 • 8:00 AM",
    },
    expectTitle: "Viewing confirmed",
    expectBodyIncludes: ["Finca Solana", "confirmed"],
  },
  {
    event: "viewing_declined",
    payload: {
      listing_title: "Finca Solana Seaview Residential",
      viewing_id: "00000000-0000-0000-0000-000000000010",
    },
    expectTitle: "Viewing declined",
    expectBodyIncludes: ["Finca Solana", "declined"],
  },
  {
    event: "viewing_rescheduled",
    payload: {
      listing_title: "Finca Solana Seaview Residential",
      viewing_id: "00000000-0000-0000-0000-000000000010",
      slot_label: "Thursday, July 16 • 10:30 AM",
      proposed_date: "2026-07-16",
    },
    expectTitle: "Viewing rescheduled",
    expectBodyIncludes: ["Finca Solana", "proposed"],
  },
  {
    event: "viewing_cancelled",
    payload: {
      listing_title: "Finca Solana Seaview Residential",
      viewing_id: "00000000-0000-0000-0000-000000000010",
    },
    expectTitle: "Viewing cancelled",
    expectBodyIncludes: ["Finca Solana", "cancelled"],
  },
  {
    event: "viewing_completed",
    payload: {
      listing_title: "Finca Solana Seaview Residential",
      viewing_id: "00000000-0000-0000-0000-000000000010",
    },
    expectTitle: "Viewing completed",
    expectBodyIncludes: ["Finca Solana", "complete"],
  },
];

async function checkMigrationHistory(admin) {
  const { data, error } = await admin
    .from("schema_migrations")
    .select("version")
    .in("version", TARGET_MIGRATIONS.map((f) => f.replace(".sql", "")));

  if (error) {
    const msg = String(error.message || "");
    if (msg.includes("schema_migrations") || msg.includes("does not exist")) {
      return {
        ok: null,
        detail: "schema_migrations not exposed via PostgREST — use supabase migration list",
        versions: [],
      };
    }
    return { ok: false, detail: msg, versions: [] };
  }

  const versions = (data || []).map((r) => r.version);
  const expected = TARGET_MIGRATIONS.map((f) => f.replace(".sql", ""));
  const missing = expected.filter((v) => !versions.includes(v));
  return {
    ok: missing.length === 0,
    detail: missing.length ? `missing: ${missing.join(", ")}` : "both migrations recorded",
    versions,
  };
}

async function checkEnsureMessagingRpc(admin) {
  const { error } = await admin.rpc("ensure_messaging_conversation", {
    p_listing_id: -1,
    p_agent_user_id: "00000000-0000-0000-0000-000000000000",
    p_buyer_user_id: "00000000-0000-0000-0000-000000000001",
  });
  const msg = String(error?.message || "");
  const callable = !msg.includes("Could not find the function");
  const expectedError =
    msg.includes("listing not found") ||
    msg.includes("only listing contact") ||
    msg.includes("authentication") ||
    msg.includes("required") ||
    msg.includes("foreign key constraint") ||
    msg.includes("violates foreign key");
  return {
    ok: callable && (expectedError || !error),
    detail: callable ? msg || "rpc callable" : msg,
  };
}

async function checkPresentationMatrix(admin) {
  const results = [];
  let allOk = true;

  for (const row of MATRIX_EVENTS) {
    const { data, error } = await admin.rpc("notification_presentation_for_event", {
      p_event_type: row.event,
      p_payload: row.payload,
    });

    const msg = String(error?.message || "");
    if (msg.includes("Could not find the function")) {
      allOk = false;
      results.push({ event: row.event, ok: false, detail: "function missing" });
      continue;
    }

    const pres = Array.isArray(data) ? data[0] : data;
    const titleOk = pres?.title === row.expectTitle;
    const body = String(pres?.body || "");
    const bodyOk = row.expectBodyIncludes.every((s) => body.toLowerCase().includes(s.toLowerCase()));
    const dedupeOk = Boolean(pres?.dedupe_key);
    const ok = !error && titleOk && bodyOk && dedupeOk;
    if (!ok) allOk = false;

    results.push({
      event: row.event,
      ok,
      title: pres?.title,
      bodyPreview: body.slice(0, 120),
      dedupe_key: pres?.dedupe_key,
      detail: error?.message || (ok ? "matrix row ok" : `titleOk=${titleOk} bodyOk=${bodyOk} dedupeOk=${dedupeOk}`),
    });
  }

  return { ok: allOk, results };
}

async function checkEnqueueViewingCompleted(admin) {
  const dedupe = `verify-viewing-completed-${Date.now()}`;
  const { data, error } = await admin.rpc("enqueue_notification_event", {
    p_event_type: "viewing_completed",
    p_recipient_id: "00000000-0000-0000-0000-000000000099",
    p_payload: {
      viewing_id: "00000000-0000-0000-0000-000000000099",
      listing_title: "Verification Listing",
      dedupe_key: dedupe,
    },
  });
  const msg = String(error?.message || "");
  const callable = !msg.includes("Could not find the function");
  const queued = data && (data.queue_id || data.queueId);
  const expectedFk =
    msg.includes("foreign key constraint") || msg.includes("violates foreign key");
  return {
    ok: callable && (Boolean(queued) || expectedFk),
    detail: callable
      ? queued
        ? "viewing_completed enqueued"
        : expectedFk
          ? "rpc callable (probe recipient FK expected)"
          : msg || "no queue_id"
      : msg,
    queue_id: queued || null,
  };
}

async function main() {
  const env = mergeEnv();
  let url;
  let key;
  try {
    ({ url, key } = requireSupabase());
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exit(1);
  }

  const admin = createClient(url, key);
  const migrationHistory = await checkMigrationHistory(admin);
  const ensureRpc = await checkEnsureMessagingRpc(admin);
  const presentation = await checkPresentationMatrix(admin);
  const enqueue = await checkEnqueueViewingCompleted(admin);

  const ok =
    ensureRpc.ok &&
    presentation.ok &&
    enqueue.ok &&
    (migrationHistory.ok === true || migrationHistory.ok === null);

  const report = {
    ok,
    projectUrl: env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT SET",
    target_migrations: TARGET_MIGRATIONS,
    checks: {
      migration_history: migrationHistory,
      ensure_messaging_conversation: ensureRpc,
      notification_presentation_matrix: presentation,
      enqueue_viewing_completed: enqueue,
    },
    confirmation: ok
      ? "CRM notification matrix migration is active on production database"
      : "CRM notification matrix verification failed — see checks",
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
