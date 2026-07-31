import { BL_ENABLE_CONVERSATIONS } from "../featureFlags";
import { filterInboxConversations } from "./conversationFilters";
import {
  fetchConversationsForAgent,
  fetchConversationsForBuyer,
} from "./conversationMutations";

/**
 * Canonical Inquiries KPI: distinct active Inbox conversations.
 * Excludes schedule_viewing synthetics, deleted/archived (via fetch filters),
 * orphans (no conversation row), and duplicate inquiry rows for one thread.
 */
export function countActiveInquiryConversations(conversations = []) {
  const inbox = filterInboxConversations(conversations);
  const ids = new Set();
  for (const conv of inbox) {
    const id = conv?.id;
    if (id == null || id === "") continue;
    ids.add(String(id));
  }
  return ids.size;
}

/**
 * Merge owner + buyer inbox conversation lists without double-counting.
 */
export function mergeActiveInquiryConversations(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const conv of filterInboxConversations(list || [])) {
      const id = conv?.id;
      if (id == null || id === "") continue;
      const key = String(id);
      if (!byId.has(key)) byId.set(key, conv);
    }
  }
  return [...byId.values()];
}

export async function resolveOwnerActiveInquiryConversations(client, ownerUserId, opts = {}) {
  if (!client || !ownerUserId || !BL_ENABLE_CONVERSATIONS) {
    return { conversations: [], count: 0, error: null };
  }
  const { data, error } = await fetchConversationsForAgent(client, ownerUserId, opts);
  if (error) {
    return { conversations: [], count: 0, error };
  }
  const conversations = filterInboxConversations(data || []);
  return {
    conversations,
    count: countActiveInquiryConversations(conversations),
    error: null,
  };
}

export async function resolveBuyerActiveInquiryConversations(client, buyerUserId, opts = {}) {
  if (!client || !buyerUserId || !BL_ENABLE_CONVERSATIONS) {
    return { conversations: [], count: 0, error: null };
  }
  const { data, error } = await fetchConversationsForBuyer(client, buyerUserId, opts);
  if (error) {
    return { conversations: [], count: 0, error };
  }
  const conversations = filterInboxConversations(data || []);
  return {
    conversations,
    count: countActiveInquiryConversations(conversations),
    error: null,
  };
}

/**
 * Dashboard Inquiries KPI for a principal.
 * - ownerOnly (Agent): active owner Inbox conversations
 * - owner + buyer (User): union of both Inbox surfaces
 */
export async function resolveDashboardActiveInquiryCount(
  client,
  userId,
  { includeOwner = true, includeBuyer = false, limit = 80 } = {}
) {
  if (!client || !userId || !BL_ENABLE_CONVERSATIONS) {
    return { count: 0, conversations: [], error: null, unavailable: !BL_ENABLE_CONVERSATIONS };
  }

  const tasks = [];
  if (includeOwner) {
    tasks.push(resolveOwnerActiveInquiryConversations(client, userId, { limit }));
  }
  if (includeBuyer) {
    tasks.push(resolveBuyerActiveInquiryConversations(client, userId, { limit }));
  }
  if (tasks.length === 0) {
    return { count: 0, conversations: [], error: null };
  }

  const results = await Promise.all(tasks);
  const firstError = results.find((r) => r.error)?.error || null;
  const conversations = mergeActiveInquiryConversations(...results.map((r) => r.conversations));
  return {
    count: countActiveInquiryConversations(conversations),
    conversations,
    error: firstError,
  };
}
