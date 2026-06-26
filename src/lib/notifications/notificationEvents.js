import { isCrmUnavailable } from "../crm/crmCompat";

/** Structured notification event types (Workstream G — no UI yet). */
export const NOTIFICATION_EVENT_TYPES = Object.freeze({
  NEW_INQUIRY: "new_inquiry",
  AGENT_REPLIED: "agent_replied",
  VIEWING_CONFIRMED: "viewing_confirmed",
  VIEWING_CANCELLED: "viewing_cancelled",
  INQUIRY_ARCHIVED: "inquiry_archived",
});

/**
 * Enqueue a notification for future delivery (email/push/in-app).
 * Inserts into notification_queue when table exists; otherwise no-ops gracefully.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ eventType: string, recipientId?: string, recipientEmail?: string, payload?: object }} params
 */
export async function enqueueNotificationEvent(client, { eventType, recipientId, recipientEmail, payload = {} }) {
  if (!client?.from || !eventType) {
    return { ok: false, skipped: true };
  }

  const row = {
    event_type: eventType,
    recipient_id: recipientId ?? null,
    recipient_email: recipientEmail ?? null,
    payload,
    status: "pending",
    scheduled_at: new Date().toISOString(),
  };

  const { error } = await client.from("notification_queue").insert(row);

  if (error) {
    if (isCrmUnavailable(error)) {
      return { ok: true, skipped: true, error };
    }
    if (typeof console !== "undefined") {
      console.warn("[notifications] enqueue failed", { eventType, message: error.message });
    }
    return { ok: false, error };
  }

  return { ok: true };
}
