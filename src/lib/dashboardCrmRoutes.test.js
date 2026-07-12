/** @jest-environment node */

import {
  resolveNotificationDestination,
  resolveUserDashboardTabFromQuery,
  resolveAgentDashboardTabFromQuery,
} from "./dashboardCrmRoutes";
import { NOTIFICATION_EVENT_TYPES } from "./notifications/notificationEvents";
import { USER_DASHBOARD_TAB_IDS } from "../constants/dashboardUserConfig";
import { AGENT_DASHBOARD_TAB_IDS } from "../constants/dashboardAgentConfig";

describe("dashboardCrmRoutes", () => {
  test("resolveNotificationDestination opens exact conversation for buyer reply", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.AGENT_REPLIED,
      role: "user",
      payload: { conversation_id: "conv-42" },
    });
    expect(href).toBe("/dashboard/user?tab=messages&conversation=conv-42");
  });

  test("resolveNotificationDestination opens exact viewing for buyer viewing events", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
      role: "user",
      payload: { viewing_id: "view-9" },
    });
    expect(href).toBe("/dashboard/user?tab=my-viewings&viewing=view-9");
  });

  test("resolveNotificationDestination routes owner viewing request to agent viewings", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED,
      role: "agent",
      payload: { viewing_id: "view-3", recipient_role: "agent" },
    });
    expect(href).toBe("/dashboard/agent?tab=viewings&viewing=view-3");
  });

  test("resolveNotificationDestination routes agent viewing confirmed to agent viewings", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
      role: "agent",
      payload: { viewing_id: "view-9", recipient_role: "agent" },
    });
    expect(href).toBe("/dashboard/agent?tab=viewings&viewing=view-9");
  });

  test("resolveNotificationDestination routes buyer viewing rescheduled to my-viewings", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_RESCHEDULED,
      role: "user",
      payload: { viewing_id: "view-2", recipient_role: "user" },
    });
    expect(href).toBe("/dashboard/user?tab=my-viewings&viewing=view-2");
  });

  test("resolveUserDashboardTabFromQuery infers messages from conversation param", () => {
    expect(resolveUserDashboardTabFromQuery({ conversation: "c1" })).toBe(
      USER_DASHBOARD_TAB_IDS.MESSAGES
    );
  });

  test("resolveAgentDashboardTabFromQuery infers viewings from viewing param", () => {
    expect(resolveAgentDashboardTabFromQuery({ viewing: "v1" })).toBe(
      AGENT_DASHBOARD_TAB_IDS.VIEWINGS
    );
  });
});
