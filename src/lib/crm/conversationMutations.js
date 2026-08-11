import { emitListingEventAfterMutation } from "../listingEvents/writeListingEvent";
import { LISTING_EVENT_TYPES } from "../listingEvents/listingEventTypes";
import {
  enqueueNotificationEvent,
  NOTIFICATION_EVENT_TYPES,
} from "../notifications/notificationEvents";
import { triggerServerNotificationDelivery } from "../notifications/triggerServerNotificationDelivery";
import { BL_ENABLE_NOTIFICATIONS } from "../featureFlags";
import {
  CRM_PIPELINE_STAGE,
  INQUIRY_STATUS,
  MESSAGE_SENDER_ROLE,
} from "./crmConstants";
import { buildInboxMessagePayload } from "../notifications/crmNotificationHelpers";
import {
  MESSAGE_SENDER_CONTEXT,
  resolveReplySenderPresentation,
} from "../notifications/messagingNotificationCopy";
import { withNotificationRecipientRole } from "./notificationRecipientRoles";
import { isCrmUnavailable } from "./crmCompat";
import {
  fetchProfileRowWithTiers,
  PROFILE_REPLY_NOTIFICATION_TIERS,
} from "../profileSelectContract";

/** Disambiguate listing_inquiries embed (PGRST201 when multiple FKs exist). */
export const CONVERSATION_INQUIRY_EMBED =
  "listing_inquiries!conversations_inquiry_id_fkey(status,pipeline_stage,inquiry_type,message,body,read_at)";

const CONVERSATION_SELECT =
  `id,listing_id,inquiry_id,buyer_id,agent_id,buyer_email,buyer_name,buyer_phone,stage,pipeline_stage,status,last_message_at,last_message_body,last_message_role,buyer_unread,created_at,updated_at,${CONVERSATION_INQUIRY_EMBED}`;

export function conversationPreviewText(conv) {
  const preview = String(conv?.last_message_body ?? "").trim();
  if (preview) return preview;
  const inquiry = conv?.listing_inquiries;
  const row = Array.isArray(inquiry) ? inquiry[0] : inquiry;
  return row?.message || row?.body || "Conversation";
}

export function isAgentConversationUnread(conv) {
  const inquiry = conv?.listing_inquiries;
  const row = Array.isArray(inquiry) ? inquiry[0] : inquiry;
  if (row?.read_at) return false;
  if (row?.status === INQUIRY_STATUS.NEW) return true;
  return conv?.pipeline_stage === CRM_PIPELINE_STAGE.NEW_INQUIRY;
}

export function isBuyerConversationUnread(conv) {
  return Boolean(conv?.buyer_unread);
}

export async function fetchConversationsForAgent(client, agentUserId, { limit = 80, includeArchived = false } = {}) {
  let query = client
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("agent_id", agentUserId)
    .is("agent_deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (!includeArchived) {
    query = query.is("agent_archived_at", null);
  }
  return query;
}

export async function fetchConversationsForBuyer(client, buyerUserId, { limit = 50, includeArchived = false } = {}) {
  let query = client
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("buyer_id", buyerUserId)
    .is("buyer_deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (!includeArchived) {
    query = query.is("buyer_archived_at", null);
  }
  return query;
}

