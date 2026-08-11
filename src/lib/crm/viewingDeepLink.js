/** Compare viewing ids from URL params, push payloads, and PostgREST rows. */
export function viewingIdsMatch(left, right) {
  if (left == null || right == null) return false;
  return String(left) === String(right);
}

/** @param {string|number|null|undefined} value */
export function normalizeViewingId(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

/**
 * @param {Array<{ id?: string|number|null }>} viewings
 * @param {string|number|null|undefined} targetId
 */
export function viewingListIncludesId(viewings, targetId) {
  const normalized = normalizeViewingId(targetId);
  if (!normalized || !Array.isArray(viewings)) return false;
  return viewings.some((row) => viewingIdsMatch(row?.id, normalized));
}

/**
 * @param {Array<{ id?: string|number|null }>} viewings
 * @param {string|number|null|undefined} targetId
 * @returns {string|number|null}
 */
export function resolveDeepLinkedViewingId(viewings, targetId) {
  const normalized = normalizeViewingId(targetId);
  if (!normalized || !Array.isArray(viewings) || !viewings.length) return null;
  const match = viewings.find((row) => viewingIdsMatch(row?.id, normalized));
  return match?.id ?? null;
}

/**
 * @param {Array<object>} viewings
 * @param {object|null|undefined} viewing
 */
export function mergeViewingIntoList(viewings, viewing) {
  if (!viewing?.id) return Array.isArray(viewings) ? [...viewings] : [];
  const list = Array.isArray(viewings) ? [...viewings] : [];
  const index = list.findIndex((row) => viewingIdsMatch(row?.id, viewing.id));
  if (index >= 0) {
    list[index] = { ...list[index], ...viewing };
    return list;
  }
  return [viewing, ...list];
}

/**
 * @param {{
 *   initialViewingId?: string|number|null,
 *   viewings?: Array<object>,
 *   resolveState?: "idle"|"loading"|"resolved"|"missing",
 *   crmLoading?: boolean,
 * }} input
 */
export function isDeepLinkViewingPending({
  initialViewingId = null,
  viewings = [],
  resolveState = "idle",
  crmLoading = false,
} = {}) {
  const targetId = normalizeViewingId(initialViewingId);
  if (!targetId) return false;
  if (viewingListIncludesId(viewings, targetId)) return false;
  if (resolveState === "missing") return false;
  if (crmLoading || resolveState === "loading" || resolveState === "idle") return true;
  return !viewings?.length;
}
