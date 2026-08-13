/** @jest-environment jsdom */

jest.mock("../../lib/featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
}));

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {},
}));

jest.mock("../../lib/crm/useConversationMessagesRealtime", () => ({
  useConversationMessagesRealtime: jest.fn(),
}));

jest.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("../../lib/crm/conversationMutations", () => ({
  conversationPreviewText: () => "Preview",
  deleteConversationForAgent: jest.fn(),
  fetchConversationMessages: jest.fn().mockResolvedValue({ data: [], error: null }),
  isAgentConversationUnread: () => false,
  markConversationReadByAgent: jest.fn(),
  sendAgentReply: jest.fn(),
}));

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import OwnerInquiriesPanel from "./OwnerInquiriesPanel";

function mount(node) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return { container, root };
}

describe("OwnerInquiriesPanel deep-link routing", () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  });

  test("does not show empty state when initialConversationId is set and list is empty", () => {
    const { container } = mount(
      <OwnerInquiriesPanel
        conversations={[]}
        listingsById={{}}
        agentUserId="agent-1"
        initialConversationId="conv-target"
        deepLinkResolveState="loading"
        crmLoading={false}
      />
    );

    expect(container.textContent).not.toMatch(/Open listing editor/i);
    expect(container.querySelector('[aria-label="Opening conversation"]')).toBeTruthy();
  });

  test("shows missing state when deep link cannot resolve", () => {
    const { container } = mount(
      <OwnerInquiriesPanel
        conversations={[]}
        listingsById={{}}
        agentUserId="agent-1"
        initialConversationId="conv-gone"
        deepLinkResolveState="missing"
        crmLoading={false}
      />
    );

    expect(container.textContent).toMatch(/no longer available/i);
  });

  test("shows retryable error copy when fetch fails", () => {
    const { container } = mount(
      <OwnerInquiriesPanel
        conversations={[]}
        listingsById={{}}
        agentUserId="agent-1"
        initialConversationId="conv-target"
        deepLinkResolveState="error"
        crmLoading={false}
      />
    );

    expect(container.textContent).toMatch(/Unable to load this conversation right now/i);
    expect(container.textContent).not.toMatch(/no longer available/i);
  });

  test("does not fall back to first conversation when deep link target is pending", async () => {
    const { container } = mount(
      <OwnerInquiriesPanel
        conversations={[{ id: "conv-other", listing_id: 1 }]}
        listingsById={{ 1: { title: "Other listing" } }}
        agentUserId="agent-1"
        initialConversationId="conv-target"
        deepLinkResolveState="loading"
        crmLoading={false}
      />
    );

    expect(container.textContent).not.toMatch(/Other listing/);
  });
});
