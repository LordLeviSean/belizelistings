import { buildPushPayload } from "./pushPayload";

/**
 * @param {string} userId
 * @param {string} [role]
 */
export function resolvePushTestDestination(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "agent") return "/dashboard/agent?tab=profile";
  if (
    normalized === "broker" ||
    normalized === "brokerage" ||
    normalized === "property_manager"
  ) {
    return "/dashboard/broker";
  }
  return "/dashboard/user?tab=profile";
}

/**
 * Fixed safe test notification payload for authenticated self-delivery.
 * @param {{ userId: string, role?: string, notificationId?: string }} params
 */
export function buildPushTestPayload({ userId, role, notificationId }) {
  const id =
    notificationId ||
    `push-test-${String(userId).slice(0, 8)}-${Date.now().toString(36)}`;

  return buildPushPayload({
    notificationId: id,
    eventType: "push_test",
    title: "BelizeListings notifications are active",
    body: "This device can now receive important BelizeListings updates.",
    href: resolvePushTestDestination(role),
    tag: "push_test",
  });
}