export async function fetchConversationMessages(client, conversationId, { limit = 100 } = {}) {
  return client
    .from("messages")
    .select("id,conversation_id,sender_id,sender_role,body,read_at,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
}

export async function markConversationReadByAgent(client, { conversationId, agentUserId }) {
  const now = new Date().toISOString();
  const { data: conv } = await client
    .from("conversations")
    .select("inquiry_id")
    .eq("id", conversationId)
    .eq("agent_id", agentUserId)
    .maybeSingle();

  if (!conv) return { error: { message: "Conversation not found" } };

  await client
    .from("messages")
    .update({ read_at: now })
    .eq("conversation_id", conversationId)
    .eq("sender_role", MESSAGE_SENDER_ROLE.BUYER)
    .is("read_at", null);

  if (conv.inquiry_id) {
    await client
      .from("listing_inquiries")
      .update({
        read_at: now,
        status: INQUIRY_STATUS.OPENED,
        updated_at: now,
      })
      .eq("id", conv.inquiry_id)
      .eq("agent_user_id", agentUserId)
      .is("read_at", null);
  }

  const { error } = await client
    .from("conversations")
    .update({ updated_at: now })
    .eq("id", conversationId)
    .eq("agent_id", agentUserId);

  return { error };
}

export async function markConversationReadByBuyer(client, { conversationId, buyerUserId }) {
  const now = new Date().toISOString();

  await client
    .from("messages")
    .update({ read_at: now })
    .eq("conversation_id", conversationId)
    .eq("sender_role", MESSAGE_SENDER_ROLE.AGENT)
    .is("read_at", null);

  const { error } = await client
    .from("conversations")
    .update({
      buyer_unread: false,
      updated_at: now,
    })
    .eq("id", conversationId)
    .eq("buyer_id", buyerUserId);

  return { error };
}

export async function sendBuyerReply(client, { conversationId, buyerUserId, body, listingId, listingTitle, senderName }) {
  const text = String(body || "").trim();
  if (!text) {
    return { data: null, error: { message: "Message body required" } };
  }

  const now = new Date().toISOString();
  const { data: message, error: msgError } = await client
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: buyerUserId,
      sender_role: MESSAGE_SENDER_ROLE.BUYER,
      body: text,
      channel: "in_app",
    })
    .select("id,created_at")
    .single();

  if (msgError) {
    if (isCrmUnavailable(msgError)) return { data: null, error: msgError, unavailable: true };
    return { data: null, error: msgError };
  }

  const { data: conv } = await client
    .from("conversations")
    .select("agent_id,listing_id,inquiry_id,buyer_name")
    .eq("id", conversationId)
    .eq("buyer_id", buyerUserId)
    .maybeSingle();

  await client
    .from("conversations")
    .update({
      last_message_at: now,
      last_message_body: text,
      last_message_role: MESSAGE_SENDER_ROLE.BUYER,
      pipeline_stage: CRM_PIPELINE_STAGE.NEW_INQUIRY,
      stage: CRM_PIPELINE_STAGE.NEW_INQUIRY,
      updated_at: now,
    })
    .eq("id", conversationId)
    .eq("buyer_id", buyerUserId);

  const resolvedListingId = listingId ?? conv?.listing_id;
  const agentUserId = conv?.agent_id;

  if (agentUserId) {
    const resolvedTitle = listingTitle ?? null;
    const resolvedSender = senderName ?? conv?.buyer_name ?? null;
    const enqueueResult = await enqueueNotificationEvent(
      client,
      {
        eventType: NOTIFICATION_EVENT_TYPES.BUYER_REPLIED,
        recipientId: agentUserId,
        payload: withNotificationRecipientRole(
          agentUserId,
          { agentUserId, listingOwnerUserId: agentUserId },
          buildInboxMessagePayload({
            conversationId,
            messageId: message?.id,
            inquiryId: conv?.inquiry_id,
            listingId: resolvedListingId,
            listingTitle: resolvedTitle,
            senderName: resolvedSender,
            recipientSide: "owner",
            recipientUserId: agentUserId,
            dedupePrefix: "buyer_replied",
          })
        ),
      },
      { deliver: false }
    );

    if (BL_ENABLE_NOTIFICATIONS && enqueueResult.queueId) {
      await triggerServerNotificationDelivery(client, { queueId: enqueueResult.queueId });
    }
  }

  if (resolvedListingId) {
    await emitListingEventAfterMutation({
      client,
      listingId: resolvedListingId,
      eventType: LISTING_EVENT_TYPES.CONVERSATION_CREATED,
      visibility: "internal",
      actorId: buyerUserId,
      actorRole: "buyer",
      payload: { conversation_id: conversationId, message_id: message?.id },
    });
  }

  return { data: message, error: null };
}

/**
 * Persist an agent reply and enqueue buyer notification (no delivery trigger).
 * @returns {Promise<{ data: object|null, error: object|null, unavailable?: boolean, queueId?: string|null }>}
 */
