import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useShallow } from "zustand/react/shallow";
import SiteNav from "@/components/SiteNav";
import { DashboardShell } from "@/components/dashboard";
import AgentDashboardMetrics from "@/components/agent/AgentDashboardMetrics";
import AgentBenefitsPanel from "@/components/agent/AgentBenefitsPanel";
import AgentInventoryPanel from "@/components/agent/AgentInventoryPanel";
import { AgentActivityFeed } from "@/components/operational";
import AgentInquiryList from "@/components/inquiry/AgentInquiryList";
import AgentInboxPanel from "@/components/inquiry/AgentInboxPanel";
import ProfileCompletionPanel from "@/components/profile/ProfileCompletionPanel";
import ProfileCompletionBanner from "@/components/profile/ProfileCompletionBanner";
import useUserRole from "@/hooks/useUserRole";
import { isProfileHydratedForUser } from "@/lib/profileSessionCache";
import { formatWelcomeGreeting } from "@/lib/dashboardGreeting";
import useAgentDashboardStore from "@/stores/useAgentDashboardStore";
import { DASHBOARD_ROLE } from "@/constants/dashboardRoles";
import {
  AGENT_DASHBOARD_COPY,
  AGENT_DASHBOARD_TAB_IDS,
  AGENT_DASHBOARD_TABS,
  AGENT_INVENTORY_FILTERS,
  formatListingRemainingLabel,
  USER_DASHBOARD_FINITE_CAP_THRESHOLD,
} from "@/constants/dashboardAgentConfig";
import { INQUIRY_STATUS } from "@/constants/inquiryModel";
import { supabase } from "@/lib/supabaseClient";
import { updateInquiryStatus } from "@/lib/listingInquiries";
import { BL_ENABLE_CONVERSATIONS } from "@/lib/featureFlags";
import { fetchConversationsForAgent } from "@/lib/crm/conversationMutations";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "@/styles/Dashboard.module.css";
import loadingStyles from "@/styles/UserDashboard.module.css";

const AGENT_TAB_SET = new Set(Object.values(AGENT_DASHBOARD_TAB_IDS));

function normalizeAgentDashboardTab(raw) {
  const s = String(Array.isArray(raw) ? raw[0] : raw || "")
    .trim()
    .toLowerCase();
  return AGENT_TAB_SET.has(s) ? s : AGENT_DASHBOARD_TAB_IDS.OVERVIEW;
}

