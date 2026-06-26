import { sanitizeListingMutationPayload } from "./listingPayloadSanitize";
import { LISTING_MUTATION_FLOW } from "./listingMutationDiagnostics";
import { VERIFICATION_STATUS } from "../constants/trustModel";
import { BL_ENABLE_LISTING_EVENTS } from "./featureFlags";
import { coerceListingIdForDb } from "./listingEvents/coerceListingId";
import {
  buildVerificationApprovedPayload,
  buildVerificationRemovedPayload,
  emitListingEventAfterMutation,
  LISTING_EVENT_SOURCES,
  LISTING_EVENT_TYPES,
} from "./listingEvents";

const RPC_VERIFY_WITH_EVENT = "apply_listing_verification_with_event";

/**
 * Build a listings PATCH payload for admin verify / unverify only.
 * @param {{ verified: boolean, adminUserId: string }} params
 */
export function buildListingVerificationPatch({ verified, adminUserId }) {
  if (verified) {
    return {
      verification_status: VERIFICATION_STATUS.VERIFIED,
      verified_at: new Date().toISOString(),
      verified_by: adminUserId,
    };
  }
  return {
    verification_status: VERIFICATION_STATUS.UNVERIFIED,
    verified_at: null,
    verified_by: null,
  };
}

async function emitVerificationEvent({
  client,
  listingId,
  verified,
  adminUserId,
  previousListing,
  patchResult,
}) {
  const actorRole = "admin";
  const source = LISTING_EVENT_SOURCES.ADMIN;

  if (verified) {
    return emitListingEventAfterMutation({
      client,
      listingId,
      eventType: LISTING_EVENT_TYPES.VERIFICATION_APPROVED,
      visibility: "public",
      payload: buildVerificationApprovedPayload({
        verifiedAt: patchResult?.verified_at,
        verifiedBy: patchResult?.verified_by,
        adminUserId,
      }),
      actorId: adminUserId,
      actorRole,
      source,
    });
  }

  return emitListingEventAfterMutation({
    client,
    listingId,
    eventType: LISTING_EVENT_TYPES.VERIFICATION_REMOVED,
    visibility: "internal",
    payload: buildVerificationRemovedPayload({
      previousVerifiedAt: previousListing?.verified_at,
      previousVerifiedBy: previousListing?.verified_by,
    }),
    actorId: adminUserId,
    actorRole,
    source,
  });
}

/**
 * Admin-only: update listing.verification_status + metadata via Supabase.
 * When BL_ENABLE_LISTING_EVENTS and RPC exist, uses atomic apply_listing_verification_with_event.
 * @returns {Promise<{ ok: boolean, data?: object, error?: object, eventEmitted?: boolean }>}
 */
export async function applyListingVerificationAction({
  listingId,
  verified,
  adminUserId,
  client,
}) {
  const id = String(listingId || "").trim();
  const actorId = String(adminUserId || "").trim();
  if (!id || !actorId) {
    return { ok: false, error: { message: "Missing listing or admin id" } };
  }
  if (!client?.from) {
    return { ok: false, error: { message: "Missing Supabase client" } };
  }

  if (BL_ENABLE_LISTING_EVENTS && client.rpc) {
    const { data, error } = await client.rpc(RPC_VERIFY_WITH_EVENT, {
      p_listing_id: coerceListingIdForDb(id),
      p_verified: Boolean(verified),
      p_admin_user_id: actorId,
    });

    if (!error && data) {
      const row = typeof data === "object" ? data : {};
      return {
        ok: true,
        data: {
          id: row.id ?? id,
          verification_status: row.verification_status,
          verified_at: row.verified_at,
          verified_by: row.verified_by,
        },
        eventEmitted: Boolean(row.event_id),
      };
    }

    const rpcUnavailable =
      error &&
      /apply_listing_verification_with_event|listing_events|could not find the function/i.test(
        String(error.message || "")
      );

    if (!rpcUnavailable) {
      return { ok: false, error };
    }
  }

  let previousListing = null;
  if (!verified) {
    const { data: prior } = await client
      .from("listings")
      .select("verified_at, verified_by")
      .eq("id", id)
      .maybeSingle();
    previousListing = prior || null;
  }

  const payload = sanitizeListingMutationPayload(
    buildListingVerificationPatch({ verified: Boolean(verified), adminUserId: actorId }),
    { mutationFlow: LISTING_MUTATION_FLOW.UNSPECIFIED, operation: "PATCH" }
  );

  const { data, error } = await client
    .from("listings")
    .update(payload)
    .eq("id", id)
    .select("id, verification_status, verified_at, verified_by")
    .maybeSingle();

  if (error) {
    return { ok: false, error };
  }

  const eventResult = await emitVerificationEvent({
    client,
    listingId: id,
    verified: Boolean(verified),
    adminUserId: actorId,
    previousListing,
    patchResult: data,
  });

  return {
    ok: true,
    data,
    eventEmitted: eventResult.ok && !eventResult.skipped,
  };
}
