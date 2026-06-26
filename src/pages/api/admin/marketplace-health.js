import { createClient } from "@supabase/supabase-js";
import {
  fetchProfileRowWithTiers,
  PROFILE_ROLE_ONLY_SELECT,
} from "../../../lib/profileSelectContract";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

function startOfUtcDay() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function countSecurityEvents(adminClient, eventType, sinceIso) {
  let q = adminClient.from("security_events").select("id", { head: true, count: "exact" });
  if (eventType) q = q.eq("event_type", eventType);
  if (sinceIso) q = q.gte("created_at", sinceIso);
  const { count, error } = await q;
  return error ? null : count ?? 0;
}

async function fetchRecentSecurityEvents(adminClient, limit = 10) {
  const { data, error } = await adminClient
    .from("security_events")
    .select("id,event_type,listing_id,sender_email,created_at,metadata")
    .order("created_at", { ascending: false })
    .limit(limit);
  return error ? [] : data ?? [];
}

async function notificationLatencySample(adminClient) {
  const { data } = await adminClient
    .from("notification_queue")
    .select("scheduled_at,processed_at,status")
    .eq("status", "sent")
    .not("processed_at", "is", null)
    .order("processed_at", { ascending: false })
    .limit(20);
  if (!data?.length) return null;
  const deltas = data
    .map((row) => {
      const scheduled = new Date(row.scheduled_at).getTime();
      const processed = new Date(row.processed_at).getTime();
      if (!Number.isFinite(scheduled) || !Number.isFinite(processed)) return null;
      return processed - scheduled;
    })
    .filter((n) => n != null && n >= 0);
  if (!deltas.length) return null;
  const avgMs = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return Math.round(avgMs / 1000);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Missing Supabase service role configuration" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const adminClient = createClient(url, serviceRole);
  const userClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });

  const {
    data: { user: currentUser },
  } = await userClient.auth.getUser();

  if (!currentUser?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data: profile } = await fetchProfileRowWithTiers(adminClient, currentUser.id, [
    PROFILE_ROLE_ONLY_SELECT,
  ]);

  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const todayStart = startOfUtcDay();
  const last24h = hoursAgoIso(24);

  try {
    const [
      listingsRes,
      verifiedRes,
      pendingRes,
      conversationsRes,
      viewingsRes,
      notifPendingRes,
      notifFailedRes,
      eventsTodayRes,
      inquiriesRes,
      recentEventsRes,
      recentInquiriesRes,
      honeypotRes,
      captchaFailRes,
      rateListingRes,
      rateGlobalRes,
      notifLatencySec,
      recentSecurityEvents,
      inboxBacklogRes,
    ] = await Promise.all([
      adminClient.from("listings").select("id", { head: true, count: "exact" }),
      adminClient
        .from("listings")
        .select("id", { head: true, count: "exact" })
        .eq("verification_status", "verified"),
      adminClient
        .from("listings")
        .select("id", { head: true, count: "exact" })
        .eq("status", "pending"),
      adminClient
        .from("conversations")
        .select("id", { head: true, count: "exact" })
        .eq("status", "open"),
      adminClient
        .from("viewing_requests")
        .select("id", { head: true, count: "exact" })
        .in("status", ["pending", "confirmed"]),
      adminClient
        .from("notification_queue")
        .select("id", { head: true, count: "exact" })
        .eq("status", "pending"),
      adminClient
        .from("notification_queue")
        .select("id", { head: true, count: "exact" })
        .eq("status", "failed"),
      adminClient
        .from("listing_events")
        .select("id", { head: true, count: "exact" })
        .gte("occurred_at", todayStart),
      adminClient.from("listing_inquiries").select("id", { head: true, count: "exact" }),
      adminClient
        .from("listing_events")
        .select("id,listing_id,event_type,visibility,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(10),
      adminClient
        .from("listing_inquiries")
        .select("id,listing_id,inquiry_type,status,created_at,sender_name,sender_email")
        .order("created_at", { ascending: false })
        .limit(10),
      countSecurityEvents(adminClient, "honeypot_triggered", last24h),
      countSecurityEvents(adminClient, "captcha_failure", last24h),
      countSecurityEvents(adminClient, "rate_limited_listing", last24h),
      countSecurityEvents(adminClient, "rate_limited_global", last24h),
      notificationLatencySample(adminClient),
      fetchRecentSecurityEvents(adminClient, 10),
      adminClient
        .from("conversations")
        .select("id", { head: true, count: "exact" })
        .eq("status", "open")
        .lt("last_message_at", hoursAgoIso(48)),
    ]);

    const countOrZero = (r) => (r.error ? null : r.count ?? 0);

    const { data: orphanInquiries } = await adminClient
      .from("listing_inquiries")
      .select("id,conversation_id")
      .not("conversation_id", "is", null);

    const { data: conversations } = await adminClient.from("conversations").select("id");
    const convIds = new Set((conversations || []).map((c) => c.id));
    const orphanConversationRefs = (orphanInquiries || []).filter(
      (i) => i.conversation_id && !convIds.has(i.conversation_id)
    ).length;

    const { data: orphanViewings } = await adminClient
      .from("viewing_requests")
      .select("id,conversation_id")
      .not("conversation_id", "is", null);

    const orphanViewingRefs = (orphanViewings || []).filter(
      (v) => v.conversation_id && !convIds.has(v.conversation_id)
    ).length;

    const recentActivity = [
      ...(recentEventsRes.data || []).map((e) => ({
        kind: "event",
        id: e.id,
        stamp: e.occurred_at,
        label: e.event_type,
        meta: `Listing ${e.listing_id} · ${e.visibility}`,
      })),
      ...(recentInquiriesRes.data || []).map((i) => ({
        kind: "inquiry",
        id: i.id,
        stamp: i.created_at,
        label: i.inquiry_type || "inquiry",
        meta: `${i.sender_name || i.sender_email || "Guest"} · Listing ${i.listing_id}`,
      })),
    ]
      .sort((a, b) => new Date(b.stamp) - new Date(a.stamp))
      .slice(0, 10);

    return res.status(200).json({
      updated_at: new Date().toISOString(),
      metrics: {
        listings_total: countOrZero(listingsRes),
        listings_verified: countOrZero(verifiedRes),
        listings_pending_review: countOrZero(pendingRes),
        open_conversations: countOrZero(conversationsRes),
        open_viewings: countOrZero(viewingsRes),
        notification_queue_pending: countOrZero(notifPendingRes),
        notification_queue_failed: countOrZero(notifFailedRes),
        events_today: countOrZero(eventsTodayRes),
        inquiries_total: countOrZero(inquiriesRes),
        orphan_conversation_refs: orphanConversationRefs,
        orphan_viewing_refs: orphanViewingRefs,
        orphan_records: orphanConversationRefs + orphanViewingRefs,
        spam_attempts: (honeypotRes ?? 0) + (captchaFailRes ?? 0),
        blocked_inquiries: honeypotRes,
        rate_limited_requests: (rateListingRes ?? 0) + (rateGlobalRes ?? 0),
        captcha_failures: captchaFailRes,
        notification_avg_latency_sec: notifLatencySec,
        inbox_backlog_stale: countOrZero(inboxBacklogRes),
      },
      recent_security_events: recentSecurityEvents,
      recent_activity: recentActivity,
      errors: [
        listingsRes.error,
        verifiedRes.error,
        pendingRes.error,
        conversationsRes.error,
        viewingsRes.error,
        notifPendingRes.error,
        notifFailedRes.error,
      ]
        .filter(Boolean)
        .map((e) => e.message),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Health fetch failed" });
  }
}
