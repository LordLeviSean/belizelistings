export const AGENT_UPGRADE_REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

export const AGENT_UPGRADE_TOAST = Object.freeze({
  SUBMITTED_TITLE: "Agent upgrade request submitted",
  SUBMITTED_BODY:
    "Your request has been sent to the BelizeListings team for review. We'll notify you when a decision is made.",
  SUBMITTED:
    "Agent upgrade request submitted\nYour request has been sent to the BelizeListings team for review. We'll notify you when a decision is made.",
  APPROVED: "Your Agent account has been approved.",
  REJECTED: "Your Agent upgrade request was not approved at this time.",
  DUPLICATE: "You already have a pending Agent upgrade request.",
  SUBMIT_ERROR: "Unable to submit your upgrade request. Please try again.",
});

export const AGENT_UPGRADE_ADMIN_TOAST = Object.freeze({
  APPROVED: "Agent access granted.",
  REJECTED: "Upgrade request rejected.",
  ACTION_ERROR: "Unable to process that upgrade request.",
});

/** Admin NotificationCenter detail — {username} replaced at runtime. */
export function formatAdminAgentUpgradeNotification(username) {
  const label = String(username || "A user").trim() || "A user";
  return `Agent Upgrade Request: ${label} has requested Agent access.`;
}
