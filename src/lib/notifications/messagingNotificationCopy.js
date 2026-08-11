import { formatCapitalizedProfileDisplayName } from "@/lib/profileDisplayName";
import { resolveListingTitle, resolveSenderName } from "./crmNotificationHelpers";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";

/** Authoritative sender context for CRM message notifications. */
export const MESSAGE_SENDER_CONTEXT = Object.freeze({
  BUYER: "buyer",
  AGENT: "agent",
  OWNER: "owner",
  ADMIN: "admin",
});

/**
 * @param {string|null|undefined} name
 * @returns {boolean}
 */
export function isSafePublicDisplayName(name) {
  const value = String(name ?? "").trim();
  if (!value || value.length > 80) {
    return false;
  }
  if (value.includes("@")) {
    return false;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value)) {
    return false;
  }
  return true;
}

/**
 * @param {object} [payload]
 * @returns {string|null}
 */
export function resolveSafeSenderName(payload = {}) {
  const raw =
    payload.sender_name ??
    payload.senderName ??
    payload.requester_name ??
    payload.requesterName;
  const name = String(raw ?? "").trim();
  return isSafePublicDisplayName(name) ? name : null;
}

/**
 * @param {object} [payload]
 * @returns {string|null}
 */
export function resolveSenderContext(payload = {}) {
  const explicit =
    payload.sender_role ??
    payload.senderRole ??
    payload.reply_sender_role ??
    payload.replySenderRole;
  const normalized = String(explicit ?? "").trim().toLowerCase();
  if (normalized === MESSAGE_SENDER_CONTEXT.ADMIN) return MESSAGE_SENDER_CONTEXT.ADMIN;
  if (normalized === MESSAGE_SENDER_CONTEXT.AGENT) return MESSAGE_SENDER_CONTEXT.AGENT;
  if (normalized === MESSAGE_SENDER_CONTEXT.OWNER) return MESSAGE_SENDER_CONTEXT.OWNER;
  if (normalized === MESSAGE_SENDER_CONTEXT.BUYER) return MESSAGE_SENDER_CONTEXT.BUYER;
  return null;
}

/**
 * Map platform profile.role to CRM reply sender context.
 *
 * @param {{ role?: string|null }|null|undefined} profile
 * @returns {typeof MESSAGE_SENDER_CONTEXT[keyof typeof MESSAGE_SENDER_CONTEXT]}
 */
export function resolveReplySenderContextFromProfile(profile) {
  const platformRole = String(profile?.role ?? "user").trim().toLowerCase();
  if (platformRole === MESSAGE_SENDER_CONTEXT.ADMIN) {
    return MESSAGE_SENDER_CONTEXT.ADMIN;
  }
  if (platformRole === MESSAGE_SENDER_CONTEXT.AGENT) {
    return MESSAGE_SENDER_CONTEXT.AGENT;
  }
  return MESSAGE_SENDER_CONTEXT.OWNER;
}

/**
 * @param {{ role?: string|null, username?: string|null, full_name?: string|null, display_name?: string|null }|null|undefined} profile
 * @returns {{ senderRole: string, senderName: string|null }}
 */
export function resolveReplySenderPresentation(profile) {
  const senderRole = resolveReplySenderContextFromProfile(profile);
  const formatted = formatCapitalizedProfileDisplayName(profile ?? {});
  const senderName = isSafePublicDisplayName(formatted) ? formatted : null;
  return { senderRole, senderName };
}

/**
 * Privacy-conscious Web Push title/body for CRM messaging events.
 *
 * @param {string} eventType
 * @param {object} [payload]
 * @returns {{ title: string, body: string }}
 */
export function buildMessagingPushCopy(eventType, payload = {}) {
  const senderName = resolveSafeSenderName(payload);
  const senderContext = resolveSenderContext(payload);

  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.NEW_INQUIRY: {
      const inquiryType = String(payload.inquiry_type ?? payload.inquiryType ?? "general").toLowerCase();
      if (inquiryType === "schedule_viewing") {
        return {
          title: "New viewing request",
          body: senderName
            ? `${senderName} requested a viewing for your listing.`
            : "A buyer requested a viewing for your listing.",
        };
      }
      return {
        title: "New property inquiry",
        body: senderName
          ? `${senderName} is interested in one of your listings.`
          : "A buyer is interested in one of your listings.",
      };
    }

    case NOTIFICATION_EVENT_TYPES.BUYER_REPLIED:
      return {
        title: "Buyer replied",
        body: senderName
          ? `${senderName} replied about your listing.`
          : "You received a new message about your listing.",
      };

    case NOTIFICATION_EVENT_TYPES.AGENT_REPLIED:
      if (senderContext === MESSAGE_SENDER_CONTEXT.OWNER) {
        return {
          title: "Listing contact replied",
          body: senderName
            ? `${senderName} replied to your inquiry.`
            : "You received a reply to your property inquiry.",
        };
      }
      return {
        title: "Agent replied",
        body: senderName
          ? `${senderName} replied to your inquiry.`
          : "You received a reply to your property inquiry.",
      };

    case NOTIFICATION_EVENT_TYPES.ADMIN_REPLIED:
      return {
        title: "BelizeListings replied",
        body: senderName
          ? `${senderName} replied to your conversation.`
          : "An admin responded to your conversation.",
      };

    default:
      return {
        title: "BelizeListings",
        body: "You have a new message.",
      };
  }
}

/**
 * In-app notification title/body for CRM messaging events.
 *
 * @param {string} eventType
 * @param {object} [payload]
 * @returns {{ title: string, body: string }|null}
 */
export function buildMessagingInAppCopy(eventType, payload = {}) {
  const listingTitle = resolveListingTitle(payload);
  const senderName = resolveSafeSenderName(payload);
  const fallbackSender = resolveSenderName(payload, "A buyer");
  const senderContext = resolveSenderContext(payload);
  const pushCopy = buildMessagingPushCopy(eventType, payload);

  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.NEW_INQUIRY: {
      const inquiryType = String(payload.inquiry_type ?? payload.inquiryType ?? "general").toLowerCase();
      if (inquiryType === "schedule_viewing") {
        return null;
      }
      return {
        title: pushCopy.title,
        body: senderName
          ? `${senderName} is interested in ${listingTitle}.`
          : `${fallbackSender} is interested in ${listingTitle}.`,
      };
    }

    case NOTIFICATION_EVENT_TYPES.BUYER_REPLIED:
      return {
        title: pushCopy.title,
        body: senderName
          ? `${senderName} replied about ${listingTitle}.`
          : `You received a new message about ${listingTitle}.`,
      };

    case NOTIFICATION_EVENT_TYPES.AGENT_REPLIED:
      if (senderContext === MESSAGE_SENDER_CONTEXT.OWNER) {
        return {
          title: pushCopy.title,
          body: senderName
            ? `${senderName} replied about ${listingTitle}.`
            : `You received a reply about ${listingTitle}.`,
        };
      }
      return {
        title: pushCopy.title,
        body: senderName
          ? `${senderName} replied about ${listingTitle}.`
          : `You received a reply about ${listingTitle}.`,
      };

    case NOTIFICATION_EVENT_TYPES.ADMIN_REPLIED:
      return {
        title: pushCopy.title,
        body: pushCopy.body,
      };

    default:
      return null;
  }
}
