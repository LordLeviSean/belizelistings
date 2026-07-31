import {
  buildAgentUpgradeApprovedNotificationPayload,
  buildAgentUpgradeDeclinedNotificationPayload,
  buildAgentUpgradeRequestedNotificationPayload,
  buildAgentUpgradeSubmittedNotificationPayload,
  resolveAgentUpgradeAdminNotificationHref,
  resolveAgentUpgradeApprovedNotificationHref,
  resolveAgentUpgradeUserNotificationHref,
} from "./agentUpgradeNotifications";
import { buildNotificationPresentation } from "./notificationCopyRegistry";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";

describe("agentUpgradeNotifications", () => {
  test("submission payload dedupes by upgrade_request_id", () => {
    const { eventType, payload } = buildAgentUpgradeSubmittedNotificationPayload({
      upgradeRequestId: "cycle-abc",
    });
    expect(eventType).toBe(NOTIFICATION_EVENT_TYPES.AGENT_UPGRADE_SUBMITTED);
    expect(payload.dedupe_key).toBe("agent_upgrade_submitted:cycle-abc");
    expect(payload.upgrade_request_id).toBe("cycle-abc");
  });

  test("admin request payload dedupes per cycle not per user", () => {
    const { payload } = buildAgentUpgradeRequestedNotificationPayload({
      upgradeRequestId: "cycle-abc",
      requesterName: "Jane Doe",
    });
    expect(payload.dedupe_key).toBe("agent_upgrade_requested:cycle-abc");
    expect(payload.requester_name).toBe("Jane Doe");
  });

  test("presentation deep links route to user dashboard and admin upgrades tab", () => {
    const userPres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.AGENT_UPGRADE_SUBMITTED, {
      upgrade_request_id: "cycle-1",
    });
    expect(userPres.href).toBe(resolveAgentUpgradeUserNotificationHref());
    expect(userPres.title).toBe("Agent upgrade request submitted");

    const adminPres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.AGENT_UPGRADE_REQUESTED, {
      upgrade_request_id: "cycle-1",
      requester_name: "Jane Doe",
    });
    expect(adminPres.href).toBe(resolveAgentUpgradeAdminNotificationHref("cycle-1"));
    expect(adminPres.body).toContain("Jane Doe");
  });

  test("distinct cycles produce distinct dedupe keys", () => {
    const a = buildAgentUpgradeSubmittedNotificationPayload({ upgradeRequestId: "cycle-1" }).payload
      .dedupe_key;
    const b = buildAgentUpgradeSubmittedNotificationPayload({ upgradeRequestId: "cycle-2" }).payload
      .dedupe_key;
    expect(a).not.toBe(b);
  });

  test("decline notifications are cycle-specific and do not reuse user_id dedupe", () => {
    const cycle1 = buildAgentUpgradeDeclinedNotificationPayload({ upgradeRequestId: "cycle-1" }).payload
      .dedupe_key;
    const cycle2 = buildAgentUpgradeDeclinedNotificationPayload({ upgradeRequestId: "cycle-2" }).payload
      .dedupe_key;
    expect(cycle1).toBe("agent_upgrade_declined:cycle-1");
    expect(cycle2).toBe("agent_upgrade_declined:cycle-2");
    expect(cycle1).not.toBe(cycle2);
  });

  test("approval presentation links to agent dashboard", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.AGENT_UPGRADE_APPROVED, {
      upgrade_request_id: "cycle-9",
    });
    expect(pres.href).toBe(resolveAgentUpgradeApprovedNotificationHref());
    expect(pres.dedupeKey).toBe("agent_upgrade_approved:cycle-9");
  });

  test("decline presentation links back to user upgrade area", () => {
    const { payload } = buildAgentUpgradeDeclinedNotificationPayload({ upgradeRequestId: "cycle-9" });
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.AGENT_UPGRADE_DECLINED, payload);
    expect(pres.href).toBe(resolveAgentUpgradeUserNotificationHref());
  });
});
