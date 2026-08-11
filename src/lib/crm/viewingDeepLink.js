/** Compare viewing ids from URL params, push payloads, and PostgREST rows. */
export function viewingIdsMatch(left, right) {
  if (left == null || right == null) return false;
  return String(left) === String(right);
}

/**
 * @param {Array<{ id?: string|number|null }>} viewings
 * @param {string|number|null|undefined} targetId
 * @returns {string|number|null}
 */
export function resolveDeepLinkedViewingId(viewings, targetId) {
  if (!targetId || !Array.isArray(viewings) || !viewings.length) return null;
  const match = viewings.find((row) => viewingIdsMatch(row?.id, targetId));
  return match?.id ?? null;
}
