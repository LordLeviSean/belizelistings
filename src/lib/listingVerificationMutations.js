import { sanitizeListingMutationPayload } from "./listingPayloadSanitize";
import { LISTING_MUTATION_FLOW } from "./listingMutationDiagnostics";
import { VERIFICATION_STATUS } from "../constants/trustModel";

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

/**
 * Admin-only: update listing.verification_status + metadata via Supabase.
 * @returns {Promise<{ ok: boolean, data?: object, error?: object }>}
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
  return { ok: true, data };
}
