export const NOTIFICATION_DROPDOWN_READ_RETENTION_HOURS = 24;

function compareStableIdsDesc(aId, bId) {
  const aStr = String(aId || "");
  const bStr = String(bId || "");
  const aNum = Number(aStr);
  const bNum = Number(bStr);
  if (Number.isFinite(aNum) && Number.isFinite(bNum) && aStr !== "" && bStr !== "") {
    return bNum - aNum;
  }
  return bStr.localeCompare(aStr);
}

export function buildNotificationDropdownRetentionCutoffIso(
  nowMs = Date.now(),
  retentionHours = NOTIFICATION_DROPDOWN_READ_RETENTION_HOURS
) {
  return new Date(nowMs - retentionHours * 3_600_000).toISOString();
}

export function compareDurableNotificationRows(a, b) {
  const aCreated = Date.parse(String(a?.created_at || "")) || 0;
  const bCreated = Date.parse(String(b?.created_at || "")) || 0;
  if (aCreated !== bCreated) return bCreated - aCreated;
  return compareStableIdsDesc(a?.id, b?.id);
}

export function compareNotificationCenterItems(a, b) {
  const aTs = Date.parse(String(a?.sortAt || a?.when || "")) || 0;
  const bTs = Date.parse(String(b?.sortAt || b?.when || "")) || 0;
  if (aTs !== bTs) return bTs - aTs;
  return compareStableIdsDesc(
    a?.notificationId || a?.id,
    b?.notificationId || b?.id
  );
}

/**
 * Durable inbox rows first (newest first), then supplemental legacy summaries.
 */
export function mergeNotificationCenterItems({
  durableItems = [],
  supplementalItems = [],
  limit = 10,
} = {}) {
  const sortedDurable = [...durableItems].sort(compareNotificationCenterItems);
  const merged = [...sortedDurable];
  const seen = new Set(sortedDurable.map((item) => item.id));
  for (const item of supplementalItems) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged.slice(0, limit);
}

export function prependDurableNotificationItem(items, incoming, limit = 10) {
  if (!incoming?.id) return items;
  const withoutDup = (items || []).filter((item) => item.id !== incoming.id);
  return [incoming, ...withoutDup].slice(0, limit);
}

export function patchNotificationCenterItemRead(items, notificationId, readAt) {
  const id = String(notificationId || "");
  if (!id) return items;
  return (items || []).map((item) =>
    String(item.notificationId || "") === id
      ? { ...item, unread: false, readAt: readAt || item.readAt || new Date().toISOString() }
      : item
  );
}

export function countUnreadNotificationCenterItems(items) {
  return (items || []).filter((item) => item.unread).length;
}

/**
 * Canonical unread badge count shared by navbar + dropdown.
 * Never let a stale/unreliable server count hide visibly unread durable rows.
 */
export function resolveUnreadNotificationBadgeCount({
  serverUnreadCount = null,
  serverCountReliable = false,
  items = [],
  previousCount = 0,
} = {}) {
  const localUnread = countUnreadNotificationCenterItems(items);
  if (serverCountReliable && Number.isFinite(Number(serverUnreadCount))) {
    return Math.max(Math.max(0, Number(serverUnreadCount)), localUnread);
  }
  return Math.max(Math.max(0, Number(previousCount) || 0), localUnread);
}

/**
 * Realtime INSERT merge — dedupe by id, report whether a new unread arrived.
 */
export function applyRealtimeUnreadInsert(items, incoming, { limit = 10 } = {}) {
  if (!incoming?.id) {
    return { items: items || [], isNew: false, isNewUnread: false };
  }
  const existed = (items || []).some((item) => item.id === incoming.id);
  const nextItems = prependDurableNotificationItem(items, incoming, limit);
  return {
    items: nextItems,
    isNew: !existed,
    isNewUnread: !existed && Boolean(incoming.unread),
  };
}

/**
 * Realtime / optimistic mark-read — clears unread and reports whether badge should drop.
 */
export function applyRealtimeUnreadMarkRead(items, notificationId, readAt) {
  const id = String(notificationId || "");
  if (!id) {
    return { items: items || [], didMarkRead: false };
  }
  const previous = (items || []).find((item) => String(item.notificationId || "") === id);
  const wasUnread = Boolean(previous?.unread);
  return {
    items: patchNotificationCenterItemRead(items, id, readAt),
    didMarkRead: wasUnread,
  };
}

/**
 * Keep unread durable rows that arrived via realtime while a refetch was in flight.
 */
export function preserveMissedRealtimeUnreadArrivals(previousItems, nextItems, { limit = 10 } = {}) {
  const reconciled = nextItems || [];
  const nextIds = new Set(reconciled.map((item) => item.id));
  const missed = (previousItems || []).filter(
    (item) => item?.notificationId && item.unread && item.id && !nextIds.has(item.id)
  );
  if (!missed.length) return reconciled;
  return [...missed, ...reconciled].slice(0, limit);
}

/**
 * Arrival attention triggers once per notification ID.
 * @param {Set<string>} seenIds
 * @param {string|number|null|undefined} notificationId
 */
export function shouldTriggerNotificationArrivalAttention(seenIds, notificationId) {
  const id = String(notificationId || "").trim();
  if (!id || !seenIds) return false;
  if (seenIds.has(id)) return false;
  seenIds.add(id);
  return true;
}

export function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
