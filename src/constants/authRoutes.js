/** Canonical auth entry in this app (no separate `/signin` route). */
export const LOGIN_PATH = "/login";

/** Supabase email-link landing route (signup confirm, magic link, recovery). */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** Password reset form (session established via auth callback). */
export const RESET_PASSWORD_PATH = "/reset-password";

export function loginHref({ signup = false } = {}) {
  if (!signup) return LOGIN_PATH;
  return `${LOGIN_PATH}?signup=1`;
}
