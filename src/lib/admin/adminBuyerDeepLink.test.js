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

jest.mock("../crm/useViewingsRealtime", () => ({
  useViewingsRealtime: jest.fn(),
}));

jest.mock("../crm/conversationMutations", () => ({
  conversationPreviewText: (conv) => conv?.last_message_body || "Preview",
  deleteConversationForBuyer: jest.fn(),
  fetchConversationMessages: jest.fn().mockResolvedValue({
    data: [{ id: "msg-1", sender_role: "agent", body: "Agent reply", created_at: "2026-08-11T17:00:00Z" }],
    error: null,
  }),
  isBuyerConversationUnread: () => false,
  markConversationReadByBuyer: jest.fn().mockResolvedValue({ error: null }),
  sendBuyerReply: jest.fn(),
}));

jest.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("../crm/viewingMutations", () => ({
  archiveViewing: jest.fn(),
  cancelViewing: jest.fn(),
  deleteViewing: jest.fn(),
  proposeViewingReschedule: jest.fn(),
  acceptViewingReschedule: jest.fn(),
  rejectViewingReschedule: jest.fn(),
}));

import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import UserInboxPanel from "../../components/inquiry/UserInboxPanel";
import BuyerViewingsPanel from "../../components/inquiry/BuyerViewingsPanel";
import { useParticipantEntityDeepLinkResolve } from "../../hooks/useParticipantEntityDeepLinkResolve";
import { conversationListIncludesId } from "../crm/conversationDeepLink";
import { viewingListIncludesId } from "../crm/viewingDeepLink";
import {
  readDashboardQueryParam,
  resolveDashboardLocationQuery,
  resolveDashboardTabFromIntent,
} from "../dashboard/dashboardIntent";
import { resolveAdminDashboardTabFromQuery } from "../dashboardCrmRoutes";
import { ADMIN_DASHBOARD_TAB_IDS } from "../../constants/dashboardAdminConfig";
import { resolveVisibleAdminDashboardTab } from "../../constants/dashboardAdminConfig";
import listStyles from "../../components/inquiry/AgentInquiryList.module.css";

function AdminBuyerConversationHarness({
  participantUserId = "admin-buyer-1",
  entityId = "conv-admin-target",
  listLoading = false,
  initialList = [],
  fetchById,
}) {
  const [conversations, setConversations] = useState(initialList);
  const [listingsById, setListingsById] = useState({});

  const handleFetched = useCallback((result) => {
    if (result.conversations) setConversations(result.conversations);
    if (result.listingsById) {
      setListingsById((prev) => ({ ...prev, ...result.listingsById }));
    }
  }, []);

  const resolveState = useParticipantEntityDeepLinkResolve({
    enabled: Boolean(participantUserId && entityId),
    participantUserId,
    entityId,
    listLoading,
    listIncludesTarget: conversationListIncludesId,
    getListSnapshot: () => conversations,
    getListingsByIdSnapshot: () => listingsById,
    fetchById,
    onFetched: handleFetched,
  });

  return (
    <UserInboxPanel
      conversations={conversations}
      listingsById={listingsById}
      buyerUserId={participantUserId}
      initialConversationId={entityId}
      deepLinkResolveState={resolveState}
      crmLoading={listLoading}
    />
  );
}

function AdminBuyerViewingHarness({
  participantUserId = "admin-buyer-1",
  entityId = "view-admin-target",
  listLoading = false,
  initialList = [],
  fetchById,
}) {
  const [viewings, setViewings] = useState(initialList);
  const [listingsById, setListingsById] = useState({});

  const handleFetched = useCallback((result) => {
    if (result.viewings) setViewings(result.viewings);
    if (result.listingsById) {
      setListingsById((prev) => ({ ...prev, ...result.listingsById }));
    }
  }, []);

  const resolveState = useParticipantEntityDeepLinkResolve({
    enabled: Boolean(participantUserId && entityId),
    participantUserId,
    entityId,
    listLoading,
    listIncludesTarget: viewingListIncludesId,
    getListSnapshot: () => viewings,
    getListingsByIdSnapshot: () => listingsById,
    fetchById,
    onFetched: handleFetched,
  });

  return (
    <BuyerViewingsPanel
      viewings={viewings}
      listingsById={listingsById}
      buyerUserId={participantUserId}
      initialViewingId={entityId}
      deepLinkResolveState={resolveState}
      crmLoading={listLoading}
    />
  );
}

