import { isCrmUnavailable } from "../crm/crmCompat";
import { BL_ENABLE_NOTIFICATIONS } from "../featureFlags";

function isNotificationsUnavailable(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  return isCrmUnavailable(error) || (msg.includes("notifications") && msg.includes("does not exist"));
}

/**
 * Mark a single notification as read.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ notificationId: string, userId: string }} params
 */
export async function markNotificationRead(client, { notificationId, userId }) {
  if (!BL_ENABLE_NOTIFICATIONS || !client?.from || !notificationId || !userId) {
    return { ok: true, skipped: true };
  }

  const now = new Date().toISOString();
  const { error } = await client
    .from("notifications")
    .update({ read_at: now })
    .eq("id", notificationId)
    .eq("recipient_user_id", userId)
    .is("read_at", null);

  if (error) {
    if (isNotificationsUnavailable(error)) {
      return { ok: true, skipped: true, error };
    }
    return { ok: false, error };
  }

  return { ok: true };
}

/**
 * Mark all unread notifications as read for a user.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 */
export async function markAllNotificationsRead(client, userId) {
  if (!BL_ENABLE_NOTIFICATIONS || !client?.from || !userId) {
    return { ok: true, skipped: true };
  }

  const now = new Date().toISOString();
  const { error } = await client
    .from("notifications")
    .update({ read_at: now })
    .eq("recipient_user_id", userId)
    .is("read_at", null);

  if (error) {
    if (isNotificationsUnavailable(error)) {
      return { ok: true, skipped: true, error };
    }
    return { ok: false, error };
  }

  return { ok: true };
}
