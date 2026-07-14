import { MESSAGE_SENDER_ROLE } from "./crmConstants";

/** Canonical copy for viewing workflow system messages in linked conversations. */
export const VIEWING_SYSTEM_MESSAGE = Object.freeze({
  CONFIRMED: (slot) =>
    `Your viewing has been confirmed for ${slot}.`,
  DECLINED:
    "The viewing request was declined. You may message the owner to arrange another time.",
  RESCHEDULE_PROPOSED: (slot) => `A new viewing time was proposed: ${slot}.`,
  RESCHEDULE_ACCEPTED: (slot) => `The proposed viewing time has been accepted and confirmed for ${slot}.`,
  CANCELLED: "The scheduled viewing was cancelled.",
});

const BELIZE_TZ = "America/Belize";

function parseBelizeViewingInstant(date, time) {
  if (!date) return null;
  const timeStr = time ? String(time).slice(0, 5) : "12:00";
  const dt = new Date(`${date}T${timeStr}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Card/notification copy: Wednesday, July 15 · 8:00 AM */
export function formatViewingSlotLabel(date, time) {
  const dt = parseBelizeViewingInstant(date, time);
  if (!dt) {
    const timeStr = time ? String(time).slice(0, 5) : "";
    return date ? `${date}${timeStr ? ` at ${timeStr}` : ""}` : "the proposed time";
  }
  const weekday = dt.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: BELIZE_TZ,
  });
  const monthDay = dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: BELIZE_TZ,
  });
  const timeLabel = time
    ? dt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: BELIZE_TZ,
      })
    : "";
  return timeLabel ? `${weekday}, ${monthDay} · ${timeLabel}` : `${weekday}, ${monthDay}`;
}

/** Compact card label: Wed, Jul 15 at 8:00 AM */
export function formatViewingSlotCompact(date, time) {
  const dt = parseBelizeViewingInstant(date, time);
  if (!dt) {
    const timeStr = time ? String(time).slice(0, 5) : "";
    return date ? `${date}${timeStr ? ` ${timeStr}` : ""}` : "";
  }
  const datePart = dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: BELIZE_TZ,
  });
  const timePart = time
    ? dt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: BELIZE_TZ,
      })
    : "";
  return timePart ? `${datePart} at ${timePart}` : datePart;
}

/**
 * Append a single system message to a viewing conversation and refresh preview.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function appendViewingSystemMessage(
  client,
  { conversationId, body, dedupeKey, markBuyerUnread = true }
) {
  const text = String(body || "").trim();
  if (!conversationId || !text) return { data: null, error: null, skipped: true };

  if (dedupeKey && client?.from) {
    const msgTable = client.from("messages");
    if (typeof msgTable?.select === "function") {
      const dedupeChain = msgTable.select("id");
      if (typeof dedupeChain?.eq === "function") {
        const { data: recent } = await dedupeChain
          .eq("conversation_id", conversationId)
          .eq("body", text)
          .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .limit(1);
        if (recent?.length) return { data: recent[0], error: null, skipped: true };
      }
    }
  }

  const now = new Date().toISOString();
  const msgInsertTable = client.from("messages");
  if (typeof msgInsertTable?.insert !== "function") {
    return { data: null, error: null, skipped: true };
  }

  const { data: message, error } = await msgInsertTable
    .insert({
      conversation_id: conversationId,
      sender_id: null,
      sender_role: MESSAGE_SENDER_ROLE.SYSTEM,
      body: text,
      channel: "in_app",
      created_at: now,
    })
    .select("id,created_at")
    .single();

  if (error) return { data: null, error };

  const convTable = client.from("conversations");
  if (typeof convTable?.update === "function") {
    await convTable
      .update({
        last_message_at: now,
        last_message_body: text,
        last_message_role: MESSAGE_SENDER_ROLE.SYSTEM,
        buyer_unread: markBuyerUnread,
        updated_at: now,
      })
      .eq("id", conversationId);
  }

  return { data: message, error: null, skipped: false };
}
