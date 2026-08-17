import {
  conversationIdsMatch,
  conversationListIncludesId,
  mergeConversationIntoList,
} from "./conversationDeepLink";
import {
  mergeViewingIntoList,
  viewingIdsMatch,
  viewingListIncludesId,
} from "./viewingDeepLink";

/**
 * Begin a CRM list request generation tick.
 * @param {{ current: number }} generationRef
 */
export function beginCrmRequest(generationRef) {
  generationRef.current += 1;
  return generationRef.current;
}

/**
 * @param {{ current: number }} generationRef
 * @param {number} generation
 */
export function isStaleCrmRequest(generationRef, generation) {
  return generation !== generationRef.current;
}

/**
 * Invalidate in-flight CRM requests (e.g. on unmount).
 * @param {{ current: number }} generationRef
 */
export function invalidateCrmRequests(generationRef) {
  generationRef.current += 1;
}

/**
 * @param {object|null|undefined} error
 */
export function crmErrorMessage(error, fallback = "Unable to load right now.") {
  if (!error) return null;
  return error.message || fallback;
}

/**
 * Preserve a deep-linked conversation row when a generic list refresh omits it.
 *
 * @param {{
 *   incoming?: Array<object>,
 *   previous?: Array<object>,
 *   deepLinkId?: string|number|null,
 * }} input
 */
export function applyConversationListWithDeepLink({ incoming = [], previous = [], deepLinkId = null }) {
  const next = Array.isArray(incoming) ? incoming : [];
  const prior = Array.isArray(previous) ? previous : [];
  if (!deepLinkId || conversationListIncludesId(next, deepLinkId)) {
    return next;
  }
  const preserved = prior.find((row) => conversationIdsMatch(row?.id, deepLinkId));
  if (!preserved) return next;
  return mergeConversationIntoList(next, preserved);
}

/**
 * Preserve a deep-linked viewing row when a generic list refresh omits it.
 *
 * @param {{
 *   incoming?: Array<object>,
 *   previous?: Array<object>,
 *   deepLinkId?: string|number|null,
 * }} input
 */
export function applyViewingListWithDeepLink({ incoming = [], previous = [], deepLinkId = null }) {
  const next = Array.isArray(incoming) ? incoming : [];
  const prior = Array.isArray(previous) ? previous : [];
  if (!deepLinkId || viewingListIncludesId(next, deepLinkId)) {
    return next;
  }
  const preserved = prior.find((row) => viewingIdsMatch(row?.id, deepLinkId));
  if (!preserved) return next;
  return mergeViewingIntoList(next, preserved);
}

/**
 * Apply buyer CRM list load results with stale-response protection and deep-link preservation.
 *
 * @param {{
 *   generationRef: { current: number },
 *   generation: number,
 *   result: {
 *     inquiries?: Array<object>,
 *     viewings?: Array<object>,
 *     conversations?: Array<object>,
 *     listingsById?: Record<string|number, object>,
 *     errors?: Record<string, object|null|undefined>,
 *   },
 *   previous: {
 *     conversations?: Array<object>,
 *     viewings?: Array<object>,
 *     listingsById?: Record<string|number, object>,
 *   },
 *   deepLinkConversationId?: string|number|null,
 *   deepLinkViewingId?: string|number|null,
 * }} input
 * @returns {null|{
 *   inquiries: Array<object>,
 *   conversations: Array<object>,
 *   viewings: Array<object>,
 *   listingsById: Record<string|number, object>,
 *   conversationError: string|null,
 *   viewingError: string|null,
 *   inquiryError: string|null,
 * }}
 */
