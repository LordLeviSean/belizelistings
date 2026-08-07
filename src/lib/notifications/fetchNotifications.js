import { BL_ENABLE_NOTIFICATIONS } from "../featureFlags";
import { isCrmUnavailable } from "../crm/crmCompat";
import { mapNotificationRowToCenterItem } from "./notificationCopyRegistry";
import {
  NOTIFICATION_DROPDOWN_READ_RETENTION_HOURS,
  buildNotificationDropdownRetentionCutoffIso,
  compareDurableNotificationRows,
} from "./notificationCenterQuery";

const NOTIFICATION_SELECT =
  "id,recipient_user_id,category,event_type,entity_type,entity_id,title,body,payload,read_at,created_at";

function isNotificationsUnavailable(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  return isCrmUnavailable(error) || (msg.includes("notifications") && msg.includes("does not exist"));
}

/**
 * Paginated fetch for NotificationCenter (primary source when flag enabled).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @param {{ limit?: number, offset?: number, unreadOnly?: boolean, dropdownRetentionHours?: number, nowMs?: number }} [options]
 */
export async function fetchNotifications(
  client,
  userId,
  {
    limit = 20,
    offset = 0,
    unreadOnly = false,
    dropdownRetentionHours = 0,
    nowMs = Date.now(),
  } = {}
) {
  if (!BL_ENABLE_NOTIFICATIONS || !client?.from || !userId) {
    return { data: [], count: 0, skipped: true };
  }

  let query = client.from("notifications").select(
    NOTIFICATION_SELECT,
    unreadOnly ? { count: "exact" } : undefined
  );

  query = query.eq("recipient_user_id", userId);

  if (unreadOnly) {
    query = query.is("read_at", null);
  } else if (dropdownRetentionHours > 0) {
    const cutoffIso = buildNotificationDropdownRetentionCutoffIso(
      nowMs,
      dropdownRetentionHours
    );
    query = query.or(`read_at.is.null,read_at.gte.${cutoffIso}`);
  }

  query = query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    if (isNotificationsUnavailable(error)) {
      return { data: [], count: 0, skipped: true, error };
    }
    return { data: [], count: 0, error };
  }

  const rows = [...(data || [])].sort(compareDurableNotificationRows);

  return {
    data: rows,
    count: unreadOnly ? count ?? rows.length : rows.length,
    error: null,
  };
}

/**
 * Unread badge count from notifications table.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 */
export async function fetchUnreadNotificationCount(client, userId) {
  if (!BL_ENABLE_NOTIFICATIONS || !client?.from || !userId) {
    return { count: 0, skipped: true };
  }

  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .is("read_at", null);

  if (error) {
    if (isNotificationsUnavailable(error)) {
      return { count: 0, skipped: true, error };
    }
    return { count: 0, error };
  }

  return { count: count ?? 0 };
}

/**
 * Map DB rows to NotificationCenter list items.
 * @param {Array<Record<string, unknown>>} rows
 */
export function mapNotificationsForCenter(rows, { recipientRole = null } = {}) {
  return (rows || []).map((row) => mapNotificationRowToCenterItem(row, { recipientRole }));
}
