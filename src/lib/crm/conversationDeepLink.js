/** Compare conversation ids from URL params, push payloads, and PostgREST rows. */
export function conversationIdsMatch(left, right) {
  if (left == null || right == null) return false;
  return String(left) === String(right);
}

/** @param {string|number|null|undefined} value */
export function normalizeConversationId(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

/**
 * @param {Array<{ id?: string|number|null }>} conversations
 * @param {string|number|null|undefined} targetId
 */
export function conversationListIncludesId(conversations, targetId) {
  const normalized = normalizeConversationId(targetId);
  if (!normalized || !Array.isArray(conversations)) return false;
  return conversations.some((row) => conversationIdsMatch(row?.id, normalized));
}

/**
 * @param {Array<{ id?: string|number|null }>} conversations
 * @param {string|number|null|undefined} targetId
 * @returns {string|number|null}
 */
export function resolveDeepLinkedConversationId(conversations, targetId) {
  const normalized = normalizeConversationId(targetId);
  if (!normalized || !Array.isArray(conversations) || !conversations.length) return null;
  const match = conversations.find((row) => conversationIdsMatch(row?.id, normalized));
  return match?.id ?? null;
}

/**
 * @param {Array<object>} conversations
 * @param {object|null|undefined} conversation
 */
export function mergeConversationIntoList(conversations, conversation) {
  if (!conversation?.id) return Array.isArray(conversations) ? [...conversations] : [];
  const list = Array.isArray(conversations) ? [...conversations] : [];
  const index = list.findIndex((row) => conversationIdsMatch(row?.id, conversation.id));
  if (index >= 0) {
    list[index] = { ...list[index], ...conversation };
    return list;
  }
  return [conversation, ...list];
}

/**
 * @param {{
 *   initialConversationId?: string|number|null,
 *   conversations?: Array<object>,
 *   resolveState?: "idle"|"loading"|"resolved"|"missing"|"error",
 *   crmLoading?: boolean,
 * }} input
 */
export function isDeepLinkConversationPending({
  initialConversationId = null,
  conversations = [],
  resolveState = "idle",
  crmLoading = false,
} = {}) {
  const targetId = normalizeConversationId(initialConversationId);
  if (!targetId) return false;
  if (conversationListIncludesId(conversations, targetId)) return false;
  if (resolveState === "missing" || resolveState === "error") return false;
  if (crmLoading || resolveState === "loading" || resolveState === "idle") return true;
  return !conversations?.length;
}
