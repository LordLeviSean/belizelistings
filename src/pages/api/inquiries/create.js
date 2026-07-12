import { createClient } from "@supabase/supabase-js";
import { readTruthyEnvValue } from "../../../lib/featureFlags";
import { mapInquiryRpcError } from "../../../lib/security/mapInquiryRpcError";
import { logSecurityEvent } from "../../../lib/security/logSecurityEvent";
import { verifyTurnstileToken } from "../../../lib/security/verifyTurnstile";
import { triggerNotificationDelivery } from "../../../lib/notifications/notificationEvents";
import { emitListingEventAfterMutation } from "../../../lib/listingEvents/writeListingEvent";
import { LISTING_EVENT_TYPES } from "../../../lib/listingEvents/listingEventTypes";
import { INQUIRY_TYPE } from "../../../lib/crm/crmConstants";
import { coerceListingIdForDb } from "../../../lib/crm/crmCompat";

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? null;
}

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const BL_ENABLE_TURNSTILE = readTruthyEnvValue(process.env.NEXT_PUBLIC_BL_ENABLE_TURNSTILE);
  const BL_ENABLE_NOTIFICATIONS = readTruthyEnvValue(process.env.NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!url || !serviceRole) {
    return res.status(503).json({ error: "Inquiry API is not configured." });
  }

  const adminClient = createClient(url, serviceRole);
  const ip = clientIp(req);
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const honeypot = String(body.company_website ?? "").trim();
  if (honeypot) {
    await logSecurityEvent(adminClient, {
      eventType: "honeypot_triggered",
      listingId: body.listingId,
      senderEmail: body.senderEmail,
      ipAddress: ip,
      metadata: { field: "company_website" },
    });
    return res.status(400).json({ code: "spam_detected", error: "Could not submit inquiry." });
  }

  const listingId = coerceListingIdForDb(body.listingId);
  const message = String(body.message ?? "").trim();
  const inquiryType = body.inquiryType ?? INQUIRY_TYPE.GENERAL;

  if (!listingId) {
    return res.status(400).json({ code: "validation_error", error: "listingId is required." });
  }

  if (!message && inquiryType !== INQUIRY_TYPE.SCHEDULE_VIEWING) {
    return res.status(400).json({ code: "validation_error", error: "message is required." });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  let senderUserId = null;

  if (token && anonKey) {
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    senderUserId = user?.id ?? null;
  }

  const senderEmail = String(body.senderEmail ?? "").trim() || null;
  const senderName = body.senderName ?? null;
  const senderPhone = body.senderPhone ?? null;

  if (!senderUserId) {
    return res.status(401).json({
      code: "authentication_required",
      error: "Sign in to contact this listing.",
    });
  }

  const { data: listing, error: listingErr } = await adminClient
    .from("listings")
    .select("id,user_id,status,lifecycle_status,moderation_status")
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr || !listing || !isPublishedListing(listing)) {
    return res.status(404).json({ code: "listing_unavailable", error: "Listing is not available." });
  }

  const agentUserId = listing.user_id;
  if (!agentUserId) {
    return res.status(404).json({ code: "listing_unavailable", error: "Listing agent not found." });
  }

  const rpcArgs = {
    p_listing_id: listingId,
    p_agent_user_id: agentUserId,
    p_sender_user_id: senderUserId,
    p_sender_name: senderName,
    p_sender_email: senderEmail,
    p_sender_phone: senderPhone,
    p_inquiry_type: inquiryType,
    p_message: message,
    p_preferred_contact_method: body.preferredContactMethod ?? "email",
    p_quality_score: body.qualityScore ?? null,
    p_requested_date: body.requestedDate ?? null,
    p_requested_time: body.requestedTime ?? null,
  };

  const { data, error } = await adminClient.rpc("create_inquiry_with_conversation", rpcArgs);

  if (error) {
    const mapped = mapInquiryRpcError(error);
    if (mapped.code === "rate_limited_listing" || mapped.code === "rate_limited_global") {
      await logSecurityEvent(adminClient, {
        eventType: mapped.code,
        listingId,
        senderEmail,
        ipAddress: ip,
      });
    }
    return res.status(mapped.status).json({ code: mapped.code, error: mapped.message });
  }

  const result = data && typeof data === "object" ? data : {};

  await emitListingEventAfterMutation({
    client: adminClient,
    listingId,
    eventType: LISTING_EVENT_TYPES.CONVERSATION_CREATED,
    visibility: "internal",
    actorId: senderUserId,
    actorRole: senderUserId ? "buyer" : "guest",
    payload: {
      conversation_id: result.conversation_id,
      inquiry_id: result.inquiry_id,
      inquiry_type: inquiryType,
    },
    correlationId: result.inquiry_id,
  });

  if (BL_ENABLE_NOTIFICATIONS) {
    await triggerNotificationDelivery(adminClient, { limit: 5 });
  }

  return res.status(200).json({
    ok: true,
    data: {
      id: result.inquiry_id,
      conversationId: result.conversation_id,
      messageId: result.message_id,
      viewingId: result.viewing_id,
      created_at: new Date().toISOString(),
    },
  });
}
