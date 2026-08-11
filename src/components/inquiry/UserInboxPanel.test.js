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
  conversationPreviewText: (conv) => conv?.last_message_body || "Preview",
  deleteConversationForBuyer: jest.fn(),
  fetchConversationMessages: jest.fn().mockResolvedValue({
    data: [{ id: "msg-1", sender_role: "agent", body: "Latest agent reply", created_at: "2026-08-11T17:00:00Z" }],
    error: null,
  }),
  isBuyerConversationUnread: () => true,
  markConversationReadByBuyer: jest.fn().mockResolvedValue({ error: null }),
  sendBuyerReply: jest.fn(),
}));

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import UserInboxPanel from "./UserInboxPanel";

const baseConversation = {
  id: "conv-deep-1",
  listing_id: 42,
  updated_at: "2026-08-11T17:00:00Z",
  created_at: "2026-08-11T16:00:00Z",
  buyer_unread: true,
  last_message_body: "Latest agent reply",
  pipeline_stage: "responded",
};

function mount(node) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return { container, root };
}

describe("UserInboxPanel deep-link routing", () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query.includes("max-width: 900px"),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  });

  test("shows opening state until async conversations resolve deep link", async () => {
    const { container, root } = mount(
      <UserInboxPanel
        conversations={[]}
        listingsById={{ 42: { title: "Beach Cottage" } }}
        buyerUserId="buyer-1"
        initialConversationId="conv-deep-1"
      />
    );

    expect(container.textContent).toMatch(/opening conversation/i);

    await act(async () => {
      root.render(
        <UserInboxPanel
          conversations={[baseConversation]}
          listingsById={{ 42: { title: "Beach Cottage" } }}
          buyerUserId="buyer-1"
          initialConversationId="conv-deep-1"
        />
      );
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Latest agent reply/);
    expect(container.textContent).toMatch(/Conversations/);
    expect(container.querySelector('[aria-label="Your conversations"]')).toBeNull();
  });

  test("preserves deep-link selection instead of falling back to first conversation", async () => {
    const { container } = mount(
      <UserInboxPanel
        conversations={[
          baseConversation,
          {
            ...baseConversation,
            id: "conv-other",
            last_message_body: "Other thread",
          },
        ]}
        listingsById={{ 42: { title: "Beach Cottage" } }}
        buyerUserId="buyer-1"
        initialConversationId="conv-deep-1"
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Latest agent reply/);
    expect(container.textContent).not.toMatch(/Other thread/);
  });
});
