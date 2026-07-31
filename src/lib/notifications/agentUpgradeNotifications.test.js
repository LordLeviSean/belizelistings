import {
  buildAgentUpgradeRequestedNotificationPayload,
  buildAgentUpgradeSubmittedNotificationPayload,
  resolveAgentUpgradeAdminNotificationHref,
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
});
