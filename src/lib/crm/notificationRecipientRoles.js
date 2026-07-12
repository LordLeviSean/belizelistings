/**
 * Resolve dashboard recipient_role for notification deep links.
 * @param {'agent'|'buyer'|'user'} side — who receives the notification
 */
export function notificationRecipientRole(side) {
  if (side === "agent") return "agent";
  return "user";
}

/** @param {string|null|undefined} recipientId @param {string|null|undefined} agentUserId */
export function isAgentRecipient(recipientId, agentUserId) {
  if (!recipientId || !agentUserId) return false;
  return String(recipientId) === String(agentUserId);
}

/**
 * Build payload fragment with recipient_role for enqueue.
 * @param {string} recipientId
 * @param {{ agentUserId?: string, requesterId?: string }} parties
 */
export function withNotificationRecipientRole(recipientId, parties = {}, payload = {}) {
  const role = isAgentRecipient(recipientId, parties.agentUserId)
    ? "agent"
    : "user";
  return { ...payload, recipient_role: role };
}
