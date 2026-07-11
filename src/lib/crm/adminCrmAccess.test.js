/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_INQUIRIES: true,
  BL_ENABLE_VIEWING_PERSIST: true,
}));

import { getVisibleAdminDashboardTabs, normalizeAdminDashboardTab } from "../../constants/dashboardAdminConfig";
import { fetchConversationsForAgent } from "./conversationMutations";
import { fetchConversationsForBuyer } from "./conversationMutations";
import { fetchViewingsForAgent } from "./viewingMutations";
import { fetchViewingsForBuyer } from "./viewingMutations";

describe("admin CRM access", () => {
  test("normalizeAdminDashboardTab accepts buyer and owner CRM tabs", () => {
    expect(normalizeAdminDashboardTab("messages")).toBe("messages");
    expect(normalizeAdminDashboardTab("owner-viewings")).toBe("owner-viewings");
    expect(normalizeAdminDashboardTab("unknown")).toBe("pending");
  });

  test("visible admin tabs include buyer and owner CRM surfaces when flags enabled", () => {
    const tabs = getVisibleAdminDashboardTabs();
    const ids = tabs.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining(["messages", "my-viewings", "owner-inbox", "owner-viewings"])
    );
    expect(ids).not.toContain("my-inquiries");
  });

  test("fetchConversationsForAgent scopes by listing owner agent_id", () => {
    const limit = jest.fn().mockReturnThis();
    const is = jest.fn().mockReturnThis();
    const order = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnValue({ order, limit, is });
    const select = jest.fn().mockReturnValue({ eq });
    const client = { from: jest.fn().mockReturnValue({ select }) };

    fetchConversationsForAgent(client, "owner-user-id");

    expect(client.from).toHaveBeenCalledWith("conversations");
    expect(eq).toHaveBeenCalledWith("agent_id", "owner-user-id");
  });

  test("fetchConversationsForBuyer scopes by buyer_id for admin marketplace sends", () => {
    const limit = jest.fn().mockReturnThis();
    const is = jest.fn().mockReturnThis();
    const order = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnValue({ order, limit, is });
    const select = jest.fn().mockReturnValue({ eq });
    const client = { from: jest.fn().mockReturnValue({ select }) };

    fetchConversationsForBuyer(client, "admin-buyer-id");

    expect(eq).toHaveBeenCalledWith("buyer_id", "admin-buyer-id");
  });

  test("fetchViewingsForAgent and fetchViewingsForBuyer use participant ids", () => {
    const agentLimit = jest.fn().mockReturnThis();
    const agentIs = jest.fn().mockReturnThis();
    const agentOrder = jest.fn().mockReturnThis();
    const agentEq = jest.fn().mockReturnValue({ order: agentOrder, limit: agentLimit, is: agentIs });
    const agentSelect = jest.fn().mockReturnValue({ eq: agentEq });

    const buyerLimit = jest.fn().mockReturnThis();
    const buyerIs = jest.fn().mockReturnThis();
    const buyerOrder = jest.fn().mockReturnThis();
    const buyerEq = jest.fn().mockReturnValue({ order: buyerOrder, limit: buyerLimit, is: buyerIs });
    const buyerSelect = jest.fn().mockReturnValue({ eq: buyerEq });

    const client = {
      from: jest
        .fn()
        .mockReturnValueOnce({ select: agentSelect })
        .mockReturnValueOnce({ select: buyerSelect }),
    };

    fetchViewingsForAgent(client, "owner-1");
    fetchViewingsForBuyer(client, "admin-1");

    expect(agentEq).toHaveBeenCalledWith("agent_user_id", "owner-1");
    expect(buyerEq).toHaveBeenCalledWith("requester_id", "admin-1");
  });
});
