/** One-time deep-link action for Quick Actions → Create User on `/admin`. */
export const ADMIN_CREATE_USER_QUERY_ACTION = "create-user";

/**
 * True when the router query should open the create-user modal once.
 * Accepts Next.js string or string[] query values.
 */
export function shouldOpenCreateUserModal(action) {
  const raw = Array.isArray(action) ? action[0] : action;
  return String(raw || "") === ADMIN_CREATE_USER_QUERY_ACTION;
}

/**
 * Shallow-safe copy of a router query object with one key removed.
 * Does not mutate the input. Preserves array-valued parameters.
 */
export function omitRouterQueryParam(query, paramKey) {
  const next = {};
  for (const [key, value] of Object.entries(query || {})) {
    if (key === paramKey) continue;
    next[key] = value;
  }
  return next;
}
