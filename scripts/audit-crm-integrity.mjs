#!/usr/bin/env node
/**
 * CRM data integrity audit (Workstream G).
 * Usage: node scripts/audit-crm-integrity.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { requireSupabase } from "./_load-env.mjs";

async function main() {
  const { url, key } = requireSupabase();
  const supabase = createClient(url, key);

  const [
    { data: inquiries },
    { data: conversations },
    { data: viewings },
    { data: listings },
  ] = await Promise.all([
    supabase.from("listing_inquiries").select("id,listing_id,agent_user_id,listing_owner_id,conversation_id,sender_email"),
    supabase.from("conversations").select("id,listing_id,inquiry_id,buyer_id,agent_id,buyer_email,status"),
    supabase.from("viewing_requests").select("id,listing_id,conversation_id,agent_user_id,requester_id,status"),
    supabase.from("listings").select("id,user_id"),
  ]);

  const listingOwnerById = Object.fromEntries((listings || []).map((l) => [l.id, l.user_id]));
  const issues = [];

  for (const inq of inquiries || []) {
    if (!inq.listing_owner_id) {
      issues.push({ kind: "inquiry_missing_owner", id: inq.id });
    }
    if (!listingOwnerById[inq.listing_id]) {
      issues.push({ kind: "inquiry_orphan_listing", id: inq.id, listing_id: inq.listing_id });
    } else if (inq.agent_user_id && listingOwnerById[inq.listing_id] !== inq.agent_user_id) {
      issues.push({
        kind: "inquiry_agent_mismatch",
        id: inq.id,
        listing_id: inq.listing_id,
        agent_user_id: inq.agent_user_id,
        listing_owner: listingOwnerById[inq.listing_id],
      });
    }
    if (inq.conversation_id) {
      const conv = (conversations || []).find((c) => c.id === inq.conversation_id);
      if (!conv) {
        issues.push({ kind: "inquiry_orphan_conversation_ref", id: inq.id, conversation_id: inq.conversation_id });
      }
    }
  }

  for (const conv of conversations || []) {
    if (!conv.inquiry_id) {
      issues.push({ kind: "conversation_missing_inquiry", id: conv.id });
    }
    if (!listingOwnerById[conv.listing_id]) {
      issues.push({ kind: "conversation_orphan_listing", id: conv.id, listing_id: conv.listing_id });
    }
  }

  const convGroups = new Map();
  for (const conv of conversations || []) {
    const key = `${conv.listing_id}|${conv.buyer_id || conv.buyer_email || "guest"}`;
    if (!convGroups.has(key)) convGroups.set(key, []);
    convGroups.get(key).push(conv.id);
  }
  const duplicateConversations = [...convGroups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, conversation_ids: ids, count: ids.length }));

  for (const v of viewings || []) {
    if (!listingOwnerById[v.listing_id]) {
      issues.push({ kind: "viewing_orphan_listing", id: v.id, listing_id: v.listing_id });
    }
    if (v.conversation_id) {
      const conv = (conversations || []).find((c) => c.id === v.conversation_id);
      if (!conv) {
        issues.push({ kind: "viewing_orphan_conversation", id: v.id, conversation_id: v.conversation_id });
      }
    }
  }

  const listingsWithoutOwners = (listings || []).filter((l) => !l.user_id).map((l) => l.id);

  const report = {
    ok: issues.length === 0 && duplicateConversations.length === 0 && listingsWithoutOwners.length === 0,
    counts: {
      inquiries: (inquiries || []).length,
      conversations: (conversations || []).length,
      viewings: (viewings || []).length,
      listings: (listings || []).length,
    },
    issues,
    duplicate_conversations: duplicateConversations,
    listings_without_owners: listingsWithoutOwners,
    repairable: {
      missing_listing_owner_id: (inquiries || []).filter((i) => !i.listing_owner_id).length,
      inquiry_conversation_mismatch: (inquiries || []).filter((i) => {
        if (!i.conversation_id) return false;
        const conv = (conversations || []).find((c) => c.id === i.conversation_id);
        return conv && conv.inquiry_id !== i.id;
      }).length,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok && process.argv.includes("--strict")) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
