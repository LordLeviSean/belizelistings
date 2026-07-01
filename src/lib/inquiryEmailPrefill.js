/**
 * Resolve buyer email for inquiry / message forms.
 * Logged-in: auth session email, then profile email.
 * @param {{ id?: string|null, email?: string|null }|null|undefined} user
 * @param {{ email?: string|null }|null|undefined} profile
 * @returns {string}
 */
export function resolveInquirySenderEmail(user, profile) {
  if (!user?.id) return "";
  const fromProfile = String(profile?.email ?? "").trim();
  if (fromProfile && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromProfile)) return fromProfile;
  const fromUser = String(user?.email ?? "").trim();
  if (fromUser && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromUser)) return fromUser;
  return "";
}

/**
 * Whether the email field should be read-only (authenticated buyers).
 * @param {{ id?: string|null }|null|undefined} user
 * @returns {boolean}
 */
export function isInquiryEmailReadOnly(user) {
  return Boolean(user?.id);
}
