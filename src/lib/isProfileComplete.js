/**
 * Minimum profile completion for listing submit-for-review.
 * Phone is required; email comes from auth / profiles.email.
 *
 * @param {{ phone?: string|null, profile_completed_at?: string|null }} profile
 * @returns {boolean}
 */
export function isProfileComplete(profile) {
  if (!profile || typeof profile !== "object") return false;
  if (profile.profile_completed_at) return true;
  const phone = String(profile.phone ?? "").trim();
  return phone.replace(/\D/g, "").length >= 7;
}

/**
 * @param {{ phone?: string|null, profile_completed_at?: string|null }} profile
 * @returns {string|null}
 */
export function profileCompletionMissingReason(profile) {
  if (isProfileComplete(profile)) return null;
  return "Add a phone number in your profile before submitting a listing for review.";
}