export default function AgentDashboard() {
  const router = useRouter();
  const { user, role, loading, profile, tier, welcomePhrase } = useUserRole();
  const { showToast } = useToast();
  const [inquiryBusyId, setInquiryBusyId] = useState("");
  const [conversationRows, setConversationRows] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
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

  const activeTab = useMemo(() => normalizeAgentDashboardTab(router.query.tab), [router.query.tab]);

  const profileHydrated = Boolean(user?.id && isProfileHydratedForUser(user.id));
  const showHydratingShell = loading && profileHydrated && role === "agent";

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
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role !== "agent") {
      router.replace("/dashboard");
    }
  }, [loading, user, role, router]);

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
        useAgentDashboardStore.getState().flushRefresh();
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
    return m;
  }, [myListingsRows]);

  const loadConversations = useCallback(async () => {
    if (!user?.id || !BL_ENABLE_CONVERSATIONS) return;
    setConversationsLoading(true);
    const { data, error } = await fetchConversationsForAgent(supabase, user.id);
    setConversationsLoading(false);
    if (!error) setConversationRows(data || []);
  }, [user?.id]);

  useEffect(() => {
    if (activeTab !== AGENT_DASHBOARD_TAB_IDS.INQUIRIES) return;
    loadConversations();
  }, [activeTab, loadConversations]);

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

  if (loading && !showHydratingShell) {
    return (
      <div className={`${styles.page} ${styles.userDashboardPage}`}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <div className={loadingStyles.loadingMain} aria-busy="true" aria-label="Loading dashboard" />
        </main>
      </div>
    );
  }

  if (!user || role !== "agent") {
    return null;
  }

  const finiteCap = listingCap < USER_DASHBOARD_FINITE_CAP_THRESHOLD;
  const limitExhausted = finiteCap && remainingListings === 0;
  const createDisabled = limitExhausted;

  return (
    <div className={`${styles.page} ${styles.userDashboardPage}`}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <div className={styles.userDashboardSurface}>
          <div className={styles.userAtmosphereLayer} aria-hidden>
            <div className={styles.userAtmosphereDepth} />
            <div className={styles.userAtmosphereVeil} />
          </div>

          <div className={styles.userDashboardAboveArt}>
            <DashboardShell roleKey={DASHBOARD_ROLE.agent} title={AGENT_DASHBOARD_COPY.shellTitle} subtitle={subtitle}>
              <div className={styles.adminWrapper}>
                <ProfileCompletionBanner profileTabHref="/dashboard/agent?tab=profile" />

                {showHydratingShell || (metricsLoading && !myListingsInitialFetchDone) ? (
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
                    listingRemainingLabel={formatListingRemainingLabel(remainingListings)}
                    limitExhausted={limitExhausted}
                    onNavigateTab={selectTab}
                  />
                )}

                <div className={styles.statusToggle} role="tablist" aria-label="Dashboard sections">
                  {AGENT_DASHBOARD_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      className={`${styles.toggleButton} ${
                        activeTab === tab.id ? styles.toggleButtonActive : ""
                      }`}
                      onClick={() => selectTab(tab.id)}
                    >
                      {tab.label}
                      {tab.id === AGENT_DASHBOARD_TAB_IDS.INQUIRIES && unreadInquiryCount > 0
                        ? ` (${unreadInquiryCount})`
                        : ""}
                    </button>
                  ))}
                </div>

                {activeTab === AGENT_DASHBOARD_TAB_IDS.OVERVIEW ? (
                  <>
                    {!showHydratingShell ? (
                      <div className={styles.agentIntelLayout}>
                        <AgentActivityFeed
                          listings={myListingsRows}
                          inquiries={inquiriesRows}
                          onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
                        />
                        <div className={styles.agentListingColumn}>
                          <AgentBenefitsPanel username={profile?.username} />
                        </div>
                      </div>
                    ) : null}

                    {!showHydratingShell ? (
                      <section className={styles.userActionPanel} aria-label="Quick actions">
                        <h2 className={styles.userActionHeadline}>{AGENT_DASHBOARD_COPY.actionHeadline}</h2>
                        <p className={styles.userActionSubtext}>{AGENT_DASHBOARD_COPY.actionSubtext}</p>
                        <div className={styles.userCtaRow}>
                          {createDisabled ? (
                            <button
                              type="button"
                              className={`${styles.primaryButton} ${styles.userPrimaryDisabled}`}
                              disabled
                            >
                              {AGENT_DASHBOARD_COPY.primaryCta}
                            </button>
                          ) : (
                            <Link className={styles.primaryButton} href="/dashboard/create">
                              {AGENT_DASHBOARD_COPY.primaryCta}
                            </Link>
                          )}
                        </div>
                      </section>
                    ) : null}
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

                {activeTab === AGENT_DASHBOARD_TAB_IDS.INQUIRIES ? (
                  <section aria-label="Lead inbox">
                    <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
                      Buyer messages from listing pages route here.
                      {BL_ENABLE_CONVERSATIONS
                        ? " Reply in-thread or manage pipeline groups below."
                        : " Mark responded when you've replied outside the app."}
                    </p>
                    {BL_ENABLE_CONVERSATIONS ? (
                      conversationsLoading && !conversationRows.length ? (
                        <div className={loadingStyles.hydratingPanel} aria-busy="true" />
                      ) : (
                        <AgentInboxPanel
                          conversations={conversationRows}
                          listingsById={listingsById}
                          agentUserId={user.id}
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
                      )
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

                {activeTab === AGENT_DASHBOARD_TAB_IDS.PROFILE ? (
                  <ProfileCompletionPanel />
                ) : null}
              </div>
            </DashboardShell>
          </div>
        </div>
      </main>
    </div>
  );
}