export function applyBuyerCrmLoadResult({
  generationRef,
  generation,
  result,
  previous,
  deepLinkConversationId = null,
  deepLinkViewingId = null,
}) {
  if (isStaleCrmRequest(generationRef, generation)) {
    return null;
  }

  const errors = result?.errors ?? {};
  const conversationError = crmErrorMessage(errors.conversations, "Unable to load conversations right now.");
  const viewingError = crmErrorMessage(errors.viewings, "Unable to load viewing requests right now.");
  const inquiryError = crmErrorMessage(errors.inquiries, "Unable to load inquiries right now.");

  const priorConversations = previous?.conversations ?? [];
  const priorViewings = previous?.viewings ?? [];
  const priorListingsById = previous?.listingsById ?? {};

  let conversations = priorConversations;
  if (!conversationError) {
    conversations = applyConversationListWithDeepLink({
      incoming: result?.conversations ?? [],
      previous: priorConversations,
      deepLinkId: deepLinkConversationId,
    });
  }

  let viewings = priorViewings;
  if (!viewingError) {
    viewings = applyViewingListWithDeepLink({
      incoming: result?.viewings ?? [],
      previous: priorViewings,
      deepLinkId: deepLinkViewingId,
    });
  }

  const inquiries = inquiryError ? [] : result?.inquiries ?? [];
  const listingsById = errors.listings
    ? priorListingsById
    : { ...priorListingsById, ...(result?.listingsById ?? {}) };

  return {
    inquiries,
    conversations,
    viewings,
    listingsById,
    conversationError,
    viewingError,
    inquiryError,
  };
}

/**
 * Apply agent conversation list load with stale-response protection.
 *
 * @param {{
 *   generationRef: { current: number },
 *   generation: number,
 *   incoming?: Array<object>,
 *   previous?: Array<object>,
 *   error?: object|null,
 *   deepLinkConversationId?: string|number|null,
 * }} input
 */
export function applyAgentConversationLoadResult({
  generationRef,
  generation,
  incoming = [],
  previous = [],
  error = null,
  deepLinkConversationId = null,
}) {
  if (isStaleCrmRequest(generationRef, generation)) {
    return null;
  }

  const loadError = crmErrorMessage(error, "Unable to load conversations right now.");
  if (loadError) {
    return {
      conversations: previous,
      error: loadError,
    };
  }

  return {
    conversations: applyConversationListWithDeepLink({
      incoming,
      previous,
      deepLinkId: deepLinkConversationId,
    }),
    error: null,
  };
}

/**
 * Apply agent viewing list load with stale-response protection.
 */
export function applyAgentViewingLoadResult({
  generationRef,
  generation,
  incoming = [],
  previous = [],
  error = null,
  deepLinkViewingId = null,
}) {
  if (isStaleCrmRequest(generationRef, generation)) {
    return null;
  }

  const loadError = crmErrorMessage(error, "Unable to load viewing requests right now.");
  if (loadError) {
    return {
      viewings: previous,
      error: loadError,
    };
  }

  return {
    viewings: applyViewingListWithDeepLink({
      incoming,
      previous,
      deepLinkId: deepLinkViewingId,
    }),
    error: null,
  };
}

/**
 * Apply owner inbox list load with stale-response protection.
 */
export function applyOwnerInboxLoadResult({
  generationRef,
  generation,
  result,
  previous,
  deepLinkConversationId = null,
  deepLinkViewingId = null,
}) {
  if (isStaleCrmRequest(generationRef, generation)) {
    return null;
  }

  const errors = result?.errors ?? {};
  const conversationError = crmErrorMessage(errors.conversations, "Unable to load conversations right now.");
  const viewingError = crmErrorMessage(errors.viewings, "Unable to load viewing requests right now.");

  let conversations = previous?.conversations ?? [];
  if (!conversationError) {
    conversations = applyConversationListWithDeepLink({
      incoming: result?.conversations ?? [],
      previous: conversations,
      deepLinkId: deepLinkConversationId,
    });
  }

  let viewings = previous?.viewings ?? [];
  if (!viewingError) {
    viewings = applyViewingListWithDeepLink({
      incoming: result?.viewings ?? [],
      previous: viewings,
      deepLinkId: deepLinkViewingId,
    });
  }

  const listingsById = errors.listings
    ? previous?.listingsById ?? {}
    : result?.listingsById ?? previous?.listingsById ?? {};

  return {
    conversations,
    viewings,
    listingsById,
    conversationError,
    viewingError,
    loadError: conversationError || viewingError || crmErrorMessage(errors.listings),
  };
}
