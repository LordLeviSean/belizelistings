/** Canonical auth entry in this app (no separate `/signin` route). */
import { normalizeReturnTo } from "../lib/authEngagementReturn";

export const LOGIN_PATH = "/login";

/** Supabase email-link landing route (signup confirm, magic link, recovery). */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** Password reset form (session established via auth callback). */
export const RESET_PASSWORD_PATH = "/reset-password";

export function loginHref({ signup = false, returnTo = null } = {}) {
  const params = new URLSearchParams();
  if (signup) params.set("signup", "1");
  const normalized = normalizeReturnTo(returnTo);
  if (normalized) params.set("returnTo", normalized);
  const q = params.toString();
  return q ? `${LOGIN_PATH}?${q}` : LOGIN_PATH;
}
