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
