import { formatCapitalizedProfileDisplayName } from "./profileDisplayName";

/**
 * Normalize RPC / profile row into public listing contact shape.
 * @param {object|null|undefined} raw
 * @returns {object|null}
 */
export function normalizeListingOwnerContact(raw) {
  if (!raw || typeof raw !== "object") return null;
  const displayName = formatCapitalizedProfileDisplayName({
    username: raw.username ?? raw.display_name,
    email: raw.email,
  });
  return {
    userId: raw.user_id ?? raw.userId ?? null,
    displayName: displayName || "Your listing agent",
    brokerageName: String(raw.brokerage_name ?? raw.brokerageName ?? "").trim() || null,
    brokeragePhone: String(raw.brokerage_phone ?? raw.brokeragePhone ?? "").trim() || null,
    phone: String(raw.phone ?? "").trim() || null,
    whatsapp: String(raw.whatsapp ?? "").trim() || null,
    email: String(raw.email ?? "").trim() || null,
    showEmailPublic: raw.show_email_public !== false,
    showPhonePublic: raw.show_phone_public !== false,
  };
}

/**
 * Resolve display contact from owner profile row (client-side fallback when RPC unavailable).
 * @param {object|null|undefined} ownerProfile
 * @returns {object|null}
 */
export function resolveListingContactFromProfile(ownerProfile) {
  if (!ownerProfile?.id) return null;
  const showEmail = ownerProfile.show_email_public !== false;
  const showPhone = ownerProfile.show_phone_public !== false;
  const phone = showPhone ? String(ownerProfile.phone ?? "").trim() || null : null;
  let whatsapp = String(ownerProfile.whatsapp ?? "").trim() || null;
  if (!whatsapp && phone) whatsapp = phone;
  const emailRaw = ownerProfile.contact_email_display ?? ownerProfile.email;
  const email = showEmail ? String(emailRaw ?? "").trim() || null : null;

  return normalizeListingOwnerContact({
    user_id: ownerProfile.id,
    username: ownerProfile.username,
    email,
    phone,
    whatsapp,
    brokerage_name: ownerProfile.brokerage_name,
    brokerage_phone: ownerProfile.brokerage_phone,
    show_email_public: showEmail,
    show_phone_public: showPhone,
  });
}

/**
 * Legacy listing-level contact fields (deprecated; kept for graceful fallback).
 * @param {object|null|undefined} listing
 * @returns {object|null}
 */
export function resolveListingContactFromListingFields(listing) {
  if (!listing) return null;
  const hasLegacy =
    listing.agent_phone ||
    listing.agent_email ||
    listing.agent_name ||
    listing.agent ||
    listing.agency_name ||
    listing.brokerage_name;
  if (!hasLegacy) return null;

  return normalizeListingOwnerContact({
    display_name: listing.agent_name || listing.agent,
    email: listing.agent_email,
    phone: listing.agent_phone,
    whatsapp: listing.agent_phone,
    brokerage_name: listing.brokerage_name || listing.agency_name,
  });
}

/**
 * Preferred resolver: owner profile → legacy listing fields.
 * @param {object|null|undefined} listing
 * @param {object|null|undefined} ownerProfile
 * @returns {object|null}
 */
export function resolveListingContact(listing, ownerProfile) {
  const fromProfile = resolveListingContactFromProfile(ownerProfile);
  if (fromProfile && (fromProfile.phone || fromProfile.email || fromProfile.whatsapp)) {
    return fromProfile;
  }
  return resolveListingContactFromListingFields(listing);
}

const RPC_GET_OWNER_CONTACT = "get_listing_owner_public_contact";

/**
 * Fetch privacy-respecting owner contact via Supabase RPC.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string|number} listingId
 */
export async function fetchListingOwnerContact(client, listingId) {
  if (!client || listingId == null) {
    return { contact: null, error: null, unavailable: true };
  }

  const { data, error } = await client.rpc(RPC_GET_OWNER_CONTACT, {
    p_listing_id: Number(listingId),
  });

  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    const unavailable =
      msg.includes("function") && msg.includes("does not exist") ||
      msg.includes("could not find") ||
      error.code === "PGRST202";
    return { contact: null, error, unavailable };
  }

  return {
    contact: normalizeListingOwnerContact(data),
    error: null,
    unavailable: false,
  };
}
