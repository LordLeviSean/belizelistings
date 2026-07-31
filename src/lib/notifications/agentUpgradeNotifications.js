import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";

/**
 * @param {{ upgradeRequestId: string, requesterName?: string|null, recipientRole?: string }} params
 */
export function buildAgentUpgradeSubmittedNotificationPayload({
  upgradeRequestId,
  recipientRole = "user",
}) {
  const id = String(upgradeRequestId || "").trim();
  return {
    eventType: NOTIFICATION_EVENT_TYPES.AGENT_UPGRADE_SUBMITTED,
    payload: {
      upgrade_request_id: id,
      recipient_role: recipientRole,
      dedupe_key: `agent_upgrade_submitted:${id}`,
    },
  };
}

/**
 * @param {{ upgradeRequestId: string, requesterName?: string|null, recipientRole?: string }} params
 */
export function buildAgentUpgradeRequestedNotificationPayload({
  upgradeRequestId,
  requesterName = "A user",
  recipientRole = "admin",
}) {
  const id = String(upgradeRequestId || "").trim();
  return {
    eventType: NOTIFICATION_EVENT_TYPES.AGENT_UPGRADE_REQUESTED,
    payload: {
      upgrade_request_id: id,
      requester_name: String(requesterName || "A user").trim() || "A user",
      recipient_role: recipientRole,
      dedupe_key: `agent_upgrade_requested:${id}`,
    },
  };
}

export function resolveAgentUpgradeAdminNotificationHref(upgradeRequestId) {
  const id = String(upgradeRequestId || "").trim();
  if (!id) return "/admin?tab=upgrades";
  return `/admin?tab=upgrades&request=${encodeURIComponent(id)}`;
}

export function resolveAgentUpgradeUserNotificationHref() {
  return "/dashboard/user";
}

/**
 * @param {{ upgradeRequestId: string, recipientRole?: string }} params
 */
export function buildAgentUpgradeApprovedNotificationPayload({
  upgradeRequestId,
  recipientRole = "user",
}) {
  const id = String(upgradeRequestId || "").trim();
  return {
    eventType: NOTIFICATION_EVENT_TYPES.AGENT_UPGRADE_APPROVED,
    payload: {
      upgrade_request_id: id,
      recipient_role: recipientRole,
      dedupe_key: `agent_upgrade_approved:${id}`,
    },
  };
}

/**
 * @param {{ upgradeRequestId: string, recipientRole?: string }} params
 */
export function buildAgentUpgradeDeclinedNotificationPayload({
  upgradeRequestId,
  recipientRole = "user",
}) {
  const id = String(upgradeRequestId || "").trim();
  return {
    eventType: NOTIFICATION_EVENT_TYPES.AGENT_UPGRADE_DECLINED,
    payload: {
      upgrade_request_id: id,
      recipient_role: recipientRole,
      dedupe_key: `agent_upgrade_declined:${id}`,
    },
  };
}

export function resolveAgentUpgradeApprovedNotificationHref() {
  return "/dashboard/agent";
}
