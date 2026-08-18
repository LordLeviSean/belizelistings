/** @jest-environment jsdom */

jest.mock("../supabaseClient", () => ({ supabase: {} }));

jest.mock("../featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_INQUIRIES: true,
  BL_ENABLE_VIEWING_PERSIST: true,
}));

jest.mock("../crm/useConversationMessagesRealtime", () => ({
  useConversationMessagesRealtime: jest.fn(),
}));

jest.mock("../crm/conversationMutations", () => ({
  conversationPreviewText: (conv) => conv?.last_message_body || "Preview",
  deleteConversationForBuyer: jest.fn(),
  fetchConversationForParticipantById: jest.fn(),
  fetchConversationMessages: jest.fn().mockResolvedValue({
    data: [{ id: "msg-1", sender_role: "agent", body: "Agent reply", created_at: "2026-08-11T17:00:00Z" }],
    error: null,
  }),
  isBuyerConversationUnread: () => true,
  markConversationReadByBuyer: jest.fn().mockResolvedValue({ error: null }),
  sendBuyerReply: jest.fn(),
}));

jest.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

import React, { Component, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import UserInboxPanel from "../../components/inquiry/UserInboxPanel";
import { useParticipantEntityDeepLinkResolve } from "../../hooks/useParticipantEntityDeepLinkResolve";
import { conversationListIncludesId } from "../crm/conversationDeepLink";
import {
  applyParticipantDeepLinkCrmResult,
  resolveAdminOwnerConversationDeepLinkId,
} from "../crm/conversationCrmShape";
import { isBuyerConversationUnread } from "../crm/conversationMutations";
import { ADMIN_DASHBOARD_TAB_IDS } from "../../constants/dashboardAdminConfig";

class CaptureErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <div data-testid="captured-error">{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

function AdminInboxTabCountsHarness({ buyerConversations }) {
  const tabCounts = useMemo(() => {
    const counts = {};
    const inboxUnread = (buyerConversations ?? []).filter((conv) =>
      isBuyerConversationUnread(conv)
    ).length;
    if (inboxUnread > 0) {
      counts[ADMIN_DASHBOARD_TAB_IDS.INBOX] = inboxUnread;
    }
    return counts;
  }, [buyerConversations]);

  return <div data-testid="tab-count">{tabCounts.inbox ?? 0}</div>;
}

function AdminBuyerDeepLinkHarness({ fetchById, malformedResult = false }) {
  const [conversations, setConversations] = React.useState([]);
  const [listingsById, setListingsById] = React.useState({});

  const handleFetched = React.useCallback((result) => {
    applyParticipantDeepLinkCrmResult(result, {
      onConversations: setConversations,
      onListingsById: (map) => setListingsById((prev) => ({ ...prev, ...map })),
    });
    if (malformedResult) {
      setConversations(undefined);
    }
  }, [malformedResult]);

  const resolveState = useParticipantEntityDeepLinkResolve({
    enabled: true,
    participantUserId: "admin-buyer-1",
    entityId: "4308dd99-5903-41f5-b504-a201c98c5c62",
    listLoading: false,
    listIncludesTarget: conversationListIncludesId,
    getListSnapshot: () => conversations,
    getListingsByIdSnapshot: () => listingsById,
    fetchById,
    onFetched: handleFetched,
  });

  const ownerDeepLinkConversationId = resolveAdminOwnerConversationDeepLinkId({
    deepLinkConversationId: "4308dd99-5903-41f5-b504-a201c98c5c62",
    buyerDeepLinkResolveState: resolveState,
  });

  return (
    <>
      <AdminInboxTabCountsHarness buyerConversations={conversations} />
      <UserInboxPanel
        conversations={conversations ?? []}
        listingsById={listingsById}
        buyerUserId="admin-buyer-1"
        initialConversationId="4308dd99-5903-41f5-b504-a201c98c5c62"
        deepLinkResolveState={resolveState}
      />
      <div data-testid="owner-deep-link">{ownerDeepLinkConversationId ?? "none"}</div>
    </>
  );
}

function renderWithBoundary(node) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<CaptureErrorBoundary>{node}</CaptureErrorBoundary>);
  });
  return container;
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("admin-as-buyer inbox regression", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = "";
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    window.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
    window.cancelAnimationFrame = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
  });

  test("tabCounts survives undefined buyerConversations state", () => {
    const container = renderWithBoundary(
      <AdminInboxTabCountsHarness buyerConversations={undefined} />
    );
    expect(container.querySelector('[data-testid="captured-error"]')).toBeNull();
    expect(container.querySelector('[data-testid="tab-count"]')?.textContent).toBe("0");
  });

  test("UserInboxPanel renders agent reply with malformed pipeline_stage from by-ID row", async () => {
    const container = renderWithBoundary(
      <UserInboxPanel
        conversations={[
          {
            id: "4308dd99-5903-41f5-b504-a201c98c5c62",
            listing_id: 108,
            buyer_id: "admin-buyer-1",
            agent_id: "agent-1",
            updated_at: "2026-08-18T17:00:00Z",
            created_at: "2026-08-18T16:00:00Z",
            buyer_unread: true,
            last_message_body: "Thanks for the reply",
            pipeline_stage: { bad: true },
            listing_inquiries: { inquiry_type: "general", pipeline_stage: "responded" },
          },
        ]}
        listingsById={{ 108: { title: "Finca Solana" } }}
        buyerUserId="admin-buyer-1"
        initialConversationId="4308dd99-5903-41f5-b504-a201c98c5c62"
        deepLinkResolveState="resolved"
      />
    );

    await flushPromises();

    expect(container.querySelector('[data-testid="captured-error"]')).toBeNull();
    expect(container.textContent).toMatch(/Thanks for the reply/i);
  });

  test("admin buyer deep link resolves enriched row and suppresses owner deep link", async () => {
    const fetchById = jest.fn(async () => ({
      outcome: "resolved",
      fetched: true,
      conversations: [
        {
          id: "4308dd99-5903-41f5-b504-a201c98c5c62",
          listing_id: 108,
          buyer_id: "admin-buyer-1",
          agent_id: "agent-1",
          pipeline_stage: { bad: true },
          listing_inquiries: { inquiry_type: "general", pipeline_stage: "responded" },
          last_message_body: "Agent reply",
          updated_at: "2026-08-18T17:00:00Z",
        },
      ],
      listingsById: { 108: { title: "Finca Solana" } },
    }));

    const container = renderWithBoundary(<AdminBuyerDeepLinkHarness fetchById={fetchById} />);
    await flushPromises();

    expect(fetchById).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="captured-error"]')).toBeNull();
    expect(container.textContent).toMatch(/Agent reply/i);
    expect(container.textContent).toMatch(/Finca Solana/i);
    expect(container.querySelector('[data-testid="owner-deep-link"]')?.textContent).toBe("none");
  });

  test("applyParticipantDeepLinkCrmResult ignores undefined conversations payloads", () => {
    const onConversations = jest.fn();
    applyParticipantDeepLinkCrmResult({ conversations: undefined, listingsById: {} }, {
      onConversations,
    });
    expect(onConversations).not.toHaveBeenCalled();
  });
});
