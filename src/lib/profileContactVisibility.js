/**
 * Consent-based public contact visibility — single source of truth for all public surfaces.
 *
 * Email: hidden unless the owner explicitly enabled "Show my email publicly" AND set a
 * public display email (`contact_email_display`). Legacy rows with show_email_public=true
 * but no contact_email_display are treated as no consent.
 *
 * Phone: shown when show_phone_public !== false (preferred default public channel).
 */

/**
 * @param {object|null|undefined} profile
 */
export function isPhonePubliclyVisible(profile) {
  return profile?.show_phone_public !== false;
}

/**
 * Explicit public-email consent requires both the flag and a display email marker.
 * @param {object|null|undefined} profile
 */
export function hasExplicitPublicEmailConsent(profile) {
  return profile?.show_email_public === true && Boolean(String(profile?.contact_email_display ?? "").trim());
}

/** @param {object|null|undefined} profile */
export function isEmailPubliclyVisible(profile) {
  return hasExplicitPublicEmailConsent(profile);
}

/**
 * Resolve email safe for public rendering (never infer from auth email alone).
 * @param {object|null|undefined} profile
 */
export function resolvePublicContactEmail(profile) {
  if (!isEmailPubliclyVisible(profile)) return null;
  const display = String(profile.contact_email_display ?? "").trim();
  return display || null;
}

/**
 * @param {object|null|undefined} profile
 */
export function resolvePublicContactPhone(profile) {
  if (!isPhonePubliclyVisible(profile)) return null;
  const phone = String(profile?.phone ?? "").trim();
  return phone || null;
}

/**
 * @param {object|null|undefined} profile
 */
export function resolvePublicContactWhatsApp(profile) {
  if (!isPhonePubliclyVisible(profile)) return null;
  const whatsapp = String(profile?.whatsapp ?? "").trim();
  const phone = resolvePublicContactPhone(profile);
  return whatsapp || phone || null;
}

/**
 * Strip non-consented contact fields from a normalized listing contact object.
 * @param {object|null|undefined} contact
 * @param {object|null|undefined} [profileHints]
 */
export function applyPublicContactVisibility(contact, profileHints = {}) {
  if (!contact) return null;

  const profile = {
    show_email_public: profileHints.show_email_public ?? contact.showEmailPublic,
    show_phone_public: profileHints.show_phone_public ?? contact.showPhonePublic,
    contact_email_display: profileHints.contact_email_display ?? contact.contactEmailDisplay,
    phone: profileHints.phone ?? contact.phone,
    whatsapp: profileHints.whatsapp ?? contact.whatsapp,
  };

  const email = resolvePublicContactEmail(profile);
  const phone = resolvePublicContactPhone(profile);
  let whatsapp = resolvePublicContactWhatsApp(profile);

  return {
    ...contact,
    email,
    phone,
    whatsapp,
    contactEmailDisplay: email,
    showEmailPublic: Boolean(email),
    showPhonePublic: isPhonePubliclyVisible(profile),
  };
}

/**
 * Public agent profile row — never include raw auth email in client payloads.
 * @param {object|null|undefined} profile
 */
export function buildPublicAgentProfileContact(profile) {
  if (!profile) {
    return { phone: null, email: null, hasDirectContact: false };
  }
  const phone = resolvePublicContactPhone(profile);
  const email = resolvePublicContactEmail(profile);
  return {
    phone,
    email,
    hasDirectContact: Boolean(phone || email),
  };
}
