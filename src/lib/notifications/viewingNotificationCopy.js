import { formatViewingSlotPushPhrase } from "@/lib/crm/viewingConversationMessages";
import {
  resolveListingTitle,
  resolveSenderName,
  resolveSlotLabel,
} from "./crmNotificationHelpers";
import { resolveSafeSenderName } from "./messagingNotificationCopy";

export const VIEWING_REQUESTED_PUSH_TITLE = "New viewing request";

/**
 * Privacy-conscious push body for viewing_requested events.
 *
 * @param {object} [payload]
 * @returns {{ title: string, body: string }}
 */
export function buildViewingRequestedPushCopy(payload = {}) {
  const senderName = resolveSafeSenderName(payload);
  const listingTitle = resolveListingTitle(payload);
  const slotPhrase =
    formatViewingSlotPushPhrase(
      payload.requested_date ?? payload.requestedDate,
      payload.requested_time ?? payload.requestedTime
    ) ||
    String(resolveSlotLabel(payload) || "")
      .replace(" · ", " at ")
      .trim() ||
    "your listing";

  let body;
  if (senderName && listingTitle && listingTitle !== "your listing") {
    body = `${senderName} requested a viewing of ${listingTitle} for ${slotPhrase}.`;
  } else if (senderName) {
    body = `${senderName} requested a viewing for ${slotPhrase}.`;
  } else if (listingTitle && listingTitle !== "your listing") {
    body = `A buyer requested a viewing of ${listingTitle} for ${slotPhrase}.`;
  } else {
    body = `A buyer requested a viewing for ${slotPhrase}.`;
  }

  return {
    title: VIEWING_REQUESTED_PUSH_TITLE,
    body,
  };
}

/**
 * In-app viewing_requested presentation copy.
 *
 * @param {object} [payload]
 * @returns {{ title: string, body: string }}
 */
export function buildViewingRequestedInAppCopy(payload = {}) {
  const pushCopy = buildViewingRequestedPushCopy(payload);
  const senderName = resolveSafeSenderName(payload) ?? resolveSenderName(payload, "A buyer");
  const listingTitle = resolveListingTitle(payload);
  const slotPhrase =
    formatViewingSlotPushPhrase(
      payload.requested_date ?? payload.requestedDate,
      payload.requested_time ?? payload.requestedTime
    ) ||
    String(resolveSlotLabel(payload) || "")
      .replace(" · ", " at ")
      .trim();

  if (slotPhrase && listingTitle && listingTitle !== "your listing") {
    return {
      title: pushCopy.title,
      body: `${senderName} requested a viewing of ${listingTitle} for ${slotPhrase}.`,
    };
  }

  if (slotPhrase) {
    return {
      title: pushCopy.title,
      body: `${senderName} requested a viewing for ${slotPhrase}.`,
    };
  }

  return {
    title: pushCopy.title,
    body: `${senderName} requested a viewing for ${listingTitle}.`,
  };
}
