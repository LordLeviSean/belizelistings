import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import { buildPushPayload } from "./pushPayload";

export const AGENT_REPLIED_PUSH_TITLE = "You received a reply";
export const AGENT_REPLIED_PUSH_BODY = "Someone replied to your property inquiry.";

/**
 * Privacy-conscious push payload for agent_replied events.
 *
 * @param {{
 *   notificationId: string,
 *   dedupeKey?: string | null,
 *   href: string,
 * }} input
 */
export function buildAgentRepliedPushPayload({ notificationId, dedupeKey, href }) {
  return buildPushPayload({
    notificationId,
    eventType: NOTIFICATION_EVENT_TYPES.AGENT_REPLIED,
    title: AGENT_REPLIED_PUSH_TITLE,
    body: AGENT_REPLIED_PUSH_BODY,
    href,
    tag: dedupeKey || `${NOTIFICATION_EVENT_TYPES.AGENT_REPLIED}:${notificationId}`,
  });
}
