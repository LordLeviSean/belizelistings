import { createClient } from "@supabase/supabase-js";
import { readTruthyEnvValue } from "@/lib/featureFlags";
import { performCreateViewingRequest } from "@/lib/crm/viewingMutations";
import { deliverNotificationQueueItemWithPush } from "@/lib/notifications/deliverNotificationsServer";
import { resolveListingAgentUserIdAsync } from "@/lib/listingInquiryTargets";
import { isSelfListingContact } from "@/lib/listingSelfContact";

function isPublishedListing(listing) {
  if (!listing) return false;
  const statuses = [
    listing.status,
    listing.lifecycle_status,
    listing.moderation_status,
  ].map((s) => String(s || "").toLowerCase());
  return statuses.some((s) => s === "approved" || s === "published");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const BL_ENABLE_NOTIFICATIONS = readTruthyEnvValue(
    process.env.NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS
  );

  if (!url || !serviceRole || !anonKey) {
    return res.status(503).json({ error: "Viewing request API is not configured." });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return res.status(401).json({ error: "Unauthorized", code: "authentication_required" });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user?.id) {
    return res.status(401).json({ error: "Unauthorized", code: "authentication_required" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const listingId = body.listingId ?? body.listing_id ?? null;
  const requestedDate = String(body.requestedDate ?? body.requested_date ?? "").trim();
  const requestedTime = String(body.requestedTime ?? body.requested_time ?? "").trim();

  if (!listingId) {
    return res.status(400).json({ code: "validation_error", error: "listingId is required." });
  }

  if (!requestedDate || !requestedTime) {
    return res.status(400).json({
      code: "validation_error",
      error: "requestedDate and requestedTime are required.",
    });
  }

  const adminClient = createClient(url, serviceRole);
  const { data: listing, error: listingError } = await adminClient
    .from("listings")
    .select("id,user_id,title,status,lifecycle_status,moderation_status")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing || !isPublishedListing(listing)) {
    return res.status(404).json({ code: "listing_unavailable", error: "Listing is not available." });
  }

  const agentUserId = await resolveListingAgentUserIdAsync(adminClient, listing);
  if (!agentUserId) {
    return res.status(404).json({ code: "listing_unavailable", error: "Listing contact not found." });
  }

  if (
    isSelfListingContact({
      viewerUserId: user.id,
      recipientUserId: agentUserId,
    })
  ) {
    return res.status(403).json({
      code: "self_viewing_not_allowed",
      error: "You can't schedule a viewing on your own listing.",
    });
  }

  const result = await performCreateViewingRequest(adminClient, {
    listingId: listing.id,
    agentUserId,
    requesterId: user.id,
    requesterEmail: body.requesterEmail ?? body.requester_email ?? user.email ?? null,
    requesterName:
      body.requesterName ??
      body.requester_name ??
      user.user_metadata?.full_name ??
      null,
    requestedDate,
    requestedTime,
    listingTitle: body.listingTitle ?? body.listing_title ?? listing.title ?? null,
    message: body.message ?? null,
    notes: body.notes ?? null,
    timezone: body.timezone ?? "America/Belize",
  });

  if (result.error) {
    const message = result.error.message || "Could not schedule viewing.";
    const status = result.unavailable ? 503 : 400;
    return res.status(status).json({ code: "viewing_request_failed", error: message });
  }

  if (BL_ENABLE_NOTIFICATIONS && result.queueId) {
    await deliverNotificationQueueItemWithPush(adminClient, result.queueId);
  }

  return res.status(200).json({
    ok: true,
    data: {
      id: result.data?.id ?? null,
      created_at: result.data?.created_at ?? null,
      queueId: result.queueId ?? null,
    },
  });
}
