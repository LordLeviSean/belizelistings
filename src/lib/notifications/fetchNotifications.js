import { BL_ENABLE_NOTIFICATIONS } from "../featureFlags";
import { isCrmUnavailable } from "../crm/crmCompat";
import { mapNotificationRowToCenterItem } from "./notificationCopyRegistry";

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
 * @param {{ limit?: number, offset?: number, unreadOnly?: boolean }} [options]
 */
export async function fetchNotifications(client, userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
  if (!BL_ENABLE_NOTIFICATIONS || !client?.from || !userId) {
    return { data: [], count: 0, skipped: true };
  }

  let query = client
    .from("notifications")
    .select(NOTIFICATION_SELECT, unreadOnly ? { count: "exact" } : undefined)
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error, count } = await query;

  if (error) {
    if (isNotificationsUnavailable(error)) {
      return { data: [], count: 0, skipped: true, error };
    }
    return { data: [], count: 0, error };
  }

  return { data: data || [], count: unreadOnly ? count ?? (data || []).length : (data || []).length, error: null };
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
export function mapNotificationsForCenter(rows) {
  return (rows || []).map(mapNotificationRowToCenterItem);
}