function renderHarness(node) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return { container, root };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("admin buyer CRM deep-link parity", () => {
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

  test("admin tab inference uses conversation and viewing entity params", () => {
    expect(resolveAdminDashboardTabFromQuery({ conversation: "conv-1" })).toBe(
      ADMIN_DASHBOARD_TAB_IDS.INBOX
    );
    expect(resolveAdminDashboardTabFromQuery({ viewing: "123" })).toBe(
      ADMIN_DASHBOARD_TAB_IDS.VIEWINGS
    );
  });

  test("admin location query reads entity params before router is ready", () => {
    window.history.pushState({}, "", "/admin?tab=inbox&conversation=conv-admin-1");
    const router = { isReady: false, query: {} };

    expect(readDashboardQueryParam(router, "conversation")).toBe("conv-admin-1");
    expect(resolveAdminDashboardTabFromQuery(resolveDashboardLocationQuery(router))).toBe(
      ADMIN_DASHBOARD_TAB_IDS.INBOX
    );
  });

  test("explicit URL conversation beats stale empty router query", () => {
    window.history.pushState({}, "", "/admin?conversation=conv-url-wins");
    const router = { isReady: true, query: { tab: "pending" } };
    const locationQuery = resolveDashboardLocationQuery(router);
    const visibleTabs = [{ id: ADMIN_DASHBOARD_TAB_IDS.PENDING }, { id: ADMIN_DASHBOARD_TAB_IDS.INBOX }];

    expect(readDashboardQueryParam(router, "conversation")).toBe("conv-url-wins");
    expect(
      resolveDashboardTabFromIntent({
        locationQuery,
        inferTabFromQuery: resolveAdminDashboardTabFromQuery,
        resolveVisibleTab: resolveVisibleAdminDashboardTab,
        visibleTabs,
        entityTabMap: {
          conversation: ADMIN_DASHBOARD_TAB_IDS.INBOX,
          viewing: ADMIN_DASHBOARD_TAB_IDS.VIEWINGS,
          listing: ADMIN_DASHBOARD_TAB_IDS.LISTINGS,
        },
        defaultTab: ADMIN_DASHBOARD_TAB_IDS.PENDING,
      })
    ).toBe(ADMIN_DASHBOARD_TAB_IDS.INBOX);
  });

  test("admin conversation absent from list resolves by id", async () => {
    const fetchById = jest.fn(async () => ({
      outcome: "resolved",
      fetched: true,
      conversations: [{ id: "conv-admin-target", listing_id: 9 }],
      listingsById: { 9: { title: "Admin Buyer Listing" } },
    }));

    const { container } = renderHarness(
      <AdminBuyerConversationHarness fetchById={fetchById} />
    );
    await flushPromises();

    expect(fetchById).toHaveBeenCalled();
    expect(container.textContent).toMatch(/Admin Buyer Listing/i);
    expect(container.textContent).not.toMatch(/Select a conversation/i);
    expect(container.textContent).toMatch(/Agent reply/i);
  });

  test("admin conversation missing shows unavailable copy", async () => {
    const fetchById = jest.fn(async () => ({
      outcome: "missing",
      fetched: true,
      error: null,
    }));

    const { container } = renderHarness(
      <AdminBuyerConversationHarness fetchById={fetchById} />
    );
    await flushPromises();

    expect(container.textContent).toMatch(/no longer available/i);
  });

  test("admin conversation fetch error shows retryable copy", async () => {
    const fetchById = jest.fn(async () => ({
      outcome: "error",
      fetched: true,
      error: { message: "network failure" },
    }));

    const { container } = renderHarness(
      <AdminBuyerConversationHarness fetchById={fetchById} />
    );
    await flushPromises();

    expect(container.textContent).toMatch(/Unable to load this conversation right now/i);
    expect(container.textContent).not.toMatch(/no longer available/i);
  });

  test("admin viewing absent from list resolves by id", async () => {
    const fetchById = jest.fn(async () => ({
      outcome: "resolved",
      fetched: true,
      viewings: [
        {
          id: "view-admin-target",
          listing_id: 42,
          status: "confirmed",
          requested_date: "2026-08-01",
          requested_time: "10:00",
        },
      ],
      listingsById: { 42: { title: "Admin Buyer Viewing" } },
    }));

    const { container } = renderHarness(
      <AdminBuyerViewingHarness fetchById={fetchById} />
    );
    await flushPromises();

    expect(fetchById).toHaveBeenCalled();
    expect(container.querySelector(`.${listStyles.cardHighlighted}`)).toBeTruthy();
    expect(container.textContent).toMatch(/Confirmed/i);
  });

  test("admin viewing does not fall back to first list item while deep link pending", async () => {
    let resolveFetch;
    const fetchById = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const { container } = renderHarness(
      <AdminBuyerViewingHarness
        entityId="view-target-pending"
        initialList={[{ id: "view-other", status: "pending", requested_date: "2026-07-01" }]}
        fetchById={fetchById}
      />
    );

    expect(container.querySelector('[aria-label="Loading viewing request"]')).toBeTruthy();
    expect(container.querySelector(`.${listStyles.cardHighlighted}`)).toBeNull();

    await act(async () => {
      resolveFetch({
        outcome: "resolved",
        fetched: true,
        viewings: [{ id: "view-target-pending", status: "declined", requested_date: "2026-08-02" }],
        listingsById: {},
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector(`.${listStyles.cardHighlighted}`)).toBeTruthy();
    expect(container.textContent).toMatch(/Declined/i);
  });
});