export async function performAgentReply(client, { conversationId, agentUserId, body, listingId, listingTitle }) {
  const text = String(body || "").trim();
  if (!text) {
    return { data: null, error: { message: "Message body required" } };
  }

  const now = new Date().toISOString();
  const { data: message, error: msgError } = await client
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: agentUserId,
      sender_role: MESSAGE_SENDER_ROLE.AGENT,
      body: text,
      channel: "in_app",
    })
    .select("id,created_at")
    .single();

  if (msgError) {
    if (isCrmUnavailable(msgError)) return { data: null, error: msgError, unavailable: true };
    return { data: null, error: msgError };
  }

  await client
    .from("conversations")
    .update({
      pipeline_stage: CRM_PIPELINE_STAGE.RESPONDED,
      stage: CRM_PIPELINE_STAGE.RESPONDED,
      last_message_at: now,
      last_message_body: text,
      last_message_role: MESSAGE_SENDER_ROLE.AGENT,
      buyer_unread: true,
      updated_at: now,
    })
    .eq("id", conversationId)
    .eq("agent_id", agentUserId);

  const { data: conv } = await client
    .from("conversations")
    .select("inquiry_id,buyer_id,listing_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conv?.inquiry_id) {
    await client
      .from("listing_inquiries")
      .update({
        status: INQUIRY_STATUS.RESPONDED,
        pipeline_stage: CRM_PIPELINE_STAGE.RESPONDED,
        responded_at: now,
        updated_at: now,
      })
      .eq("id", conv.inquiry_id);
  }

  const resolvedListingId = listingId ?? conv?.listing_id;
  let queueId = null;

  const { data: senderProfile } = await fetchProfileRowWithTiers(
    client,
    agentUserId,
    PROFILE_REPLY_NOTIFICATION_TIERS
  );

  const { senderRole, senderName } = resolveReplySenderPresentation(senderProfile);
  const replyEventType =
    senderRole === MESSAGE_SENDER_CONTEXT.ADMIN
      ? NOTIFICATION_EVENT_TYPES.ADMIN_REPLIED
      : NOTIFICATION_EVENT_TYPES.AGENT_REPLIED;
  const dedupePrefix =
    senderRole === MESSAGE_SENDER_CONTEXT.ADMIN ? "admin_replied" : "agent_replied";

  if (conv?.buyer_id) {
    const enqueueResult = await enqueueNotificationEvent(
      client,
      {
        eventType: replyEventType,
        recipientId: conv.buyer_id,
        payload: withNotificationRecipientRole(conv.buyer_id, { requesterId: conv.buyer_id }, buildInboxMessagePayload({
          conversationId,
          messageId: message?.id,
          inquiryId: conv.inquiry_id,
          listingId: resolvedListingId,
          listingTitle: listingTitle ?? null,
          senderName,
          senderRole,
          recipientSide: "buyer",
          recipientUserId: conv.buyer_id,
          dedupePrefix,
        })),
      },
      { deliver: false }
    );

    queueId = enqueueResult.queueId ?? null;
  }

  if (resolvedListingId) {
    await emitListingEventAfterMutation({
      client,
      listingId: resolvedListingId,
      eventType: LISTING_EVENT_TYPES.AGENT_RESPONDED,
      visibility: "internal",
      actorId: agentUserId,
      actorRole: "agent",
      payload: { conversation_id: conversationId, message_id: message?.id },
    });
  }

  return { data: message, error: null, queueId: queueId ?? null };
}

export async function sendAgentReply(client, { conversationId, agentUserId, body, listingId, listingTitle }) {
  if (typeof window !== "undefined") {
    const { submitAgentReplyViaApi } = await import("../security/submitAgentReplyApi");
    return submitAgentReplyViaApi(client, { conversationId, body, listingId, listingTitle });
  }

  const result = await performAgentReply(client, {
    conversationId,
    agentUserId,
    body,
    listingId,
    listingTitle,
  });

  if (result.error) {
    return { data: result.data, error: result.error, unavailable: result.unavailable };
  }

  if (BL_ENABLE_NOTIFICATIONS && result.queueId) {
    await triggerServerNotificationDelivery(client, { queueId: result.queueId });
  }

  return { data: result.data, error: null };
}

export async function archiveConversation(client, { conversationId, agentUserId }) {
  const now = new Date().toISOString();
  const { error } = await client
    .from("conversations")
    .update({
      agent_archived_at: now,
      updated_at: now,
    })
    .eq("id", conversationId)
    .eq("agent_id", agentUserId);

  return { error };
}

export async function archiveConversationForBuyer(client, { conversationId, buyerUserId }) {
  const now = new Date().toISOString();
  const { error } = await client
    .from("conversations")
    .update({
      buyer_archived_at: now,
      updated_at: now,
    })
    .eq("id", conversationId)
    .eq("buyer_id", buyerUserId);

  return { error };
}

const PARTICIPANT_DELETE_CONVERSATION_RPC = "participant_delete_conversation";

/**
 * Permanently hide a conversation from the deleting participant only.
 * Prefers secure RPC (auth.uid()); falls back to participant-bound update for tests.
 */
export async function deleteConversationForParticipant(
  client,
  { conversationId, participantUserId, asAgent }
) {
  if (!conversationId || !participantUserId) {
    return { error: { message: "conversationId and participantUserId are required" } };
  }

  if (client?.rpc) {
    const { error } = await client.rpc(PARTICIPANT_DELETE_CONVERSATION_RPC, {
      p_conversation_id: conversationId,
    });
    if (!error) return { error: null };
    if (!isCrmUnavailable(error)) return { error };
  }

  const now = new Date().toISOString();
  const patch = asAgent ? { agent_deleted_at: now } : { buyer_deleted_at: now };
  let query = client
    .from("conversations")
    .update({ ...patch, updated_at: now })
    .eq("id", conversationId);
  query = asAgent
    ? query.eq("agent_id", participantUserId)
    : query.eq("buyer_id", participantUserId);

  const { error } = await query;
  return { error };
}

export async function deleteConversationForAgent(client, { conversationId, agentUserId }) {
  return deleteConversationForParticipant(client, {
    conversationId,
    participantUserId: agentUserId,
    asAgent: true,
  });
}

export async function deleteConversationForBuyer(client, { conversationId, buyerUserId }) {
  return deleteConversationForParticipant(client, {
    conversationId,
    participantUserId: buyerUserId,
    asAgent: false,
  });
}
