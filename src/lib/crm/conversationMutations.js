import { emitListingEventAfterMutation } from "../listingEvents/writeListingEvent";
import { LISTING_EVENT_TYPES } from "../listingEvents/listingEventTypes";
import {
  enqueueNotificationEvent,
  NOTIFICATION_EVENT_TYPES,
  triggerNotificationDelivery,
} from "../notifications/notificationEvents";
import { BL_ENABLE_NOTIFICATIONS } from "../featureFlags";
import {
  CRM_PIPELINE_STAGE,
  INQUIRY_STATUS,
  MESSAGE_SENDER_ROLE,
} from "./crmConstants";
import { withNotificationRecipientRole } from "./notificationRecipientRoles";
import { isCrmUnavailable } from "./crmCompat";

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

export async function sendBuyerReply(client, { conversationId, buyerUserId, body, listingId }) {
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
    .select("agent_id,listing_id,inquiry_id")
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
    await enqueueNotificationEvent(
      client,
      {
        eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
        recipientId: agentUserId,
        payload: withNotificationRecipientRole(
          agentUserId,
          { agentUserId },
          {
            conversation_id: conversationId,
            message_id: message?.id,
            inquiry_id: conv?.inquiry_id,
            listing_id: resolvedListingId,
            dedupe_key: `buyer_message:${conversationId}:${message?.id ?? now}`,
          }
        ),
      },
      { deliver: BL_ENABLE_NOTIFICATIONS }
    );
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

  if (BL_ENABLE_NOTIFICATIONS) {
    await triggerNotificationDelivery(client, { limit: 5 });
  }

  return { data: message, error: null };
}

export async function sendAgentReply(client, { conversationId, agentUserId, body, listingId }) {
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

  if (conv?.buyer_id) {
    await enqueueNotificationEvent(
      client,
      {
        eventType: NOTIFICATION_EVENT_TYPES.AGENT_REPLIED,
        recipientId: conv.buyer_id,
        payload: withNotificationRecipientRole(conv.buyer_id, { requesterId: conv.buyer_id }, {
          conversation_id: conversationId,
          message_id: message?.id,
        }),
      },
      { deliver: BL_ENABLE_NOTIFICATIONS }
    );
  }

  const resolvedListingId = listingId ?? conv?.listing_id;
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

  if (BL_ENABLE_NOTIFICATIONS) {
    await triggerNotificationDelivery(client, { limit: 5 });
  }

  return { data: message, error: null };
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
