import { INQUIRY_CHANNEL, INQUIRY_STATUS as LEGACY_INQUIRY_STATUS } from "../../constants/inquiryModel";
import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_NOTIFICATIONS, BL_ENABLE_TURNSTILE } from "../featureFlags";
import { submitGuestInquiryViaSecureApi } from "../security/submitGuestInquiryApi";
import { triggerNotificationDelivery } from "../notifications/notificationEvents";
import { emitListingEventAfterMutation } from "../listingEvents/writeListingEvent";
import { LISTING_EVENT_TYPES } from "../listingEvents/listingEventTypes";
import {
  CRM_PIPELINE_STAGE,
  INQUIRY_STATUS,
  INQUIRY_TYPE,
} from "./crmConstants";
import { coerceListingIdForDb, isCrmUnavailable } from "./crmCompat";
import {
  isSelfListingContact,
  selfInquiryBlockedResult,
} from "../listingSelfContact";

const RPC_CREATE = "create_inquiry_with_conversation";

function legacyChannelFromInquiryType(inquiryType) {
  if (inquiryType === INQUIRY_TYPE.SCHEDULE_VIEWING) return INQUIRY_CHANNEL.VIEWING;
  return INQUIRY_CHANNEL.CONTACT;
}

function buildLegacyInquiryRow(payload) {
  const message = String(payload.message ?? payload.body ?? "").trim();
  const inquiryType = payload.inquiryType ?? INQUIRY_TYPE.GENERAL;
  return {
    listing_id: coerceListingIdForDb(payload.listingId),
    agent_user_id: payload.agentUserId,
    listing_owner_id: payload.agentUserId,
    sender_user_id: payload.senderUserId ?? null,
    sender_id: payload.senderUserId ?? null,
    sender_name: payload.senderName ?? null,
    sender_email: payload.senderEmail ?? null,
    sender_phone: payload.senderPhone ?? null,
    channel: payload.channel ?? legacyChannelFromInquiryType(inquiryType),
    body: message,
    message,
    inquiry_type: inquiryType,
    preferred_contact_method: payload.preferredContactMethod ?? "email",
    status: INQUIRY_STATUS.NEW,
    quality_score: payload.qualityScore ?? null,
    pipeline_stage: CRM_PIPELINE_STAGE.NEW_INQUIRY,
    read_at: null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Create inquiry via RPC (conversation + first message) when conversations flag is on.
 */
export async function createInquiryWithConversation(client, payload) {
  const listingId = coerceListingIdForDb(payload.listingId);
  const message = String(payload.message ?? payload.body ?? "").trim();
  const inquiryType = payload.inquiryType ?? INQUIRY_TYPE.GENERAL;

  if (
    isSelfListingContact({
      viewerUserId: payload.senderUserId,
      recipientUserId: payload.agentUserId,
    })
  ) {
    return selfInquiryBlockedResult();
  }

  const rpcArgs = {
    p_listing_id: listingId,
    p_agent_user_id: payload.agentUserId,
    p_sender_user_id: payload.senderUserId ?? null,
    p_sender_name: payload.senderName ?? null,
    p_sender_email: payload.senderEmail ?? null,
    p_sender_phone: payload.senderPhone ?? null,
    p_inquiry_type: inquiryType,
    p_message: message,
    p_preferred_contact_method: payload.preferredContactMethod ?? "email",
    p_quality_score: payload.qualityScore ?? null,
    p_requested_date: payload.requestedDate ?? null,
    p_requested_time: payload.requestedTime ?? null,
  };

  const { data, error } = await client.rpc(RPC_CREATE, rpcArgs);
  if (error) {
    if (isCrmUnavailable(error)) {
      return { data: null, error, unavailable: true };
    }
    return { data: null, error };
  }

  const result = data && typeof data === "object" ? data : {};

  await emitListingEventAfterMutation({
    client,
    listingId,
    eventType: LISTING_EVENT_TYPES.CONVERSATION_CREATED,
    visibility: "internal",
    actorId: payload.senderUserId ?? null,
    actorRole: payload.senderUserId ? "buyer" : "guest",
    payload: {
      conversation_id: result.conversation_id,
      inquiry_id: result.inquiry_id,
      inquiry_type: inquiryType,
    },
    correlationId: result.inquiry_id,
  });

  if (BL_ENABLE_NOTIFICATIONS) {
    await triggerNotificationDelivery(client, { limit: 5 });
  }

  return {
    data: {
      id: result.inquiry_id,
      conversationId: result.conversation_id,
      messageId: result.message_id,
      viewingId: result.viewing_id,
      created_at: new Date().toISOString(),
    },
    error: null,
  };
}

/**
 * Backwards-compatible inquiry submit — prefers RPC when BL_ENABLE_CONVERSATIONS.
 */
export async function submitListingInquiry(client, payload) {
  if (BL_ENABLE_CONVERSATIONS && !payload.senderUserId) {
    return {
      data: null,
      error: { message: "authentication_required", code: "authentication_required" },
    };
  }

  if (BL_ENABLE_TURNSTILE && !payload.senderUserId) {
    return submitGuestInquiryViaSecureApi(payload);
  }

  if (BL_ENABLE_CONVERSATIONS && client?.rpc) {
    const rpcResult = await createInquiryWithConversation(client, {
      listingId: payload.listingId,
      agentUserId: payload.agentUserId,
      senderUserId: payload.senderUserId,
      senderName: payload.senderName,
      senderEmail: payload.senderEmail,
      senderPhone: payload.senderPhone,
      message: payload.body,
      inquiryType:
        payload.inquiryType ??
        (payload.channel === INQUIRY_CHANNEL.VIEWING
          ? INQUIRY_TYPE.SCHEDULE_VIEWING
          : INQUIRY_TYPE.GENERAL),
      preferredContactMethod: payload.preferredContactMethod,
      qualityScore: payload.qualityScore,
      requestedDate: payload.requestedDate,
      requestedTime: payload.requestedTime,
    });
    if (!rpcResult.unavailable) {
      return { data: rpcResult.data, error: rpcResult.error };
    }
  }

  const row = buildLegacyInquiryRow(payload);
  if (
    isSelfListingContact({
      viewerUserId: payload.senderUserId,
      recipientUserId: payload.agentUserId,
    })
  ) {
    return selfInquiryBlockedResult();
  }
  return client.from("listing_inquiries").insert(row).select("id,created_at").single();
}

export async function fetchInquiriesForAgent(client, agentUserId, { limit = 80 } = {}) {
  return client
    .from("listing_inquiries")
    .select(
      "id,listing_id,channel,body,message,inquiry_type,status,pipeline_stage,sender_name,sender_email,sender_phone,conversation_id,read_at,created_at,updated_at"
    )
    .eq("agent_user_id", agentUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function fetchInquiriesForBuyer(client, buyerUserId, { limit = 50 } = {}) {
  return client
    .from("listing_inquiries")
    .select(
      "id,listing_id,inquiry_type,status,pipeline_stage,message,body,conversation_id,created_at,updated_at"
    )
    .or(`sender_user_id.eq.${buyerUserId},sender_id.eq.${buyerUserId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function updateInquiryStatus(client, { inquiryId, agentUserId, status }) {
  const patch = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === INQUIRY_STATUS.RESPONDED || status === LEGACY_INQUIRY_STATUS.RESPONDED) {
    patch.read_at = new Date().toISOString();
    patch.responded_at = new Date().toISOString();
    patch.pipeline_stage = CRM_PIPELINE_STAGE.RESPONDED;
  }
  if (status === INQUIRY_STATUS.ARCHIVED || status === INQUIRY_STATUS.CLOSED) {
    patch.archived_at = new Date().toISOString();
    patch.pipeline_stage = CRM_PIPELINE_STAGE.ARCHIVED;
  }

  return client
    .from("listing_inquiries")
    .update(patch)
    .eq("id", inquiryId)
    .eq("agent_user_id", agentUserId);
}

export async function markInquiryRead(client, { inquiryId, agentUserId }) {
  return client
    .from("listing_inquiries")
    .update({
      read_at: new Date().toISOString(),
      status: INQUIRY_STATUS.OPENED,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiryId)
    .eq("agent_user_id", agentUserId)
    .is("read_at", null);
}
