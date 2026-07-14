import { CONVERSATION_INQUIRY_EMBED } from "./conversationMutations";
import { INQUIRY_TYPE } from "./crmConstants";
import { isViewingOnlyConversation } from "./conversationFilters";

/**
 * Find an existing Inbox thread for a viewing (non–schedule-viewing conversation).
 */
export async function findMessagingConversationForViewing(client, viewing = {}) {
  if (!client?.from || !viewing?.listing_id || !viewing?.agent_user_id) {
    return null;
  }

  if (viewing.conversation_id) {
    const { data: linked } = await client
      .from("conversations")
      .select(`id, listing_id, buyer_id, agent_id, ${CONVERSATION_INQUIRY_EMBED}`)
      .eq("id", viewing.conversation_id)
      .is("agent_deleted_at", null)
      .maybeSingle();

    if (linked && !isViewingOnlyConversation(linked)) {
      return linked;
    }
  }

  if (!viewing.requester_id) return null;

  const { data: rows } = await client
    .from("conversations")
    .select(`id, listing_id, buyer_id, agent_id, ${CONVERSATION_INQUIRY_EMBED}`)
    .eq("listing_id", viewing.listing_id)
    .eq("agent_id", viewing.agent_user_id)
    .eq("buyer_id", viewing.requester_id)
    .is("agent_deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  return (rows || []).find((conv) => !isViewingOnlyConversation(conv)) ?? null;
}

/**
 * Open an existing Inbox thread or create one only when the owner explicitly messages.
 */
export async function openMessagingConversationForViewing(client, {
  viewing,
  agentUserId,
} = {}) {
  if (!client || !viewing?.id || !agentUserId) {
    return { data: null, error: { message: "Missing viewing or agent context." } };
  }

  const existing = await findMessagingConversationForViewing(client, viewing);
  if (existing?.id) {
    return { data: { conversationId: existing.id, created: false }, error: null };
  }

  if (!viewing.requester_id) {
    return {
      data: null,
      error: { message: "This buyer has no account — contact them via email if shown on the request." },
    };
  }

  if (!client.rpc) {
    return { data: null, error: { message: "Messaging is unavailable right now." }, unavailable: true };
  }

  const { data, error } = await client.rpc("ensure_messaging_conversation", {
    p_listing_id: viewing.listing_id,
    p_agent_user_id: agentUserId,
    p_buyer_user_id: viewing.requester_id,
  });

  if (error) {
    return { data: null, error };
  }

  const result = data && typeof data === "object" ? data : {};
  const conversationId = result.conversation_id ?? result.conversationId;

  if (conversationId) {
    await client
      .from("viewing_requests")
      .update({ conversation_id: conversationId, updated_at: new Date().toISOString() })
      .eq("id", viewing.id)
      .eq("agent_user_id", agentUserId);
  }

  return {
    data: { conversationId, created: Boolean(result.created) },
    error: null,
  };
}
