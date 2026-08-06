import { formatCapitalizedProfileDisplayName } from "./profileDisplayName";
import {
  applyPublicContactVisibility,
  isEmailPubliclyVisible,
  isPhonePubliclyVisible,
  resolvePublicContactEmail,
  resolvePublicContactPhone,
  resolvePublicContactWhatsApp,
} from "./profileContactVisibility";

/**
 * Normalize RPC / profile row into public listing contact shape.
 * @param {object|null|undefined} raw
 * @returns {object|null}
 */
export function normalizeListingOwnerContact(raw) {
  if (!raw || typeof raw !== "object") return null;

  const profileHints = {
    show_email_public: raw.show_email_public,
    show_phone_public: raw.show_phone_public,
    contact_email_display: raw.contact_email_display,
    phone: raw.phone,
    whatsapp: raw.whatsapp,
  };

  const displayName = formatCapitalizedProfileDisplayName({
    username: raw.username ?? raw.display_name,
    email: null,
  });

  const base = {
    userId: raw.user_id ?? raw.userId ?? null,
    displayName: displayName || raw.display_name || "Your listing agent",
    brokerageName: String(raw.brokerage_name ?? raw.brokerageName ?? "").trim() || null,
    brokeragePhone: String(raw.brokerage_phone ?? raw.brokeragePhone ?? "").trim() || null,
    phone: String(raw.phone ?? "").trim() || null,
    whatsapp: String(raw.whatsapp ?? "").trim() || null,
    email: String(raw.email ?? "").trim() || null,
    contactEmailDisplay: String(raw.contact_email_display ?? "").trim() || null,
    showEmailPublic: isEmailPubliclyVisible(profileHints),
    showPhonePublic: isPhonePubliclyVisible(profileHints),
  };

  return applyPublicContactVisibility(base, profileHints);
}

/**
 * Resolve display contact from owner profile row (client-side fallback when RPC unavailable).
 * @param {object|null|undefined} ownerProfile
 * @returns {object|null}
 */
export function resolveListingContactFromProfile(ownerProfile) {
  if (!ownerProfile?.id) return null;

  const email = resolvePublicContactEmail(ownerProfile);
  const phone = resolvePublicContactPhone(ownerProfile);
  const whatsapp = resolvePublicContactWhatsApp(ownerProfile);

  return normalizeListingOwnerContact({
    user_id: ownerProfile.id,
    username: ownerProfile.username,
    email,
    phone,
    whatsapp,
    brokerage_name: ownerProfile.brokerage_name,
    brokerage_phone: ownerProfile.brokerage_phone,
    contact_email_display: ownerProfile.contact_email_display,
    show_email_public: ownerProfile.show_email_public,
    show_phone_public: ownerProfile.show_phone_public,
  });
}

/**
 * Legacy listing-level contact fields — name/brokerage only; never expose email/phone without consent.
 * @param {object|null|undefined} listing
 * @returns {object|null}
 */
export function resolveListingContactFromListingFields(listing) {
  if (!listing) return null;
  const hasLegacy =
    listing.agent_name || listing.agent || listing.agency_name || listing.brokerage_name;
  if (!hasLegacy) return null;

  return normalizeListingOwnerContact({
    display_name: listing.agent_name || listing.agent,
    brokerage_name: listing.brokerage_name || listing.agency_name,
    show_email_public: false,
    show_phone_public: false,
  });
}

/**
 * Preferred resolver: owner profile → legacy listing fields (display metadata only).
 * @param {object|null|undefined} listing
 * @param {object|null|undefined} ownerProfile
 * @returns {object|null}
 */
export function resolveListingContact(listing, ownerProfile) {
  const fromProfile = resolveListingContactFromProfile(ownerProfile);
  if (fromProfile && (fromProfile.phone || fromProfile.email || fromProfile.whatsapp || fromProfile.displayName)) {
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
      (msg.includes("function") && msg.includes("does not exist")) ||
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

/** @param {object|null|undefined} contact */
export function hasPublicDirectContactMethods(contact) {
  if (!contact) return false;
  return Boolean(
    (contact.showPhonePublic !== false && (contact.phone || contact.whatsapp)) ||
      (contact.showEmailPublic && contact.email)
  );
}
