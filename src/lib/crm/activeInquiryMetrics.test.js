/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
}));

jest.mock("./conversationMutations", () => ({
  fetchConversationsForAgent: jest.fn(),
  fetchConversationsForBuyer: jest.fn(),
}));

import { INQUIRY_TYPE } from "./crmConstants";
import { fetchConversationsForAgent, fetchConversationsForBuyer } from "./conversationMutations";
import {
  countActiveInquiryConversations,
  mergeActiveInquiryConversations,
  resolveDashboardActiveInquiryCount,
} from "./activeInquiryMetrics";

const general = (id) => ({
  id,
  listing_inquiries: { inquiry_type: INQUIRY_TYPE.GENERAL },
});

const viewing = (id) => ({
  id,
  listing_inquiries: { inquiry_type: INQUIRY_TYPE.SCHEDULE_VIEWING },
});

describe("activeInquiryMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("one active Inbox conversation = Inquiries 1", () => {
    expect(countActiveInquiryConversations([general("c1")])).toBe(1);
  });

  test("multiple messages still represented by one conversation = 1", () => {
    expect(
      countActiveInquiryConversations([
        { ...general("c1"), last_message_body: "a" },
        { ...general("c1"), last_message_body: "b" },
      ])
    ).toBe(1);
  });

  test("viewing / schedule_viewing threads do not count", () => {
    expect(countActiveInquiryConversations([viewing("v1"), general("c1")])).toBe(1);
    expect(countActiveInquiryConversations([viewing("v1")])).toBe(0);
  });

  test("deleted/archived rows already omitted from input do not count", () => {
    expect(countActiveInquiryConversations([])).toBe(0);
  });

  test("orphaned inquiry rows (no conversation) do not count", () => {
    expect(countActiveInquiryConversations([null, undefined, {}])).toBe(0);
  });

  test("duplicate inquiry rows tied to one conversation count once", () => {
    expect(countActiveInquiryConversations([general("c1"), general("c1")])).toBe(1);
  });

  test("mergeActiveInquiryConversations unions owner and buyer without double count", () => {
    const merged = mergeActiveInquiryConversations(
      [general("owner-1"), viewing("view-1")],
      [general("buyer-1"), general("owner-1")]
    );
    expect(merged.map((c) => c.id).sort()).toEqual(["buyer-1", "owner-1"]);
    expect(countActiveInquiryConversations(merged)).toBe(2);
  });

  test("User and Agent owner inventory share the same owner-side count", async () => {
    fetchConversationsForAgent.mockResolvedValue({
      data: [general("owner-1"), viewing("view-1")],
      error: null,
    });
    fetchConversationsForBuyer.mockResolvedValue({ data: [], error: null });

    const agent = await resolveDashboardActiveInquiryCount({}, "owner-1", {
      includeOwner: true,
      includeBuyer: false,
    });
    const userOwner = await resolveDashboardActiveInquiryCount({}, "owner-1", {
      includeOwner: true,
      includeBuyer: true,
    });

    expect(agent.count).toBe(1);
    expect(userOwner.count).toBe(1);
  });

  test("buyer Inbox conversations add to User KPI without affecting Agent owner count", async () => {
    fetchConversationsForAgent.mockResolvedValue({
      data: [general("owner-1")],
      error: null,
    });
    fetchConversationsForBuyer.mockResolvedValue({
      data: [general("buyer-1")],
      error: null,
    });

    const agent = await resolveDashboardActiveInquiryCount({}, "u1", {
      includeOwner: true,
      includeBuyer: false,
    });
    const user = await resolveDashboardActiveInquiryCount({}, "u1", {
      includeOwner: true,
      includeBuyer: true,
    });

    expect(agent.count).toBe(1);
    expect(user.count).toBe(2);
  });
});
