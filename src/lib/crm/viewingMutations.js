import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_VIEWING_PERSIST } from "../featureFlags";
import { emitListingEventAfterMutation } from "../listingEvents/writeListingEvent";
import { LISTING_EVENT_TYPES } from "../listingEvents/listingEventTypes";
import { enqueueNotificationEvent, NOTIFICATION_EVENT_TYPES } from "../notifications/notificationEvents";
import { CRM_PIPELINE_STAGE, INQUIRY_TYPE, VIEWING_STATUS } from "./crmConstants";
import { coerceListingIdForDb, isCrmUnavailable } from "./crmCompat";
import { createInquiryWithConversation } from "./inquiryMutations";

export async function createViewingRequest(client, payload) {
  const listingId = coerceListingIdForDb(payload.listingId);
  const requestedDate = payload.requestedDate;
  const requestedTime = payload.requestedTime;

  if (!listingId || !requestedDate || !requestedTime) {
    return { data: null, error: { message: "listingId, requestedDate, and requestedTime are required" } };
  }

  if (BL_ENABLE_VIEWING_PERSIST && BL_ENABLE_CONVERSATIONS && client?.rpc) {
    const message =
      payload.message ??
      payload.notes ??
      `Viewing requested for ${requestedDate} at ${requestedTime}.`;
    const rpcResult = await createInquiryWithConversation(client, {
      listingId,
      agentUserId: payload.agentUserId,
      senderUserId: payload.requesterId ?? null,
      senderName: payload.requesterName ?? null,
      senderEmail: payload.requesterEmail ?? null,
      senderPhone: payload.requesterPhone ?? null,
      inquiryType: INQUIRY_TYPE.SCHEDULE_VIEWING,
      message,
      preferredContactMethod: payload.preferredContactMethod ?? "email",
      requestedDate,
      requestedTime,
    });
    if (!rpcResult.unavailable) {
      return {
        data: {
          id: rpcResult.data?.viewingId,
          conversationId: rpcResult.data?.conversationId,
          inquiryId: rpcResult.data?.id,
        },
        error: rpcResult.error,
      };
    }
  }

  const row = {
    listing_id: listingId,
    conversation_id: payload.conversationId ?? null,
    requester_id: payload.requesterId ?? null,
    requester_email: payload.requesterEmail ?? null,
    requester_name: payload.requesterName ?? null,
    agent_user_id: payload.agentUserId,
    requested_date: requestedDate,
    requested_time: requestedTime,
    timezone: payload.timezone ?? "America/Belize",
    status: VIEWING_STATUS.PENDING,
    notes: payload.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("viewing_requests").insert(row).select("id,created_at").single();
  if (error && isCrmUnavailable(error)) {
    return { data: null, error, unavailable: true };
  }
  return { data, error };
}

export async function confirmViewing(client, { viewingId, agentUserId, notes }) {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("viewing_requests")
    .update({
      status: VIEWING_STATUS.CONFIRMED,
      confirmed_by: agentUserId,
      confirmed_at: now,
      notes: notes ?? null,
      updated_at: now,
    })
    .eq("id", viewingId)
    .eq("agent_user_id", agentUserId)
    .select("id,listing_id,conversation_id,requester_id,requested_date,requested_time")
    .single();

  if (error) return { data: null, error };

  if (data?.conversation_id) {
    await client
      .from("conversations")
      .update({
        pipeline_stage: CRM_PIPELINE_STAGE.VIEWING_SCHEDULED,
        stage: CRM_PIPELINE_STAGE.VIEWING_SCHEDULED,
        updated_at: now,
      })
      .eq("id", data.conversation_id);
  }

  if (data?.requester_id) {
    await enqueueNotificationEvent(client, {
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
      recipientId: data.requester_id,
      payload: {
        viewing_id: viewingId,
        listing_id: data.listing_id,
        requested_date: data.requested_date,
        requested_time: data.requested_time,
      },
    });
  }

  if (data?.listing_id) {
    await emitListingEventAfterMutation({
      client,
      listingId: data.listing_id,
      eventType: LISTING_EVENT_TYPES.VIEWING_SCHEDULED,
      visibility: "public",
      actorId: agentUserId,
      actorRole: "agent",
      payload: {
        viewing_id: viewingId,
        requested_date: data.requested_date,
        requested_time: String(data.requested_time || ""),
      },
    });
  }

  return { data, error: null };
}

export async function cancelViewing(client, { viewingId, agentUserId, cancelledByAgent = true }) {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("viewing_requests")
    .update({
      status: VIEWING_STATUS.CANCELLED,
      updated_at: now,
    })
    .eq("id", viewingId)
    .eq(cancelledByAgent ? "agent_user_id" : "requester_id", agentUserId)
    .select("id,listing_id")
    .single();

  if (error) return { data: null, error };

  if (data?.listing_id) {
    await emitListingEventAfterMutation({
      client,
      listingId: data.listing_id,
      eventType: LISTING_EVENT_TYPES.VIEWING_CANCELLED,
      visibility: "internal",
      actorId: agentUserId,
      actorRole: cancelledByAgent ? "agent" : "buyer",
      payload: { viewing_id: viewingId },
    });
  }

  return { data, error: null };
}

export async function fetchViewingsForAgent(client, agentUserId, { limit = 50 } = {}) {
  return client
    .from("viewing_requests")
    .select(
      "id,listing_id,conversation_id,requester_id,requester_email,requester_name,requested_date,requested_time,status,notes,confirmed_at,created_at"
    )
    .eq("agent_user_id", agentUserId)
    .order("requested_date", { ascending: true })
    .limit(limit);
}

export async function fetchViewingsForBuyer(client, buyerUserId, { limit = 50 } = {}) {
  return client
    .from("viewing_requests")
    .select(
      "id,listing_id,conversation_id,requested_date,requested_time,status,notes,confirmed_at,created_at"
    )
    .eq("requester_id", buyerUserId)
    .order("requested_date", { ascending: false })
    .limit(limit);
}
