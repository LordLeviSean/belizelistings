import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_NOTIFICATIONS, BL_ENABLE_VIEWING_PERSIST } from "../featureFlags";
import { triggerNotificationDelivery } from "../notifications/notificationEvents";
import { emitListingEventAfterMutation } from "../listingEvents/writeListingEvent";
import { LISTING_EVENT_TYPES } from "../listingEvents/listingEventTypes";
import { enqueueNotificationEvent, NOTIFICATION_EVENT_TYPES } from "../notifications/notificationEvents";
import { CRM_PIPELINE_STAGE, INQUIRY_TYPE, VIEWING_STATUS } from "./crmConstants";
import { coerceListingIdForDb, isCrmUnavailable } from "./crmCompat";
import { createInquiryWithConversation } from "./inquiryMutations";
import { withNotificationRecipientRole } from "./notificationRecipientRoles";
import {
  appendViewingSystemMessage,
  formatViewingSlotLabel,
  VIEWING_SYSTEM_MESSAGE,
} from "./viewingConversationMessages";

const VIEWING_SELECT =
  "id,listing_id,conversation_id,requester_id,requester_email,requester_name,agent_user_id,requested_date,requested_time,proposed_date,proposed_time,proposed_by,status,notes,message,confirmed_at,created_at,updated_at";

