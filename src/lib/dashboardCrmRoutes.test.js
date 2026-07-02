/** @jest-environment node */

jest.mock("../constants/dashboardAdminConfig", () => ({
  ADMIN_DASHBOARD_TAB_IDS: {
    MESSAGES: "messages",
    OWNER_INBOX: "owner-inbox",
    OWNER_VIEWINGS: "owner-viewings",
  },
}));

jest.mock("../constants/dashboardUserConfig", () => ({
  USER_DASHBOARD_TAB_IDS: {
    MESSAGES: "messages",
    OWNER_INBOX: "owner-inbox",
    OWNER_VIEWINGS: "owner-viewings",
  },
}));

jest.mock("../constants/dashboardAgentConfig", () => ({
  AGENT_DASHBOARD_TAB_IDS: { INQUIRIES: "inquiries", VIEWINGS: "viewings" },
}));

import {
  resolveDashboardCrmPath,
  resolveOwnerInboxPath,
  resolvePostInquiryMessagesPath,
} from "./dashboardCrmRoutes";

describe("dashboardCrmRoutes", () => {
  test("resolvePostInquiryMessagesPath routes admin buyers to admin messages tab", () => {
    expect(resolvePostInquiryMessagesPath({ role: "admin", conversationId: "conv-1" })).toBe(
      "/admin?tab=messages&conversation=conv-1"
    );
  });

  test("resolvePostInquiryMessagesPath routes platform users to user dashboard", () => {
    expect(resolvePostInquiryMessagesPath({ role: "user", conversationId: "conv-2" })).toBe(
      "/dashboard/user?tab=messages&conversation=conv-2"
    );
  });

  test("resolveOwnerInboxPath routes admin owners to owner inbox", () => {
    expect(resolveOwnerInboxPath({ role: "admin", conversationId: "conv-3" })).toBe(
      "/admin?tab=owner-inbox&conversation=conv-3"
    );
  });

  test("resolveOwnerInboxPath routes agents to inquiries tab", () => {
    expect(resolveOwnerInboxPath({ role: "agent" })).toBe("/dashboard/agent?tab=inquiries");
  });

  test("resolveOwnerInboxPath routes platform user owners to owner inbox", () => {
    expect(resolveOwnerInboxPath({ role: "user", conversationId: "conv-4" })).toBe(
      "/dashboard/user?tab=owner-inbox&conversation=conv-4"
    );
  });

  test("resolveOwnerInboxPath maps viewing tab for platform user owners", () => {
    expect(resolveOwnerInboxPath({ role: "user", tab: "viewings", viewingId: "view-2" })).toBe(
      "/dashboard/user?tab=owner-viewings&viewing=view-2"
    );
  });

  test("resolveDashboardCrmPath supports owner viewing tab on admin", () => {
    expect(
      resolveDashboardCrmPath({ role: "admin", tab: "owner-viewings", viewingId: "view-1" })
    ).toBe("/admin?tab=owner-viewings&viewing=view-1");
  });
});
