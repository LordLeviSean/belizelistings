import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useShallow } from "zustand/react/shallow";
import SiteNav from "@/components/SiteNav";
import { DashboardShell, DashboardTabNav, DashboardRoleLayout, DashboardBootstrapShell } from "@/components/dashboard";
import roleLayoutStyles from "@/components/dashboard/DashboardRoleLayout.module.css";
import AgentDashboardMetrics from "@/components/agent/AgentDashboardMetrics";
import AgentDashboardQuickActions from "@/components/agent/AgentDashboardQuickActions";
import AgentBenefitsPanel from "@/components/agent/AgentBenefitsPanel";
import AgentInventoryPanel from "@/components/agent/AgentInventoryPanel";
import { AgentActivityFeed } from "@/components/operational";
import AgentInquiryList from "@/components/inquiry/AgentInquiryList";
import AgentViewingsPanel from "@/components/inquiry/AgentViewingsPanel";
import OwnerInquiriesPanel from "@/components/inquiry/OwnerInquiriesPanel";
import ProfileCompletionPanel from "@/components/profile/ProfileCompletionPanel";
import DeviceNotificationsPanel from "@/components/profile/DeviceNotificationsPanel";
import ProfileCompletionBanner from "@/components/profile/ProfileCompletionBanner";
import useUserRole from "@/hooks/useUserRole";
import { isProfileHydratedForUser } from "@/lib/profileSessionCache";
import { formatWelcomeGreeting } from "@/lib/dashboardGreeting";
import useAgentDashboardStore from "@/stores/useAgentDashboardStore";
import { useAgentDashboardFocusSync } from "@/hooks/useAgentDashboardFocusSync";
import { DASHBOARD_ROLE } from "@/constants/dashboardRoles";
import {
  AGENT_DASHBOARD_COPY,
  AGENT_DASHBOARD_TAB_IDS,
  AGENT_DASHBOARD_TABS,
  AGENT_INVENTORY_FILTERS,
  normalizeAgentDashboardTab,
  USER_DASHBOARD_FINITE_CAP_THRESHOLD,
} from "@/constants/dashboardAgentConfig";
import { INQUIRY_STATUS } from "@/constants/inquiryModel";
import { supabase } from "@/lib/supabaseClient";
import { updateInquiryStatus } from "@/lib/listingInquiries";
import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_VIEWING_PERSIST } from "@/lib/featureFlags";
import { fetchConversationsForAgent } from "@/lib/crm/conversationMutations";
import { filterInboxConversations } from "@/lib/crm/conversationFilters";
import { fetchViewingsForAgent } from "@/lib/crm/viewingMutations";
import { resolveAgentViewingDeepLink } from "@/lib/crm/viewingParticipantDeepLink";
import { conversationListIncludesId } from "@/lib/crm/conversationDeepLink";
import { resolveParticipantConversationDeepLink } from "@/lib/crm/participantConversationDeepLink";
import { viewingListIncludesId } from "@/lib/crm/viewingDeepLink";
import {
  applyAgentConversationLoadResult,
  applyAgentViewingLoadResult,
  beginCrmRequest,
  invalidateCrmRequests,
  isStaleCrmRequest,
} from "@/lib/crm/crmListLoaderUtils";
import { useToast } from "@/components/ui/ToastProvider";
import { resolveAgentDashboardTabFromQuery } from "@/lib/dashboardCrmRoutes";
import useDashboardIntent from "@/hooks/useDashboardIntent";
import { useParticipantEntityDeepLinkResolve } from "@/hooks/useParticipantEntityDeepLinkResolve";
import styles from "@/styles/Dashboard.module.css";
import loadingStyles from "@/styles/UserDashboard.module.css";

function resolveVisibleAgentDashboardTab(raw, visibleTabs) {
  const normalized = normalizeAgentDashboardTab(raw);
  const visibleIds = new Set(visibleTabs.map((tab) => tab.id));
  if (visibleIds.has(normalized)) return normalized;
  return visibleTabs[0]?.id ?? AGENT_DASHBOARD_TAB_IDS.OVERVIEW;
}

