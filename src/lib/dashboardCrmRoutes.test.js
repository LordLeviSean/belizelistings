/** @jest-environment node */

import {
  resolveBuyerViewingDeepLinkPath,
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
  test("resolveNotificationDestination opens Inbox for buyer reply", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.AGENT_REPLIED,
      role: "user",
      payload: { conversation_id: "conv-42", recipient_side: "buyer" },
    });
    expect(href).toBe("/dashboard/user?tab=inbox&conversation=conv-42");
  });

  test("resolveNotificationDestination opens Inbox for owner message inquiry", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
      payload: {
        conversation_id: "conv-7",
        recipient_role: "user",
        recipient_side: "owner",
      },
    });
    expect(href).toBe("/dashboard/user?tab=inbox&conversation=conv-7");
  });

  test("resolveNotificationDestination routes viewing_requested to Viewings", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED,
      payload: {
        viewing_id: "view-3",
        recipient_role: "user",
        recipient_side: "owner",
      },
    });
    expect(href).toBe("/dashboard/user?tab=viewings&viewing=view-3");
  });

  test("resolveNotificationDestination opens Viewings for buyer viewing events", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
      role: "user",
      payload: { viewing_id: "view-9", recipient_side: "buyer" },
    });
    expect(href).toBe("/dashboard/user?tab=viewings&viewing=view-9");
  });

  test("viewing_confirmed and viewing_declined share canonical buyer viewing href", () => {
    const confirmed = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
      role: "user",
      payload: { viewing_id: "view-shared-1", recipient_side: "buyer" },
    });
    const declined = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED,
      role: "user",
      payload: { viewing_id: "view-shared-1", recipient_side: "buyer" },
    });
    const canonical = resolveBuyerViewingDeepLinkPath("view-shared-1");

    expect(confirmed).toBe("/dashboard/user?tab=viewings&viewing=view-shared-1");
    expect(declined).toBe("/dashboard/user?tab=viewings&viewing=view-shared-1");
    expect(canonical).toBe("/dashboard/user?tab=viewings&viewing=view-shared-1");
  });

  test("resolveNotificationDestination routes agent viewing request to agent Viewings", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED,
      role: "agent",
      payload: { viewing_id: "view-3", recipient_role: "agent", recipient_side: "agent" },
    });
    expect(href).toBe("/dashboard/agent?tab=viewings&viewing=view-3");
  });

  test("resolveNotificationDestination routes agent inquiry to agent Inbox", () => {
    const href = resolveNotificationDestination({
      eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
      payload: {
        conversation_id: "conv-55",
        recipient_role: "agent",
        recipient_side: "agent",
      },
    });
    expect(href).toBe("/dashboard/agent?tab=inbox&conversation=conv-55");
  });

  test("legacy tab query resolves to unified surfaces", () => {
    expect(resolveUserDashboardTabFromQuery({ tab: "messages" })).toBe(USER_DASHBOARD_TAB_IDS.INBOX);
    expect(resolveUserDashboardTabFromQuery({ tab: "my-viewings" })).toBe(USER_DASHBOARD_TAB_IDS.VIEWINGS);
    expect(resolveUserDashboardTabFromQuery({ tab: "viewing-requests" })).toBe(USER_DASHBOARD_TAB_IDS.VIEWINGS);
    expect(resolveAgentDashboardTabFromQuery({ tab: "inquiries" })).toBe(AGENT_DASHBOARD_TAB_IDS.INBOX);
    expect(resolveAgentDashboardTabFromQuery({ tab: "viewing-requests" })).toBe(AGENT_DASHBOARD_TAB_IDS.VIEWINGS);
    expect(resolveAdminDashboardTabFromQuery({ tab: "owner-inbox" })).toBe(ADMIN_DASHBOARD_TAB_IDS.INBOX);
  });

  test("resolveAdminDashboardTabFromQuery opens upgrades for request deep link", () => {
    expect(resolveAdminDashboardTabFromQuery({ request: "cycle-uuid" })).toBe(
      ADMIN_DASHBOARD_TAB_IDS.UPGRADES
    );
  });

  test("resolveAdminDashboardTabFromQuery opens profile tab", () => {
    expect(resolveAdminDashboardTabFromQuery({ tab: "profile" })).toBe(
      ADMIN_DASHBOARD_TAB_IDS.PROFILE
    );
  });

  test("resolveAdminDashboardTabFromQuery infers inbox and viewings from entity params", () => {
    expect(resolveAdminDashboardTabFromQuery({ conversation: "conv-admin-9" })).toBe(
      ADMIN_DASHBOARD_TAB_IDS.INBOX
    );
    expect(resolveAdminDashboardTabFromQuery({ viewing: "108" })).toBe(
      ADMIN_DASHBOARD_TAB_IDS.VIEWINGS
    );
  });

  test("resolveMessageConversationPath uses Inbox tab", () => {
    expect(
      resolveMessageConversationPath({ role: "user", side: "owner", conversationId: "c1" })
    ).toBe("/dashboard/user?tab=inbox&conversation=c1");
  });

  test("resolveViewingRequestPath uses Viewings tab", () => {
    expect(resolveViewingRequestPath({ role: "user", side: "owner", viewingId: "v1" })).toBe(
      "/dashboard/user?tab=viewings&viewing=v1"
    );
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
    expect(href).toContain("my-listings");
  });
});
