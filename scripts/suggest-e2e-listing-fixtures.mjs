#!/usr/bin/env node
/**
 * Suggest E2E listing fixture IDs — no PII printed.
 */
import { createClient } from "@supabase/supabase-js";
import { requireSupabase } from "./_load-env.mjs";

async function main() {
  const { url, key } = requireSupabase();
  const admin = createClient(url, key);

  const { data: published } = await admin
    .from("listings")
    .select("id,title,status,lifecycle_status,moderation_status,user_id")
    .not("user_id", "is", null)
    .in("status", ["published", "active", "approved"])
    .limit(10);

  const { data: all } = await admin
    .from("listings")
    .select("id,title,status,lifecycle_status,moderation_status,user_id")
    .not("user_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(10);

  console.log(
    JSON.stringify(
      {
        publishedCandidates: (published || []).map((r) => ({
          id: r.id,
          title: r.title?.slice(0, 40),
          status: r.status,
          lifecycle_status: r.lifecycle_status,
          ownerUserId: r.user_id,
        })),
        recentWithOwner: (all || []).map((r) => ({
          id: r.id,
          title: r.title?.slice(0, 40),
          status: r.status,
          lifecycle_status: r.lifecycle_status,
          ownerUserId: r.user_id,
        })),
        note: "Pick E2E_PUBLISHED_LISTING_ID owned by E2E_OWNER account. Use a separate disposable listing for E2E_CLOSABLE_LISTING_ID.",
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
