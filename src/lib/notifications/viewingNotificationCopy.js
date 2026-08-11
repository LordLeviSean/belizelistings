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

export const VIEWING_CONFIRMED_PUSH_TITLE = "Viewing confirmed";

function resolveViewingConfirmedSlotPhrase(payload = {}) {
  return (
    formatViewingSlotPushPhrase(
      payload.requested_date ?? payload.requestedDate,
      payload.requested_time ?? payload.requestedTime
    ) ||
    String(resolveSlotLabel(payload) || "")
      .replace(" · ", " at ")
      .replace(" • ", " at ")
      .trim()
  );
}

/**
 * Push/in-app copy for viewing_confirmed events (buyer-facing).
 *
 * @param {object} [payload]
 * @returns {{ title: string, body: string }}
 */
export function buildViewingConfirmedPushCopy(payload = {}) {
  const listingTitle = resolveListingTitle(payload, "");
  const slotPhrase = resolveViewingConfirmedSlotPhrase(payload);

  let body;
  if (listingTitle && listingTitle !== "your listing" && slotPhrase) {
    body = `Your viewing of ${listingTitle} for ${slotPhrase} has been confirmed.`;
  } else if (slotPhrase) {
    body = `Your viewing for ${slotPhrase} has been confirmed.`;
  } else if (listingTitle && listingTitle !== "your listing") {
    body = `Your viewing of ${listingTitle} has been confirmed.`;
  } else {
    body = "Your viewing has been confirmed.";
  }

  return {
    title: VIEWING_CONFIRMED_PUSH_TITLE,
    body,
  };
}

/**
 * In-app viewing_confirmed presentation copy.
 *
 * @param {object} [payload]
 * @returns {{ title: string, body: string }}
 */
export function buildViewingConfirmedInAppCopy(payload = {}) {
  return buildViewingConfirmedPushCopy(payload);
}

export const VIEWING_DECLINED_PUSH_TITLE = "Viewing request declined";

function resolveViewingDeclinedSlotPhrase(payload = {}) {
  return (
    formatViewingSlotPushPhrase(
      payload.requested_date ?? payload.requestedDate,
      payload.requested_time ?? payload.requestedTime
    ) ||
    String(resolveSlotLabel(payload) || "")
      .replace(" · ", " at ")
      .replace(" • ", " at ")
      .trim()
  );
}

/**
 * Push/in-app copy for viewing_declined events (buyer-facing).
 *
 * @param {object} [payload]
 * @returns {{ title: string, body: string }}
 */
export function buildViewingDeclinedPushCopy(payload = {}) {
  const listingTitle = resolveListingTitle(payload, "");
  const slotPhrase = resolveViewingDeclinedSlotPhrase(payload);

  let body;
  if (listingTitle && listingTitle !== "your listing" && slotPhrase) {
    body = `Your viewing request for ${listingTitle} on ${slotPhrase} was declined.`;
  } else if (slotPhrase) {
    body = `Your viewing request for ${slotPhrase} was declined.`;
  } else if (listingTitle && listingTitle !== "your listing") {
    body = `Your viewing request for ${listingTitle} was declined.`;
  } else {
    body = "Your viewing request was declined.";
  }

  return {
    title: VIEWING_DECLINED_PUSH_TITLE,
    body,
  };
}

/**
 * In-app viewing_declined presentation copy.
 *
 * @param {object} [payload]
 * @returns {{ title: string, body: string }}
 */
export function buildViewingDeclinedInAppCopy(payload = {}) {
  return buildViewingDeclinedPushCopy(payload);
}