async function notifyViewingEvent(client, { eventType, recipientId, payload, parties = {} }) {
  const enrichedPayload = withNotificationRecipientRole(recipientId, parties, payload);
  await enqueueNotificationEvent(
    client,
    { eventType, recipientId, payload: enrichedPayload },
    { deliver: BL_ENABLE_NOTIFICATIONS }
  );
  if (BL_ENABLE_NOTIFICATIONS) {
    await triggerNotificationDelivery(client, { limit: 5 });
  }
}

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
      const viewingId = rpcResult.data?.viewingId;
      return {
        data: {
          id: viewingId,
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
    message: payload.message ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("viewing_requests").insert(row).select("id,created_at").single();
  if (error && isCrmUnavailable(error)) {
    return { data: null, error, unavailable: true };
  }
  if (!error && data?.id && payload.agentUserId) {
    await notifyViewingEvent(client, {
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED,
      recipientId: payload.agentUserId,
      parties: { agentUserId: payload.agentUserId, listingOwnerUserId: payload.agentUserId },
      payload: {
        viewing_id: data.id,
        listing_id: listingId,
        requested_date: requestedDate,
        requested_time: requestedTime,
      },
    });
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
      proposed_date: null,
      proposed_time: null,
      proposed_by: null,
      updated_at: now,
    })
    .eq("id", viewingId)
    .eq("agent_user_id", agentUserId)
    .select(VIEWING_SELECT)
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

    const slot = formatViewingSlotLabel(data.requested_date, data.requested_time);
    await appendViewingSystemMessage(client, {
      conversationId: data.conversation_id,
      body: VIEWING_SYSTEM_MESSAGE.CONFIRMED(slot),
      dedupeKey: `viewing_confirmed:${viewingId}`,
    });
  }

  if (data?.requester_id) {
    await notifyViewingEvent(client, {
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
      recipientId: data.requester_id,
      parties: { agentUserId: data.agent_user_id, listingOwnerUserId: data.agent_user_id, requesterId: data.requester_id },
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

export async function declineViewing(client, { viewingId, agentUserId, notes }) {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("viewing_requests")
    .update({
      status: VIEWING_STATUS.DECLINED,
      notes: notes ?? null,
      updated_at: now,
    })
    .eq("id", viewingId)
    .eq("agent_user_id", agentUserId)
    .select(VIEWING_SELECT)
    .single();

  if (error) return { data: null, error };

  if (data?.conversation_id) {
    await appendViewingSystemMessage(client, {
      conversationId: data.conversation_id,
      body: VIEWING_SYSTEM_MESSAGE.DECLINED,
      dedupeKey: `viewing_declined:${viewingId}`,
    });
  }

  if (data?.requester_id) {
    await notifyViewingEvent(client, {
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED,
      recipientId: data.requester_id,
      parties: { agentUserId: data.agent_user_id, listingOwnerUserId: data.agent_user_id, requesterId: data.requester_id },
      payload: { viewing_id: viewingId, listing_id: data.listing_id },
    });
  }

  return { data, error: null };
}

export async function proposeViewingReschedule(client, {
  viewingId,
  actorUserId,
  asAgent,
  proposedDate,
  proposedTime,
  notes,
}) {
  const now = new Date().toISOString();
  const patch = {
    status: VIEWING_STATUS.RESCHEDULED,
    proposed_date: proposedDate,
    proposed_time: proposedTime,
    proposed_by: asAgent ? "agent" : "buyer",
    notes: notes ?? null,
    updated_at: now,
  };

  let query = client.from("viewing_requests").update(patch).eq("id", viewingId);
  query = asAgent ? query.eq("agent_user_id", actorUserId) : query.eq("requester_id", actorUserId);

  const { data, error } = await query.select(VIEWING_SELECT).single();
  if (error) return { data: null, error };

  if (data?.conversation_id) {
    const slot = formatViewingSlotLabel(proposedDate, proposedTime);
    await appendViewingSystemMessage(client, {
      conversationId: data.conversation_id,
      body: VIEWING_SYSTEM_MESSAGE.RESCHEDULE_PROPOSED(slot),
      dedupeKey: `viewing_reschedule:${viewingId}:${proposedDate}:${proposedTime}`,
    });
  }

  const recipientId = asAgent ? data?.requester_id : data?.agent_user_id;
  if (recipientId) {
    await notifyViewingEvent(client, {
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_RESCHEDULED,
      recipientId,
      parties: { agentUserId: data?.agent_user_id, listingOwnerUserId: data?.agent_user_id, requesterId: data?.requester_id },
      payload: {
        viewing_id: viewingId,
        listing_id: data.listing_id,
        proposed_date: proposedDate,
        proposed_time: proposedTime,
        proposed_by: asAgent ? "agent" : "buyer",
      },
    });
  }

  return { data, error: null };
}

export async function acceptViewingReschedule(client, { viewingId, actorUserId, asAgent = true }) {
  const expectedProposer = asAgent ? "buyer" : "agent";

  let fetchQuery = client.from("viewing_requests").select(VIEWING_SELECT).eq("id", viewingId);
  fetchQuery = asAgent
    ? fetchQuery.eq("agent_user_id", actorUserId)
    : fetchQuery.eq("requester_id", actorUserId);

  const { data: current, error: fetchError } = await fetchQuery.maybeSingle();

  if (fetchError || !current) {
    return { data: null, error: fetchError || { message: "Viewing not found" } };
  }
  if (!current.proposed_date || !current.proposed_time) {
    return { data: null, error: { message: "No proposed time to accept" } };
  }
  if (current.proposed_by && current.proposed_by !== expectedProposer) {
    return { data: null, error: { message: "No proposal from the other party to accept" } };
  }

  const now = new Date().toISOString();
  let updateQuery = client
    .from("viewing_requests")
    .update({
      requested_date: current.proposed_date,
      requested_time: current.proposed_time,
      proposed_date: null,
      proposed_time: null,
      proposed_by: null,
      status: VIEWING_STATUS.CONFIRMED,
      confirmed_by: asAgent ? actorUserId : current.agent_user_id,
      confirmed_at: now,
      updated_at: now,
    })
    .eq("id", viewingId);
  updateQuery = asAgent
    ? updateQuery.eq("agent_user_id", actorUserId)
    : updateQuery.eq("requester_id", actorUserId);

  const { data, error } = await updateQuery.select(VIEWING_SELECT).single();

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

    const slot = formatViewingSlotLabel(data.requested_date, data.requested_time);
    await appendViewingSystemMessage(client, {
      conversationId: data.conversation_id,
      body: VIEWING_SYSTEM_MESSAGE.RESCHEDULE_ACCEPTED(slot),
      dedupeKey: `viewing_reschedule_accepted:${viewingId}`,
    });
  }

  const notifyRecipientId = asAgent ? data?.requester_id : data?.agent_user_id;
  if (notifyRecipientId) {
    await notifyViewingEvent(client, {
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
      recipientId: notifyRecipientId,
      parties: { agentUserId: data.agent_user_id, listingOwnerUserId: data.agent_user_id, requesterId: data.requester_id },
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
      actorId: actorUserId,
      actorRole: asAgent ? "agent" : "buyer",
      payload: {
        viewing_id: viewingId,
        requested_date: data.requested_date,
        requested_time: String(data.requested_time || ""),
      },
    });
  }

  return { data, error: null };
}

export async function markViewingCompleted(client, { viewingId, agentUserId }) {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("viewing_requests")
    .update({
      status: VIEWING_STATUS.COMPLETED,
      updated_at: now,
    })
    .eq("id", viewingId)
    .eq("agent_user_id", agentUserId)
    .select(VIEWING_SELECT)
    .single();

  return { data, error };
}

export async function cancelViewing(client, { viewingId, actorUserId, cancelledByAgent = true }) {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("viewing_requests")
    .update({
      status: VIEWING_STATUS.CANCELLED,
      updated_at: now,
    })
    .eq("id", viewingId)
    .eq(cancelledByAgent ? "agent_user_id" : "requester_id", actorUserId)
    .select(VIEWING_SELECT)
    .single();

  if (error) return { data: null, error };

  if (data?.conversation_id) {
    await appendViewingSystemMessage(client, {
      conversationId: data.conversation_id,
      body: VIEWING_SYSTEM_MESSAGE.CANCELLED,
      dedupeKey: `viewing_cancelled:${viewingId}`,
    });
  }

  const notifyRecipientId = cancelledByAgent ? data?.requester_id : data?.agent_user_id;
  if (notifyRecipientId) {
    await notifyViewingEvent(client, {
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CANCELLED,
      recipientId: notifyRecipientId,
      parties: { agentUserId: data.agent_user_id, listingOwnerUserId: data.agent_user_id, requesterId: data.requester_id },
      payload: { viewing_id: viewingId, listing_id: data.listing_id },
    });
  }

  if (data?.listing_id) {
    await emitListingEventAfterMutation({
      client,
      listingId: data.listing_id,
      eventType: LISTING_EVENT_TYPES.VIEWING_CANCELLED,
      visibility: "internal",
      actorId: actorUserId,
      actorRole: cancelledByAgent ? "agent" : "buyer",
      payload: { viewing_id: viewingId },
    });
  }

  return { data, error: null };
}

export async function archiveViewing(client, { viewingId, userId, asAgent }) {
  const now = new Date().toISOString();
  const patch = asAgent ? { agent_archived_at: now } : { requester_archived_at: now };
  let query = client.from("viewing_requests").update({ ...patch, updated_at: now }).eq("id", viewingId);
  query = asAgent ? query.eq("agent_user_id", userId) : query.eq("requester_id", userId);
  const { data, error } = await query.select("id").single();
  return { data, error };
}

const PARTICIPANT_DELETE_VIEWING_RPC = "participant_delete_viewing";

/**
 * Permanently hide a viewing from the deleting participant only.
 * Prefers secure RPC (auth.uid()); falls back to participant-bound update for tests.
 */
export async function deleteViewing(client, { viewingId, userId, asAgent }) {
  if (!viewingId || !userId) {
    return { error: { message: "viewingId and userId are required" } };
  }

  if (client?.rpc) {
    const { error } = await client.rpc(PARTICIPANT_DELETE_VIEWING_RPC, {
      p_viewing_id: viewingId,
    });
    if (!error) return { error: null };
    if (!isCrmUnavailable(error)) return { error };
  }

  const now = new Date().toISOString();
  const patch = asAgent ? { agent_deleted_at: now } : { requester_deleted_at: now };
  let query = client.from("viewing_requests").update({ ...patch, updated_at: now }).eq("id", viewingId);
  query = asAgent ? query.eq("agent_user_id", userId) : query.eq("requester_id", userId);
  const { data, error } = await query.select("id").single();
  return { data, error };
}

export async function fetchViewingsForAgent(client, agentUserId, { limit = 50, includeArchived = false } = {}) {
  let query = client
    .from("viewing_requests")
    .select(VIEWING_SELECT)
    .eq("agent_user_id", agentUserId)
    .is("agent_deleted_at", null)
    .order("requested_date", { ascending: true })
    .limit(limit);
  if (!includeArchived) {
    query = query.is("agent_archived_at", null);
  }
  return query;
}

export async function fetchViewingsForBuyer(client, buyerUserId, { limit = 50, includeArchived = false } = {}) {
  let query = client
    .from("viewing_requests")
    .select(VIEWING_SELECT)
    .eq("requester_id", buyerUserId)
    .is("requester_deleted_at", null)
    .order("requested_date", { ascending: false })
    .limit(limit);
  if (!includeArchived) {
    query = query.is("requester_archived_at", null);
  }
  return query;
}
