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
