/** Canonical auth entry in this app (no separate `/signin` route). */
export const LOGIN_PATH = "/login";

export function loginHref({ signup = false } = {}) {
  if (!signup) return LOGIN_PATH;
  return `${LOGIN_PATH}?signup=1`;
}
