/** @jest-environment node */

import {
  resolveNotificationDestination,
  resolveUserDashboardTabFromQuery,
  resolveAgentDashboardTabFromQuery,
  resolveAdminDashboardTabFromQuery,
  resolveMessageConversationPath,
  resolveViewingRequestPath,
} from "./dashboardCrmRoutes";
import { NOTIFICATION_EVENT_TYPES } from "./notifications/notificationEvents";
import { USER_DASHBOARD_TAB_IDS } from "../constants/dashboardUserConfig";
import { AGENT_DASHBOARD_TAB_IDS } from "../constants/dashboardAgentConfig";
import { ADMIN_DASHBOARD_TAB_IDS } from "../constants/dashboardAdminConfig";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";

describe("dashboardCrmRoutes", () => {
  test("resolveNotificationDestination opens exact conversation for buyer reply", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.AGENT_REPLIED,
      role: "user",
      payload: { conversation_id: "conv-42", recipient_side: "buyer" },
    });
    expect(href).toBe("/dashboard/user?tab=messages&conversation=conv-42");
  });

  test("resolveNotificationDestination opens owner inbox for owner inquiry", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
      payload: {
        conversation_id: "conv-7",
        recipient_role: "user",
        recipient_side: "owner",
      },
    });
    expect(href).toBe("/dashboard/user?tab=owner-inbox&conversation=conv-7");
  });

  test("resolveNotificationDestination routes schedule_viewing inquiry to owner viewings", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
      payload: {
        inquiry_type: "schedule_viewing",
        viewing_id: "view-1",
        conversation_id: "conv-1",
        recipient_role: "user",
        recipient_side: "owner",
      },
    });
    expect(href).toBe("/dashboard/user?tab=owner-viewings&conversation=conv-1&viewing=view-1");
  });

  test("resolveNotificationDestination opens exact viewing for buyer viewing events", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
      role: "user",
      payload: { viewing_id: "view-9", recipient_side: "buyer" },
    });
    expect(href).toBe("/dashboard/user?tab=my-viewings&viewing=view-9");
  });

  test("resolveNotificationDestination routes owner viewing request to owner-viewings", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED,
      payload: {
        viewing_id: "view-3",
        recipient_role: "user",
        recipient_side: "owner",
      },
    });
    expect(href).toBe("/dashboard/user?tab=owner-viewings&viewing=view-3");
  });

  test("resolveNotificationDestination routes agent viewing request to agent viewings", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED,
      role: "agent",
      payload: { viewing_id: "view-3", recipient_role: "agent", recipient_side: "agent" },
    });
    expect(href).toBe("/dashboard/agent?tab=viewings&viewing=view-3");
  });

  test("resolveNotificationDestination routes agent inquiry to agent inquiries", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
      payload: {
        conversation_id: "conv-55",
        recipient_role: "agent",
        recipient_side: "agent",
      },
    });
    expect(href).toBe("/dashboard/agent?tab=inquiries&conversation=conv-55");
  });

  test("resolveNotificationDestination routes listing rejection to my-listings", () => {
    const href = resolveNotificationDestination({
      eventType: "listing_rejected",
      payload: {
        listing_id: "99",
        to_status: LISTING_LIFECYCLE.REJECTED,
        recipient_role: "user",
      },
    });
    expect(href).toBe("/dashboard/user?tab=my-listings&listing=99");
  });

  test("resolveUserDashboardTabFromQuery infers messages from conversation param", () => {
    expect(resolveUserDashboardTabFromQuery({ conversation: "c1" })).toBe(
      USER_DASHBOARD_TAB_IDS.MESSAGES
    );
  });

  test("resolveUserDashboardTabFromQuery respects explicit owner-viewings tab", () => {
    expect(
      resolveUserDashboardTabFromQuery({ tab: "owner-viewings", viewing: "v1" })
    ).toBe(USER_DASHBOARD_TAB_IDS.OWNER_VIEWINGS);
  });

  test("resolveAgentDashboardTabFromQuery infers viewings from viewing param", () => {
    expect(resolveAgentDashboardTabFromQuery({ viewing: "v1" })).toBe(
      AGENT_DASHBOARD_TAB_IDS.VIEWINGS
    );
  });

  test("resolveAdminDashboardTabFromQuery infers owner viewings from tab param", () => {
    expect(
      resolveAdminDashboardTabFromQuery({ tab: "owner-viewings", viewing: "v2" })
    ).toBe(ADMIN_DASHBOARD_TAB_IDS.OWNER_VIEWINGS);
  });

  test("resolveMessageConversationPath supports admin owner inbox", () => {
    expect(
      resolveMessageConversationPath({ role: "admin", side: "owner", conversationId: "c9" })
    ).toBe("/admin?tab=owner-inbox&conversation=c9");
  });

  test("resolveViewingRequestPath supports platform-user owner viewings", () => {
    expect(
      resolveViewingRequestPath({ role: "user", side: "owner", viewingId: "v4" })
    ).toBe("/dashboard/user?tab=owner-viewings&viewing=v4");
  });
});
