import { BL_ENABLE_NOTIFICATIONS } from "../featureFlags";
import {
  NOTIFICATION_DROPDOWN_READ_RETENTION_HOURS,
  countUnreadNotificationCenterItems,
  mergeNotificationCenterItems,
  preserveMissedRealtimeUnreadArrivals,
  resolveUnreadNotificationBadgeCount,
} from "./notificationCenterQuery";
import { fetchNotifications, fetchUnreadNotificationCount, mapNotificationsForCenter } from "./fetchNotifications";

export const NOTIFICATION_CENTER_FRIENDLY_LOAD_ERROR =
  "We couldn't refresh notifications right now. Please try again in a moment.";

/**
 * Authoritative durable inbox fetch shared by initial load, focus refetch, realtime fallback, and manual Refresh.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} userId
 * @param {{ limit?: number, dropdownRetentionHours?: number }} [options]
 */
export async function fetchDurableInboxForNotificationCenter(supabase, userId, options = {}) {
  if (!BL_ENABLE_NOTIFICATIONS || !supabase || !userId) {
    return {
      durableItems: [],
      unreadCount: 0,
      unreadReliable: false,
      skipped: true,
      error: null,
    };
  }

  const limit = options.limit ?? 12;
  const dropdownRetentionHours =
    options.dropdownRetentionHours ?? NOTIFICATION_DROPDOWN_READ_RETENTION_HOURS;

  const [notificationResult, unreadResult] = await Promise.all([
    fetchNotifications(supabase, userId, { limit, dropdownRetentionHours }),
    fetchUnreadNotificationCount(supabase, userId),
  ]);

  if (notificationResult.error) {
    return {
      durableItems: [],
      unreadCount: 0,
      unreadReliable: false,
      skipped: false,
      error: notificationResult.error,
    };
  }

  const durableItems = notificationResult.skipped
    ? []
    : mapNotificationsForCenter(notificationResult.data || []).map((item) => ({
        ...item,
        sortAt: item.when,
      }));

  const localUnread = countUnreadNotificationCenterItems(durableItems);
  const unreadReliable = !unreadResult.skipped && !unreadResult.error;
  const unreadCount = unreadReliable
    ? Math.max(unreadResult.count ?? 0, localUnread)
    : localUnread;

  return {
    durableItems,
    unreadCount,
    unreadReliable,
    skipped: notificationResult.skipped,
    error: null,
  };
}

/**
 * Apply a durable refresh onto local state without dropping realtime unread arrivals
 * or clearing the badge when the server count is briefly stale.
 */
export function applyDurableNotificationRefresh({
  previousItems = [],
  durableItems = [],
  supplementalItems = [],
  serverUnreadCount = 0,
  serverCountReliable = false,
  previousUnreadCount = 0,
  limit = 10,
  formatWhen = (iso) => iso,
} = {}) {
  const merged = buildNotificationCenterItems({
    durableItems,
    supplementalItems,
    limit,
    formatWhen,
  });
  const reconciled = reconcileNotificationCenterAfterRefresh(previousItems, merged);
  const items = preserveMissedRealtimeUnreadArrivals(previousItems, reconciled, { limit });
  const unreadCount = resolveUnreadNotificationBadgeCount({
    serverUnreadCount,
    serverCountReliable,
    items,
    previousCount: previousUnreadCount,
  });
  return { items, unreadCount };
}

/**
 * Merge durable inbox rows with supplemental legacy summaries using one ordering path.
 */
export function buildNotificationCenterItems({
  durableItems = [],
  supplementalItems = [],
  limit = 10,
  formatWhen = (iso) => iso,
} = {}) {
  const formattedDurable = durableItems.map((item) => ({
    ...item,
    when: formatWhen(item.sortAt || item.when),
  }));
  return mergeNotificationCenterItems({
    durableItems: formattedDurable,
    supplementalItems,
    limit,
  });
}

/**
 * Reconcile a manual/automatic refetch with any optimistic local read state.
 * Does not resurrect unread for items the user already marked read locally.
 */
export function reconcileNotificationCenterAfterRefresh(previousItems, nextItems) {
  const previousById = new Map((previousItems || []).map((item) => [item.id, item]));
  return (nextItems || []).map((item) => {
    const previous = previousById.get(item.id);
    if (!previous) return item;
    if (previous.readAt && item.notificationId) {
      return {
        ...item,
        unread: false,
        readAt: previous.readAt,
      };
    }
    return item;
  });
}

export { resolveUnreadNotificationBadgeCount, preserveMissedRealtimeUnreadArrivals };
