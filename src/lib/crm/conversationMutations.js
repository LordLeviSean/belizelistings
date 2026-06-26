import { emitListingEventAfterMutation } from "../listingEvents/writeListingEvent";
import { LISTING_EVENT_TYPES } from "../listingEvents/listingEventTypes";
import { enqueueNotificationEvent, NOTIFICATION_EVENT_TYPES } from "../notifications/notificationEvents";
import {
  CRM_PIPELINE_STAGE,
  INQUIRY_STATUS,
  MESSAGE_SENDER_ROLE,
} from "./crmConstants";
import { isCrmUnavailable } from "./crmCompat";

const CONVERSATION_SELECT =
  "id,listing_id,inquiry_id,buyer_id,agent_id,buyer_email,buyer_name,buyer_phone,stage,pipeline_stage,status,last_message_at,created_at,updated_at,listing_inquiries(status,pipeline_stage,inquiry_type,message,body)";

export async function fetchConversationsForAgent(client, agentUserId, { limit = 80 } = {}) {
  return client
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("agent_id", agentUserId)
    .order("updated_at", { ascending: false })
    .limit(limit);
}

export async function fetchConversationsForBuyer(client, buyerUserId, { limit = 50 } = {}) {
  return client
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("buyer_id", buyerUserId)
    .order("updated_at", { ascending: false })
    .limit(limit);
}

export async function fetchConversationMessages(client, conversationId, { limit = 100 } = {}) {
  return client
    .from("messages")
    .select("id,conversation_id,sender_id,sender_role,body,read_at,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
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
    await enqueueNotificationEvent(client, {
      eventType: NOTIFICATION_EVENT_TYPES.AGENT_REPLIED,
      recipientId: conv.buyer_id,
      payload: { conversation_id: conversationId, message_id: message?.id },
    });
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

  return { data: message, error: null };
}

export async function archiveConversation(client, { conversationId, agentUserId }) {
  const now = new Date().toISOString();
  const { error } = await client
    .from("conversations")
    .update({
      status: "archived",
      pipeline_stage: CRM_PIPELINE_STAGE.ARCHIVED,
      stage: CRM_PIPELINE_STAGE.ARCHIVED,
      updated_at: now,
    })
    .eq("id", conversationId)
    .eq("agent_id", agentUserId);

  return { error };
}
