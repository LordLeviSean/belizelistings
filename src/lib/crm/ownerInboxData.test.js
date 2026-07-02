/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_VIEWING_PERSIST: true,
}));

jest.mock("./conversationMutations", () => ({
  fetchConversationsForAgent: jest.fn(),
}));

jest.mock("./viewingMutations", () => ({
  fetchViewingsForAgent: jest.fn(),
}));

import { fetchConversationsForAgent } from "./conversationMutations";
import { fetchViewingsForAgent } from "./viewingMutations";
import { loadOwnerInboxData } from "./ownerInboxData";

describe("loadOwnerInboxData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loads agent conversations and enriches listing titles from conversation listing ids", async () => {
    fetchConversationsForAgent.mockResolvedValue({
      data: [{ id: "conv-1", listing_id: 42, agent_id: "owner-1", buyer_id: "admin-buyer" }],
      error: null,
    });
    fetchViewingsForAgent.mockResolvedValue({ data: [], error: null });

    const inMock = jest.fn().mockResolvedValue({
      data: [{ id: 42, title: "Seafront Villa" }],
      error: null,
    });
    const eqMock = jest.fn().mockResolvedValue({ data: [], error: null });
    const fromMock = jest.fn((table) => {
      if (table !== "listings") return {};
      return {
        select: jest.fn().mockReturnValue({
          eq: eqMock,
          in: inMock,
        }),
      };
    });

    const client = { from: fromMock };
    const result = await loadOwnerInboxData(client, "owner-1");

    expect(fetchConversationsForAgent).toHaveBeenCalledWith(client, "owner-1");
    expect(result.conversations).toHaveLength(1);
    expect(result.listingsById[42]?.title).toBe("Seafront Villa");
    expect(inMock).toHaveBeenCalledWith("id", [42]);
  });

  test("returns empty payload when ownerUserId missing", async () => {
    const result = await loadOwnerInboxData(null, null);
    expect(result.conversations).toEqual([]);
    expect(fetchConversationsForAgent).not.toHaveBeenCalled();
  });
});
