import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import { buildMessagingPushCopy } from "@/lib/notifications/messagingNotificationCopy";
import { buildPushPayload } from "./pushPayload";

export const AGENT_REPLIED_PUSH_TITLE = "Agent replied";
export const AGENT_REPLIED_PUSH_BODY = "You received a reply to your property inquiry.";

/**
 * Privacy-conscious push payload for agent_replied events.
 *
 * @param {{
 *   notificationId: string,
 *   dedupeKey?: string | null,
 *   href: string,
 *   payload?: object,
 * }} input
 */
export function buildAgentRepliedPushPayload({ notificationId, dedupeKey, href, payload = {} }) {
  const copy = buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.AGENT_REPLIED, payload);
  return buildPushPayload({
    notificationId,
    eventType: NOTIFICATION_EVENT_TYPES.AGENT_REPLIED,
    title: copy.title,
    body: copy.body,
    href,
    tag: dedupeKey || `${NOTIFICATION_EVENT_TYPES.AGENT_REPLIED}:${notificationId}`,
  });
}