export default function AgentDashboard() {
  const router = useRouter();
  const { user, role, loading, profile, tier, welcomePhrase } = useUserRole();
  const { showToast } = useToast();
  const [inquiryBusyId, setInquiryBusyId] = useState("");
  const [conversationRows, setConversationRows] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [agentViewings, setAgentViewings] = useState([]);
  const [viewingsLoading, setViewingsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState(null);
  const [viewingsError, setViewingsError] = useState(null);
  const [deepLinkListingsById, setDeepLinkListingsById] = useState({});
  const conversationsGenerationRef = useRef(0);
  const viewingsGenerationRef = useRef(0);
  const conversationRowsRef = useRef([]);
  const agentViewingsRef = useRef([]);
  const deepLinkConversationIdRef = useRef(null);
  const deepLinkViewingIdRef = useRef(null);
  const [lifecycleFilter, setLifecycleFilter] = useState(AGENT_INVENTORY_FILTERS.ALL);
  const storeSessionRef = useRef(null);
  const dashboardPathRef = useRef(null);

  const {
    activeListings,
    pendingListings,
    archivedListings,
    draftListings,
    rejectedListings,
    inquiriesCount,
    inquiriesRows,
    unreadInquiryCount,
    remainingListings,
    myListingsRows,
  } = useAgentDashboardStore(
    useShallow((s) => ({
      activeListings: s.activeListings,
      pendingListings: s.pendingListings,
      archivedListings: s.archivedListings,
      draftListings: s.draftListings,
      rejectedListings: s.rejectedListings,
      inquiriesCount: s.inquiriesCount,
      inquiriesRows: s.inquiriesRows,
      unreadInquiryCount: s.unreadInquiryCount,
      remainingListings: s.remainingListings,
      myListingsRows: s.myListingsRows,
    }))
  );

  const listingCap = useAgentDashboardStore((s) => s.listingCap);
  const inquiriesUnavailable = useAgentDashboardStore((s) => s.inquiriesUnavailable);
  const metricsLoading = useAgentDashboardStore((s) => s.metricsLoading);
  const myListingsInitialFetchDone = useAgentDashboardStore((s) => s.myListingsInitialFetchDone);

  const visibleTabs = useMemo(
    () =>
      AGENT_DASHBOARD_TABS.filter((tab) => {
        if (tab.crm && tab.id === AGENT_DASHBOARD_TAB_IDS.VIEWINGS && !BL_ENABLE_VIEWING_PERSIST) {
          return false;
        }
        return true;
      }),
    []
  );

  const profileHydrated = Boolean(user?.id && isProfileHydratedForUser(user.id));

  const {
    activeTab,
    showBootstrapShell,
    showHydratingShell,
    bootstrapShellLabel,
    deepLinkViewingId,
    deepLinkConversationId,
  } = useDashboardIntent({
    router,
    expectedRole: "agent",
    user,
    role,
    loading,
    profileHydrated,
    visibleTabs,
    entityTabMap: {
      viewing: AGENT_DASHBOARD_TAB_IDS.VIEWINGS,
      conversation: AGENT_DASHBOARD_TAB_IDS.INBOX,
      listing: AGENT_DASHBOARD_TAB_IDS.LISTINGS,
    },
    inferTabFromQuery: resolveAgentDashboardTabFromQuery,
    resolveVisibleTab: resolveVisibleAgentDashboardTab,
    defaultTab: AGENT_DASHBOARD_TAB_IDS.OVERVIEW,
  });

  const subtitle = useMemo(() => {
    const greet = welcomePhrase || formatWelcomeGreeting(profile);
    return `${greet} · ${AGENT_DASHBOARD_COPY.shellSubtitle}`;
  }, [welcomePhrase, profile]);

  const selectTab = useCallback(
    (tab) => {
      if (normalizeAgentDashboardTab(router.query.tab) === tab) return;
      router.replace(
        { pathname: "/dashboard/agent", query: { ...router.query, tab } },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  useEffect(() => {
    if (loading || !user?.id || role !== "agent") return;
    useAgentDashboardStore.getState().setTier(tier);
  }, [loading, user?.id, role, tier]);

  useAgentDashboardFocusSync(user?.id, role);

  useLayoutEffect(() => {
    const uid = user?.id;
    if (!uid || role !== "agent") {
      if (storeSessionRef.current) {
        useAgentDashboardStore.getState().destroy();
        storeSessionRef.current = null;
      }
      return;
    }
    if (loading && !isProfileHydratedForUser(uid)) return;
    if (storeSessionRef.current === uid) return;
    storeSessionRef.current = uid;
    useAgentDashboardStore.getState().init(uid, role);
  }, [loading, user?.id, role]);

  useEffect(() => {
    return () => {
      if (storeSessionRef.current) {
        useAgentDashboardStore.getState().destroy();
        storeSessionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    dashboardPathRef.current = router.pathname;
    const onRouteDone = (url) => {
      try {
        const path = String(url || "").split("?")[0];
        const prevPath = dashboardPathRef.current;
        dashboardPathRef.current = path;
        if (path !== "/dashboard/agent") return;
        if (prevPath === "/dashboard/agent") return;
        if (role !== "agent" || !user?.id || loading) return;
        useAgentDashboardStore.getState().invalidate({ listings: true });
      } catch {
        /* ignore */
      }
    };
    router.events.on("routeChangeComplete", onRouteDone);
    return () => router.events.off("routeChangeComplete", onRouteDone);
  }, [router.events, router.pathname, role, user?.id, loading]);

  const listingsById = useMemo(() => {
    const m = {};
    for (const row of myListingsRows) {
      if (row?.id != null) m[row.id] = row;
    }
    return { ...m, ...deepLinkListingsById };
  }, [myListingsRows, deepLinkListingsById]);

  const fetchAgentViewingById = useCallback(
    async ({ participantUserId, entityId, list, listingsById: listingsMap }) =>
      resolveAgentViewingDeepLink(supabase, participantUserId, entityId, list, listingsMap),
    []
  );

  const handleAgentViewingDeepLinkFetched = useCallback((result) => {
    setAgentViewings(result.viewings);
    setDeepLinkListingsById((prev) => ({ ...prev, ...result.listingsById }));
  }, []);

  const fetchAgentConversationById = useCallback(
    async ({ participantUserId, entityId, list, listingsById: listingsMap }) =>
      resolveParticipantConversationDeepLink(
        supabase,
        participantUserId,
        entityId,
        list,
        listingsMap,
        { role: "agent" }
      ),
    []
  );

  const handleAgentConversationDeepLinkFetched = useCallback((result) => {
    setConversationRows(result.conversations);
    setDeepLinkListingsById((prev) => ({ ...prev, ...result.listingsById }));
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user?.id || !BL_ENABLE_CONVERSATIONS) return;
    const generation = beginCrmRequest(conversationsGenerationRef);
    if (!conversationRowsRef.current.length) {
      setConversationsLoading(true);
    }

    const { data, error } = await fetchConversationsForAgent(supabase, user.id);
    if (isStaleCrmRequest(conversationsGenerationRef, generation)) {
      return;
    }

    const applied = applyAgentConversationLoadResult({
      generationRef: conversationsGenerationRef,
      generation,
      incoming: filterInboxConversations(data || []),
      previous: conversationRowsRef.current,
      error,
      deepLinkConversationId: deepLinkConversationIdRef.current,
    });

    if (!applied) {
      return;
    }

    setConversationRows(applied.conversations);
    setConversationsError(applied.error);
    setConversationsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (activeTab !== AGENT_DASHBOARD_TAB_IDS.INBOX) return;
    loadConversations();
  }, [activeTab, loadConversations]);

  const loadViewings = useCallback(async () => {
    if (!user?.id || !BL_ENABLE_VIEWING_PERSIST) return;
    const generation = beginCrmRequest(viewingsGenerationRef);
    if (!agentViewingsRef.current.length) {
      setViewingsLoading(true);
    }

    const { data, error } = await fetchViewingsForAgent(supabase, user.id);
    if (isStaleCrmRequest(viewingsGenerationRef, generation)) {
      return;
    }

    const applied = applyAgentViewingLoadResult({
      generationRef: viewingsGenerationRef,
      generation,
      incoming: data || [],
      previous: agentViewingsRef.current,
      error,
      deepLinkViewingId: deepLinkViewingIdRef.current,
    });

    if (!applied) {
      return;
    }

    setAgentViewings(applied.viewings);
    setViewingsError(applied.error);
    setViewingsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (
      activeTab !== AGENT_DASHBOARD_TAB_IDS.VIEWINGS &&
      activeTab !== AGENT_DASHBOARD_TAB_IDS.OVERVIEW
    ) {
      return;
    }
    loadViewings();
  }, [activeTab, loadViewings]);

  conversationRowsRef.current = conversationRows;
  agentViewingsRef.current = agentViewings;
  deepLinkConversationIdRef.current = deepLinkConversationId;
  deepLinkViewingIdRef.current = deepLinkViewingId;

  useEffect(() => {
    return () => {
      invalidateCrmRequests(conversationsGenerationRef);
      invalidateCrmRequests(viewingsGenerationRef);
    };
  }, []);

  const viewingDeepLinkResolveState = useParticipantEntityDeepLinkResolve({
    enabled: Boolean(user?.id && deepLinkViewingId),
    participantUserId: user?.id ?? null,
    entityId: deepLinkViewingId,
    listLoading: viewingsLoading && !agentViewings.length,
    listIncludesTarget: viewingListIncludesId,
    getListSnapshot: () => agentViewings,
    getListingsByIdSnapshot: () => listingsById,
    fetchById: fetchAgentViewingById,
    onFetched: handleAgentViewingDeepLinkFetched,
  });

  const conversationDeepLinkResolveState = useParticipantEntityDeepLinkResolve({
    enabled: Boolean(user?.id && deepLinkConversationId),
    participantUserId: user?.id ?? null,
    entityId: deepLinkConversationId,
    listLoading: conversationsLoading && !conversationRows.length,
    listIncludesTarget: conversationListIncludesId,
    getListSnapshot: () => conversationRows,
    getListingsByIdSnapshot: () => listingsById,
    fetchById: fetchAgentConversationById,
    onFetched: handleAgentConversationDeepLinkFetched,
  });

  const markInquiryResponded = async (inquiryId) => {
    if (!user?.id) return;
    setInquiryBusyId(String(inquiryId));
    const { error } = await updateInquiryStatus(supabase, {
      inquiryId,
      agentUserId: user.id,
      status: INQUIRY_STATUS.RESPONDED,
    });
    setInquiryBusyId("");
    if (error) {
      const msg = error.message || "";
      if (/listing_inquiries|relation|does not exist/i.test(msg)) {
        showToast({
          type: "info",
          message: "Run the listing inquiries migration in Supabase to enable lead inbox.",
        });
      } else {
        showToast({ type: "error", message: msg || "Could not update inquiry" });
      }
      return;
    }
    useAgentDashboardStore.getState().invalidate({ listings: false });
    showToast({ type: "success", message: "Marked as responded" });
  };

  const tabCounts = useMemo(() => {
    const counts = {};
    if (unreadInquiryCount > 0) {
      counts[AGENT_DASHBOARD_TAB_IDS.INBOX] = unreadInquiryCount;
    }
    if (pendingListings > 0) {
      counts[AGENT_DASHBOARD_TAB_IDS.LISTINGS] = pendingListings;
    }
    return counts;
  }, [unreadInquiryCount, pendingListings]);

  if (showBootstrapShell) {
    return <DashboardBootstrapShell label={bootstrapShellLabel} />;
  }

  if (!user?.id || role !== "agent") {
    return <DashboardBootstrapShell label={bootstrapShellLabel} />;
  }

  const finiteCap = listingCap < USER_DASHBOARD_FINITE_CAP_THRESHOLD;
  const limitExhausted = finiteCap && remainingListings === 0;
  const createDisabled = limitExhausted;

  const metricsBlock =
    showHydratingShell || (metricsLoading && !myListingsInitialFetchDone) ? (
      <div className={loadingStyles.hydratingMetrics} aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`skeleton ${loadingStyles.hydratingMetricCard}`} />
        ))}
      </div>
    ) : (
      <AgentDashboardMetrics
        activeListings={activeListings}
        pendingListings={pendingListings}
        rejectedListings={rejectedListings}
        archivedListings={archivedListings}
        draftListings={draftListings}
        inquiriesCount={inquiriesCount}
        inquiriesUnavailable={inquiriesUnavailable}
        onNavigateTab={selectTab}
      />
    );

  return (
    <div className={`${styles.page} ${styles.dashboardWorkspace}`}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <DashboardShell roleKey={DASHBOARD_ROLE.agent} title={AGENT_DASHBOARD_COPY.shellTitle} subtitle={subtitle}>
          <div className={roleLayoutStyles.contentInner}>
            <ProfileCompletionBanner profileTabHref="/dashboard/agent?tab=profile" />

            <DashboardRoleLayout
              statsRegionClassName={`${roleLayoutStyles.statsRegion} ${roleLayoutStyles.userStatsRegion}`}
              mainGridClassName={`${roleLayoutStyles.mainGrid} ${roleLayoutStyles.agentMainGrid} ${
                activeTab === AGENT_DASHBOARD_TAB_IDS.OVERVIEW && !showHydratingShell
                  ? ""
                  : roleLayoutStyles.agentMainGridSingle
              }`}
              stats={metricsBlock}
              navigation={
                <DashboardTabNav
                  tabs={visibleTabs}
                  activeTab={activeTab}
                  onSelect={selectTab}
                  tabCounts={tabCounts}
                />
              }
              aside={
                activeTab === AGENT_DASHBOARD_TAB_IDS.OVERVIEW && !showHydratingShell ? (
                  <AgentDashboardQuickActions
                    createDisabled={createDisabled}
                    username={profile?.username}
                  />
                ) : null
              }
            >
                {activeTab === AGENT_DASHBOARD_TAB_IDS.OVERVIEW ? (
                  <>
                    {showHydratingShell ? (
                      <div className={`skeleton ${loadingStyles.hydratingPanel}`} aria-hidden />
                    ) : (
                      <div className={styles.agentIntelLayout}>
                        <AgentActivityFeed
                          listings={myListingsRows}
                          inquiries={inquiriesRows}
                          viewings={agentViewings}
                          onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
                        />
                        <div className={styles.agentListingColumn}>
                          <AgentBenefitsPanel
                            username={profile?.username}
                            activeListings={activeListings}
                            listingCap={listingCap}
                            limitExhausted={limitExhausted}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : null}

                {activeTab === AGENT_DASHBOARD_TAB_IDS.LISTINGS && user?.id ? (
                  <AgentInventoryPanel
                    userId={user.id}
                    tier={tier}
                    lifecycleFilter={lifecycleFilter}
                    onLifecycleFilterChange={setLifecycleFilter}
                  />
                ) : null}

                {activeTab === AGENT_DASHBOARD_TAB_IDS.INBOX ? (
                  <section aria-label="Inbox">
                    <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
                      Buyer messages from listing pages route here.
                      {BL_ENABLE_CONVERSATIONS
                        ? " Reply in-thread grouped by listing below."
                        : " Mark responded when you've replied outside the app."}
                    </p>
                    {BL_ENABLE_CONVERSATIONS ? (
                      conversationRows.length > 0 || deepLinkConversationId ? (
                        <>
                          {conversationsError && conversationRows.length > 0 ? (
                            <p className={styles.muted} role="status" style={{ marginBottom: 12 }}>
                              Unable to refresh conversations right now.
                            </p>
                          ) : null}
                          <OwnerInquiriesPanel
                            conversations={conversationRows}
                            listingsById={listingsById}
                            agentUserId={user.id}
                            initialConversationId={deepLinkConversationId}
                            deepLinkResolveState={conversationDeepLinkResolveState}
                            crmLoading={conversationsLoading && !conversationRows.length}
                            onRefresh={() => {
                              loadConversations();
                              useAgentDashboardStore.getState().invalidate({ listings: false });
                            }}
                            legacyFallback={
                              <AgentInquiryList
                                inquiries={inquiriesRows}
                                listingsById={listingsById}
                                busyId={inquiryBusyId}
                                onMarkResponded={markInquiryResponded}
                                onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
                              />
                            }
                          />
                        </>
                      ) : conversationsLoading ? (
                        <div className={loadingStyles.hydratingPanel} aria-busy="true" />
                      ) : conversationsError ? (
                        <p className={styles.muted} role="alert">
                          Unable to load conversations right now.
                        </p>
                      ) : null
                    ) : (
                      <AgentInquiryList
                        inquiries={inquiriesRows}
                        listingsById={listingsById}
                        busyId={inquiryBusyId}
                        onMarkResponded={markInquiryResponded}
                        onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
                      />
                    )}
                  </section>
                ) : null}

                {activeTab === AGENT_DASHBOARD_TAB_IDS.VIEWINGS ? (
                  <section aria-label="Viewings">
                    <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
                      Confirm, reschedule, or complete property viewings requested from your listings.
                    </p>
                    {viewingsLoading && !agentViewings.length && !deepLinkViewingId ? (
                      <div className={loadingStyles.hydratingPanel} aria-busy="true" />
                    ) : viewingsError && !agentViewings.length && !deepLinkViewingId ? (
                      <p className={styles.muted} role="alert">
                        Unable to load viewing requests right now.
                      </p>
                    ) : agentViewings.length > 0 || deepLinkViewingId ? (
                      <>
                        {viewingsError && agentViewings.length > 0 ? (
                          <p className={styles.muted} role="status" style={{ marginBottom: 12 }}>
                            Unable to refresh viewing requests right now.
                          </p>
                        ) : null}
                        <AgentViewingsPanel
                          viewings={agentViewings}
                          listingsById={listingsById}
                          agentUserId={user.id}
                          onRefresh={loadViewings}
                          initialViewingId={deepLinkViewingId}
                          deepLinkResolveState={viewingDeepLinkResolveState}
                          crmLoading={viewingsLoading && !agentViewings.length}
                        />
                      </>
                    ) : null}
                  </section>
                ) : null}

                {activeTab === AGENT_DASHBOARD_TAB_IDS.PROFILE ? (
                  <>
                    <ProfileCompletionPanel />
                    <DeviceNotificationsPanel />
                  </>
                ) : null}
            </DashboardRoleLayout>
          </div>
        </DashboardShell>
      </main>
    </div>
  );
}
