import { fetchListingOwnerContact } from "./listingContactResolver";

/**
 * Resolve listing owner / agent user id for inquiry RPC payloads.
 * Public listing rows may omit user_id under RLS; contact RPC exposes userId.
 */
export function resolveListingAgentUserId(listing, contact) {
  const fromListing = listing?.user_id ?? listing?.userId ?? null;
  if (fromListing) return String(fromListing);

  const fromContact = contact?.userId ?? contact?.user_id ?? null;
  if (fromContact) return String(fromContact);

  return null;
}

/**
 * Resolve agent user id, fetching public owner contact RPC when the listing row omits user_id.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 */
export async function resolveListingAgentUserIdAsync(client, listing, contact) {
  const sync = resolveListingAgentUserId(listing, contact);
  if (sync || !client || listing?.id == null) return sync;

  const { contact: resolved } = await fetchListingOwnerContact(client, listing.id);
  return resolveListingAgentUserId(listing, resolved);
}
