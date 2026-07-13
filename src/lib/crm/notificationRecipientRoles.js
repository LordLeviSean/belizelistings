/**
 * Resolve dashboard recipient_role and recipient_side for notification deep links.
 */
export function isListingOwnerRecipient(recipientId, listingOwnerUserId) {
  if (!recipientId || !listingOwnerUserId) return false;
  return String(recipientId) === String(listingOwnerUserId);
}

/**
 * @param {'agent'|'user'|'admin'} [ownerDashboardRole] — when listing owner uses agent dashboard
 */
export function withNotificationRecipientRole(recipientId, parties = {}, payload = {}) {
  const listingOwnerId = parties.agentUserId ?? parties.listingOwnerUserId;
  const requesterId = parties.requesterId;

  if (isListingOwnerRecipient(recipientId, listingOwnerId)) {
    const isAgentDashboard = parties.ownerDashboardRole === "agent";
    return {
      ...payload,
      recipient_role: isAgentDashboard ? "agent" : "user",
      recipient_side: isAgentDashboard ? "agent" : "owner",
    };
  }

  if (requesterId && String(recipientId) === String(requesterId)) {
    return {
      ...payload,
      recipient_role: "user",
      recipient_side: "buyer",
    };
  }

  const role = String(payload.recipient_role || parties.fallbackRole || "user").toLowerCase();
  return {
    ...payload,
    recipient_role: role,
    recipient_side: payload.recipient_side || (role === "agent" ? "agent" : "buyer"),
  };
}

/** @deprecated use isListingOwnerRecipient */
export function isAgentRecipient(recipientId, agentUserId) {
  return isListingOwnerRecipient(recipientId, agentUserId);
}

export function notificationRecipientRole(side) {
  if (side === "agent") return "agent";
  if (side === "admin") return "admin";
  return "user";
}
