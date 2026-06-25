import { BL_ENABLE_LISTING_EVENTS } from "../featureFlags";
import { isMissingColumnError, isMissingRelationshipError, isMissingTableError } from "../supabaseCompat";
import { LISTING_EVENT_SOURCES } from "./listingEventTypes";

const RPC_APPEND = "append_listing_event";

function isListingEventsUnavailable(error) {
  if (!error) return false;
  if (isMissingRelationshipError(error)) return true;
  if (isMissingTableError(error)) return true;
  if (isMissingColumnError(error)) return true;
  const msg = String(error.message || "").toLowerCase();
  return (
    msg.includes("append_listing_event") ||
    msg.includes("listing_events") ||
    msg.includes("could not find the function")
  );
}

/**
 * Single entry point for appending listing_events rows via Supabase RPC.
 *
 * @param {object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.client
 * @param {string} params.listingId
 * @param {string} params.eventType
 * @param {object} [params.payload]
 * @param {'public'|'internal'} [params.visibility]
 * @param {string} [params.actorId]
 * @param {string} [params.actorRole]
 * @param {string} [params.source]
 * @param {string} [params.correlationId]
 * @param {string} [params.occurredAt] ISO timestamp
 * @param {boolean} [params.force] bypass feature flag (backfill scripts)
 * @returns {Promise<{ ok: boolean, eventId?: string, skipped?: boolean, error?: object }>}
 */
export async function writeListingEvent({
  client,
  listingId,
  eventType,
  payload = {},
  visibility = "public",
  actorId = null,
  actorRole = null,
  source = LISTING_EVENT_SOURCES.APP,
  correlationId = null,
  occurredAt = null,
  force = false,
}) {
  const id = String(listingId || "").trim();
  const type = String(eventType || "").trim();

  if (!id || !type) {
    return { ok: false, error: { message: "Missing listingId or eventType" } };
  }
  if (!client?.rpc) {
    return { ok: false, error: { message: "Missing Supabase client" } };
  }
  if (!force && !BL_ENABLE_LISTING_EVENTS) {
    return { ok: true, skipped: true };
  }

  const rpcArgs = {
    p_listing_id: id,
    p_event_type: type,
    p_visibility: visibility,
    p_payload: payload,
    p_actor_id: actorId || null,
    p_actor_role: actorRole || null,
    p_source: source,
    p_correlation_id: correlationId || null,
    p_occurred_at: occurredAt || null,
  };

  const { data, error } = await client.rpc(RPC_APPEND, rpcArgs);

  if (error) {
    if (isListingEventsUnavailable(error)) {
      return { ok: true, skipped: true, error };
    }
    return { ok: false, error };
  }

  return { ok: true, eventId: data ? String(data) : undefined };
}

/**
 * Emit event after a successful listing mutation without failing the parent flow.
 */
export async function emitListingEventAfterMutation(params) {
  const result = await writeListingEvent(params);
  if (!result.ok && !result.skipped && typeof console !== "undefined") {
    console.warn("[listing-events] append failed after mutation", {
      listingId: params.listingId,
      eventType: params.eventType,
      message: result.error?.message,
    });
  }
  return result;
}
