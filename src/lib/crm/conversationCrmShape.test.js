/** @jest-environment node */

import {
  applyParticipantDeepLinkCrmResult,
  formatPipelineStageLabel,
  normalizeConversationCrmRow,
  resolveAdminOwnerConversationDeepLinkId,
} from "./conversationCrmShape";

describe("conversationCrmShape", () => {
  test("formatPipelineStageLabel formats strings and coerces non-strings", () => {
    expect(formatPipelineStageLabel("responded")).toBe("responded");
    expect(formatPipelineStageLabel("new_inquiry")).toBe("new inquiry");
    expect(formatPipelineStageLabel({ stage: "responded" })).toBe("[object Object]");
    expect(formatPipelineStageLabel(null)).toBe("Open");
  });

  test("normalizeConversationCrmRow coerces pipeline_stage from inquiry embed", () => {
    const row = normalizeConversationCrmRow({
      id: "conv-1",
      pipeline_stage: { bad: true },
      listing_inquiries: { pipeline_stage: "responded", inquiry_type: "general" },
    });

    expect(row.pipeline_stage).toBe("responded");
  });

  test("applyParticipantDeepLinkCrmResult ignores malformed conversation arrays", () => {
    const onConversations = jest.fn();
    applyParticipantDeepLinkCrmResult({ conversations: undefined }, { onConversations });
    expect(onConversations).not.toHaveBeenCalled();

    applyParticipantDeepLinkCrmResult(
      {
        conversations: [
          {
            id: "conv-1",
            pipeline_stage: 1,
            listing_inquiries: { pipeline_stage: "responded" },
          },
        ],
      },
      { onConversations }
    );
    expect(onConversations).toHaveBeenCalledWith([
      expect.objectContaining({ id: "conv-1", pipeline_stage: "responded" }),
    ]);
  });

  test("resolveAdminOwnerConversationDeepLinkId suppresses owner deep link for buyer CRM", () => {
    expect(
      resolveAdminOwnerConversationDeepLinkId({
        deepLinkConversationId: "4308dd99-5903-41f5-b504-a201c98c5c62",
        buyerDeepLinkResolveState: "resolved",
      })
    ).toBeNull();

    expect(
      resolveAdminOwnerConversationDeepLinkId({
        deepLinkConversationId: "4308dd99-5903-41f5-b504-a201c98c5c62",
        buyerDeepLinkResolveState: "missing",
      })
    ).toBe("4308dd99-5903-41f5-b504-a201c98c5c62");
  });
});
