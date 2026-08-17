import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useShallow } from "zustand/react/shallow";
import SiteNav from "@/components/SiteNav";
import { DashboardShell, DashboardTabNav, DashboardRoleLayout, DashboardBootstrapShell } from "@/components/dashboard";
import roleLayoutStyles from "@/components/dashboard/DashboardRoleLayout.module.css";
import UserDashboardAccountTier from "@/components/user/UserDashboardAccountTier";
import UserDashboardMetrics from "@/components/user/UserDashboardMetrics";
import UserDashboardQuickActions from "@/components/user/UserDashboardQuickActions";
import UserMyListingsPanel from "@/components/user/UserMyListingsPanel";
import UserPendingListingsPanel from "@/components/user/UserPendingListingsPanel";
import UserArchivedListingsPanel from "@/components/user/UserArchivedListingsPanel";
import BuyerViewingsPanel from "@/components/inquiry/BuyerViewingsPanel";
import UserInboxPanel from "@/components/inquiry/UserInboxPanel";
import AdminOwnerInboxPanel from "@/components/admin/AdminOwnerInboxPanel";
import ProfileCompletionPanel from "@/components/profile/ProfileCompletionPanel";
import DeviceNotificationsPanel from "@/components/profile/DeviceNotificationsPanel";
import ProfileCompletionBanner from "@/components/profile/ProfileCompletionBanner";
import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_INQUIRIES, BL_ENABLE_VIEWING_PERSIST } from "@/lib/featureFlags";
import { loadBuyerCrmData } from "@/lib/crm/buyerCrmData";
import {
  applyBuyerCrmLoadResult,
  beginCrmRequest,
  invalidateCrmRequests,
  isStaleCrmRequest,
} from "@/lib/crm/crmListLoaderUtils";
import { resolveBuyerViewingDeepLink } from "@/lib/crm/buyerViewingDeepLink";
import { conversationListIncludesId } from "@/lib/crm/conversationDeepLink";
import { resolveParticipantConversationDeepLink } from "@/lib/crm/participantConversationDeepLink";
import { viewingListIncludesId } from "@/lib/crm/viewingDeepLink";
import { isBuyerConversationUnread } from "@/lib/crm/conversationMutations";
import { supabase } from "@/lib/supabaseClient";
import { isProfileHydratedForUser } from "@/lib/profileSessionCache";
import useUserRole from "@/hooks/useUserRole";
import { formatUserDashboardSubtitle } from "@/lib/dashboardGreeting";
import useUserDashboardStore from "@/stores/useUserDashboardStore";
import { useUserDashboardFocusSync } from "@/hooks/useUserDashboardFocusSync";
import { DASHBOARD_ROLE } from "@/constants/dashboardRoles";
import {
  USER_DASHBOARD_COPY,
  USER_DASHBOARD_PLACEHOLDERS,
  USER_DASHBOARD_FINITE_CAP_THRESHOLD,
  USER_DASHBOARD_TAB_IDS,
  getVisibleUserDashboardTabs,
  normalizeUserDashboardTab,
  resolveVisibleUserDashboardTab,
  userHasOwnedListings,
} from "@/constants/dashboardUserConfig";
import { resolveUserDashboardTabFromQuery } from "@/lib/dashboardCrmRoutes";
import useDashboardIntent from "@/hooks/useDashboardIntent";
import { useParticipantEntityDeepLinkResolve } from "@/hooks/useParticipantEntityDeepLinkResolve";
import styles from "@/styles/Dashboard.module.css";
import loadingStyles from "@/styles/UserDashboard.module.css";

const USER_TAB_SET = new Set(Object.values(USER_DASHBOARD_TAB_IDS));

export default function UserDashboard() {
  const router = useRouter();
  const { user, role, loading, profile, tier } = useUserRole();
  const userIdRef = useRef(null);
  const roleRef = useRef(role);
  const loadingRef = useRef(loading);
  const dashboardPathRef = useRef(null);

  userIdRef.current = user?.id ?? null;
  roleRef.current = role;
  loadingRef.current = loading;

  const {
    activeListings,
    pendingListings,
    archivedListings,
    draftListings,
    rejectedListings,
    favoritesCount,
    inquiriesCount,
    favoritesUnavailable,
    inquiriesUnavailable,
    remainingListings,
  } = useUserDashboardStore(
    useShallow((s) => ({
      activeListings: s.activeListings,
      pendingListings: s.pendingListings,
      archivedListings: s.archivedListings,
      draftListings: s.draftListings,
      rejectedListings: s.rejectedListings,
      favoritesCount: s.favoritesCount,
      inquiriesCount: s.inquiriesCount,
      favoritesUnavailable: s.favoritesUnavailable,
      inquiriesUnavailable: s.inquiriesUnavailable,
      remainingListings: s.remainingListings,
    }))
  );

  const listingCap = useUserDashboardStore((s) => s.listingCap);

  const subtitle = useMemo(
    () => formatUserDashboardSubtitle({ username: profile?.username }),
    [profile?.username]
  );

  const hasOwnedListings = useMemo(
    () =>
      userHasOwnedListings({
        activeListings,
        pendingListings,
        archivedListings,
        draftListings,
        rejectedListings,
      }),
    [activeListings, pendingListings, archivedListings, draftListings, rejectedListings]
  );

  const visibleTabs = useMemo(
    () => getVisibleUserDashboardTabs({ hasOwnedListings }),
    [hasOwnedListings]
  );

  const profileHydrated = Boolean(user?.id && isProfileHydratedForUser(user.id));

  const {
    activeTab,
    showBootstrapShell,
    showHydratingShell,
    bootstrapShellLabel,
    deepLinkConversationId,
    deepLinkViewingId,
  } = useDashboardIntent({
    router,
    expectedRole: "user",
    user,
    role,
    loading,
    profileHydrated,
    visibleTabs,
    entityTabMap: {
      viewing: USER_DASHBOARD_TAB_IDS.VIEWINGS,
      conversation: USER_DASHBOARD_TAB_IDS.INBOX,
      listing: USER_DASHBOARD_TAB_IDS.MY_LISTINGS,
    },
    inferTabFromQuery: resolveUserDashboardTabFromQuery,
    resolveVisibleTab: resolveVisibleUserDashboardTab,
    defaultTab: USER_DASHBOARD_TAB_IDS.OVERVIEW,
  });

  const [buyerInquiries, setBuyerInquiries] = useState([]);
  const [buyerViewings, setBuyerViewings] = useState([]);
  const [buyerConversations, setBuyerConversations] = useState([]);
  const [buyerListingsById, setBuyerListingsById] = useState({});
  const [buyerCrmLoading, setBuyerCrmLoading] = useState(false);
  const [buyerCrmConversationError, setBuyerCrmConversationError] = useState(null);
  const [buyerCrmViewingError, setBuyerCrmViewingError] = useState(null);
  const buyerCrmGenerationRef = useRef(0);
  const buyerConversationsRef = useRef([]);
  const buyerViewingsRef = useRef([]);
  const buyerListingsByIdRef = useRef({});
  const deepLinkConversationIdRef = useRef(deepLinkConversationId);
  const deepLinkViewingIdRef = useRef(deepLinkViewingId);

  buyerConversationsRef.current = buyerConversations;
  buyerViewingsRef.current = buyerViewings;
  buyerListingsByIdRef.current = buyerListingsById;
  deepLinkConversationIdRef.current = deepLinkConversationId;
  deepLinkViewingIdRef.current = deepLinkViewingId;

  const fetchBuyerViewingById = useCallback(
    async ({ participantUserId, entityId, list, listingsById }) =>
      resolveBuyerViewingDeepLink(supabase, participantUserId, entityId, list, listingsById),
    []
  );

  const handleBuyerViewingDeepLinkFetched = useCallback((result) => {
    setBuyerViewings(result.viewings);
    setBuyerListingsById((prev) => ({ ...prev, ...result.listingsById }));
  }, []);

  const fetchBuyerConversationById = useCallback(
    async ({ participantUserId, entityId, list, listingsById }) =>
      resolveParticipantConversationDeepLink(
        supabase,
        participantUserId,
        entityId,
        list,
        listingsById,
        { role: "buyer" }
      ),
    []
  );

  const handleBuyerConversationDeepLinkFetched = useCallback((result) => {
    setBuyerConversations(result.conversations);
    setBuyerListingsById((prev) => ({ ...prev, ...result.listingsById }));
  }, []);

  const loadBuyerCrm = useCallback(async () => {
    if (!user?.id) return;
    const generation = beginCrmRequest(buyerCrmGenerationRef);
    const hasExistingData =
      buyerConversationsRef.current.length > 0 || buyerViewingsRef.current.length > 0;
    if (!hasExistingData) {
      setBuyerCrmLoading(true);
    }

    const result = await loadBuyerCrmData(supabase, user.id);
    if (isStaleCrmRequest(buyerCrmGenerationRef, generation)) {
      return;
    }

    const applied = applyBuyerCrmLoadResult({
      generationRef: buyerCrmGenerationRef,
      generation,
      result,
      previous: {
        conversations: buyerConversationsRef.current,
        viewings: buyerViewingsRef.current,
        listingsById: buyerListingsByIdRef.current,
      },
      deepLinkConversationId: deepLinkConversationIdRef.current,
      deepLinkViewingId: deepLinkViewingIdRef.current,
    });

    if (!applied) {
      return;
    }

    setBuyerInquiries(applied.inquiries);
    setBuyerConversations(applied.conversations);
    setBuyerViewings(applied.viewings);
    setBuyerListingsById(applied.listingsById);
    setBuyerCrmConversationError(applied.conversationError);
    setBuyerCrmViewingError(applied.viewingError);
    setBuyerCrmLoading(false);
  }, [user?.id]);

  useEffect(() => {
    return () => {
      invalidateCrmRequests(buyerCrmGenerationRef);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void loadBuyerCrm();
  }, [user?.id, loadBuyerCrm]);

  useEffect(() => {
    if (
      activeTab !== USER_DASHBOARD_TAB_IDS.INBOX &&
      activeTab !== USER_DASHBOARD_TAB_IDS.VIEWINGS
    ) {
      return;
    }
    loadBuyerCrm();
  }, [activeTab, loadBuyerCrm]);

  const viewingDeepLinkResolveState = useParticipantEntityDeepLinkResolve({
    enabled: Boolean(user?.id && deepLinkViewingId),
    participantUserId: user?.id ?? null,
    entityId: deepLinkViewingId,
    listLoading: buyerCrmLoading && !buyerViewings.length,
    listIncludesTarget: viewingListIncludesId,
    getListSnapshot: () => buyerViewings,
    getListingsByIdSnapshot: () => buyerListingsById,
    fetchById: fetchBuyerViewingById,
    onFetched: handleBuyerViewingDeepLinkFetched,
  });

  const conversationDeepLinkResolveState = useParticipantEntityDeepLinkResolve({
    enabled: Boolean(user?.id && deepLinkConversationId),
    participantUserId: user?.id ?? null,
    entityId: deepLinkConversationId,
    listLoading: buyerCrmLoading && !buyerConversations.length,
    listIncludesTarget: conversationListIncludesId,
    getListSnapshot: () => buyerConversations,
    getListingsByIdSnapshot: () => buyerListingsById,
    fetchById: fetchBuyerConversationById,
    onFetched: handleBuyerConversationDeepLinkFetched,
  });

  const tabCounts = useMemo(() => {
    const counts = {};
    if (pendingListings > 0) {
      counts[USER_DASHBOARD_TAB_IDS.PENDING] = pendingListings;
    }
    const inboxUnread = buyerConversations.filter((conv) => isBuyerConversationUnread(conv)).length;
    if (inboxUnread > 0) {
      counts[USER_DASHBOARD_TAB_IDS.INBOX] = inboxUnread;
    } else if (inquiriesCount > 0) {
      counts[USER_DASHBOARD_TAB_IDS.INBOX] = inquiriesCount;
    }
    return counts;
  }, [pendingListings, buyerConversations, inquiriesCount]);

  const selectTab = useCallback(
    (tab) => {
      if (normalizeUserDashboardTab(router.query.tab) === tab) return;
      router.replace(
        { pathname: "/dashboard/user", query: { ...router.query, tab } },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  useEffect(() => {
    if (!user?.id || role !== "user") return;
    useUserDashboardStore.getState().setTier(tier);
  }, [loading, user?.id, role, tier]);

  const storeSessionRef = useRef(null);

  // Init when auth+role are ready. Do not destroy on brief `loading` flicker (profile re-hydrate)
  // — that caused store teardown on tab-adjacent auth noise. Teardown only on logout/wrong role
  // or leaving this page (see unmount effect below). Shallow `?tab=` changes: 0 profile fetches.
  useUserDashboardFocusSync(user?.id, role);

  useLayoutEffect(() => {
    const uid = user?.id;
    if (!uid || role !== "user") {
      if (storeSessionRef.current) {
        useUserDashboardStore.getState().destroy();
        storeSessionRef.current = null;
      }
      return;
    }
    if (loading && !isProfileHydratedForUser(uid)) return;
    if (storeSessionRef.current === uid) return;
    storeSessionRef.current = uid;
    useUserDashboardStore.getState().init(uid, role);
  }, [loading, user?.id, role]);

  useEffect(() => {
    return () => {
      if (storeSessionRef.current) {
        useUserDashboardStore.getState().destroy();
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
        if (path !== "/dashboard/user") return;
        if (prevPath === "/dashboard/user") return;
        if (roleRef.current !== "user" || !userIdRef.current || loadingRef.current) return;
        useUserDashboardStore.getState().invalidate({ listings: true });
      } catch {
        /* ignore */
      }
    };
    router.events.on("routeChangeComplete", onRouteDone);
    return () => {
      router.events.off("routeChangeComplete", onRouteDone);
    };
  }, [router.events, router.pathname]);

  if (showBootstrapShell) {
    return <DashboardBootstrapShell label={bootstrapShellLabel} />;
  }

  if (!user?.id || role !== "user") {
    return <DashboardBootstrapShell label={bootstrapShellLabel} />;
  }

  const finiteCap = listingCap < USER_DASHBOARD_FINITE_CAP_THRESHOLD;
  const createDisabled = finiteCap && remainingListings === 0;
  const limitExhausted = finiteCap && remainingListings === 0;

  const metricsBlock =
    showHydratingShell ? (
      <div
        className={loadingStyles.hydratingMetrics}
        aria-busy="true"
        aria-label="Refreshing dashboard"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`skeleton ${loadingStyles.hydratingMetricCard}`} />
        ))}
      </div>
    ) : (
      <UserDashboardMetrics
        activeListings={activeListings}
        pendingListings={pendingListings}
        archivedListings={archivedListings}
        draftListings={draftListings}
        favoritesCount={favoritesCount}
        inquiriesCount={inquiriesCount}
        favoritesUnavailable={favoritesUnavailable}
        inquiriesUnavailable={inquiriesUnavailable}
        onNavigateTab={selectTab}
      />
    );

  return (
    <div className={`${styles.page} ${styles.userDashboardPage}`}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <DashboardShell
          roleKey={DASHBOARD_ROLE.user}
          title={USER_DASHBOARD_COPY.shellTitle}
          subtitle={subtitle}
        >
          <div className={roleLayoutStyles.contentInner}>
            <ProfileCompletionBanner profileTabHref="/dashboard/user?tab=profile" />

            <DashboardRoleLayout
              statsRegionClassName={`${roleLayoutStyles.statsRegion} ${roleLayoutStyles.userStatsRegion}`}
              mainGridClassName={`${roleLayoutStyles.mainGrid} ${roleLayoutStyles.userMainGrid} ${
                activeTab === USER_DASHBOARD_TAB_IDS.OVERVIEW && !showHydratingShell
                  ? ""
                  : roleLayoutStyles.userMainGridSingle
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
                activeTab === USER_DASHBOARD_TAB_IDS.OVERVIEW && !showHydratingShell ? (
                  <UserDashboardQuickActions createDisabled={createDisabled} />
                ) : null
              }
            >
                {activeTab === USER_DASHBOARD_TAB_IDS.OVERVIEW ? (
                  <>
                    {showHydratingShell ? (
                      <div
                        className={`skeleton ${loadingStyles.hydratingPanel}`}
                        aria-hidden
                      />
                    ) : (
                      <UserDashboardAccountTier
                        role={role}
                        tier={tier}
                        listingCap={listingCap}
                        activeListings={activeListings}
                        limitExhausted={limitExhausted}
                        userId={user.id}
                        username={profile?.username}
                        email={profile?.email ?? user?.email}
                      />
                    )}

                    {!showHydratingShell ? (
                    <section className={styles.userActionPanel} aria-label="Explore more">
                      <h2 className={styles.userActionHeadline}>{USER_DASHBOARD_COPY.actionHeadline}</h2>
                      <p className={styles.userActionSubtext}>{USER_DASHBOARD_COPY.actionSubtext}</p>

                      <div className={styles.userPlaceholderGrid}>
                        {USER_DASHBOARD_PLACEHOLDERS.map((row) => (
                          <div key={row.key} className={styles.userPlaceholderCard}>
                            <h3 className={styles.userPlaceholderTitle}>{row.title}</h3>
                            <p className={styles.userPlaceholderHint}>{row.hint}</p>
                            <p className={styles.userPlaceholderBadge}>
                              {USER_DASHBOARD_COPY.placeholderComingSoon}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                    ) : null}
                  </>
                ) : null}

                {activeTab === USER_DASHBOARD_TAB_IDS.MY_LISTINGS && user?.id ? (
                  <UserMyListingsPanel userId={user.id} tier={tier} />
                ) : null}

                {activeTab === USER_DASHBOARD_TAB_IDS.PENDING ? <UserPendingListingsPanel /> : null}

                {activeTab === USER_DASHBOARD_TAB_IDS.ARCHIVED && user?.id ? (
                  <UserArchivedListingsPanel userId={user.id} tier={tier} />
                ) : null}

                {activeTab === USER_DASHBOARD_TAB_IDS.SAVED_FAVORITES ? (
                  <section className={styles.userActionPanel} aria-label="Saved favorites">
                    <h2 className={styles.userActionHeadline}>Saved favorites</h2>
                    <p className={styles.userActionSubtext} style={{ marginBottom: 16 }}>
                      Your shortlist lives on a dedicated page so it stays easy to browse and compare.
                    </p>
                    <Link className={styles.primaryButton} href="/favorites">
                      Open saved favorites
                    </Link>
                  </section>
                ) : null}

                {activeTab === USER_DASHBOARD_TAB_IDS.PROFILE ? (
                  <>
                    <ProfileCompletionPanel />
                    <DeviceNotificationsPanel />
                  </>
                ) : null}

                {activeTab === USER_DASHBOARD_TAB_IDS.INBOX ? (
                  <section aria-label="Inbox">
                    {buyerCrmLoading && !buyerConversations.length && !deepLinkConversationId && !hasOwnedListings ? (
                      <div className={loadingStyles.hydratingPanel} aria-busy="true" />
                    ) : null}
                    {buyerCrmConversationError &&
                    !buyerConversations.length &&
                    !deepLinkConversationId ? (
                      <p className={styles.muted} role="alert">
                        Unable to load conversations right now.
                      </p>
                    ) : null}
                    {buyerCrmConversationError && buyerConversations.length > 0 ? (
                      <p className={styles.muted} role="status">
                        Unable to refresh conversations right now.
                      </p>
                    ) : null}
                    {buyerConversations.length > 0 || deepLinkConversationId ? (
                      <div style={{ marginBottom: hasOwnedListings ? 24 : 0 }}>
                        {hasOwnedListings ? (
                          <h3 className={styles.userActionHeadline} style={{ fontSize: "1.05rem", marginBottom: 12 }}>
                            Your Inbox
                          </h3>
                        ) : null}
                        <UserInboxPanel
                          conversations={buyerConversations}
                          buyerUserId={user?.id}
                          onRefresh={loadBuyerCrm}
                          initialConversationId={deepLinkConversationId}
                          deepLinkResolveState={conversationDeepLinkResolveState}
                          crmLoading={buyerCrmLoading && !buyerConversations.length}
                        />
                      </div>
                    ) : null}
                    {hasOwnedListings && user?.id ? (
                      <AdminOwnerInboxPanel
                        ownerUserId={user.id}
                        section="inquiries"
                        surface="user"
                        initialConversationId={deepLinkConversationId}
                      />
                    ) : null}
                    {!buyerConversations.length &&
                    !deepLinkConversationId &&
                    !hasOwnedListings &&
                    !buyerCrmLoading &&
                    !buyerCrmConversationError ? (
                      <p className={styles.muted}>Nothing in your Inbox yet — use Message via BelizeListings on a listing to start a conversation.</p>
                    ) : null}
                  </section>
                ) : null}

                {activeTab === USER_DASHBOARD_TAB_IDS.VIEWINGS ? (
                  <section aria-label="Viewings">
                    {buyerCrmLoading && !buyerViewings.length && (!hasOwnedListings || deepLinkViewingId) ? (
                      <div className={loadingStyles.hydratingPanel} aria-busy="true" />
                    ) : null}
                    {buyerCrmViewingError && !buyerViewings.length && !deepLinkViewingId ? (
                      <p className={styles.muted} role="alert">
                        Unable to load viewing requests right now.
                      </p>
                    ) : null}
                    {buyerCrmViewingError && buyerViewings.length > 0 ? (
                      <p className={styles.muted} role="status">
                        Unable to refresh viewing requests right now.
                      </p>
                    ) : null}
                    {buyerViewings.length > 0 || deepLinkViewingId ? (
                      <div style={{ marginBottom: hasOwnedListings ? 24 : 0 }}>
                        {hasOwnedListings ? (
                          <h3 className={styles.userActionHeadline} style={{ fontSize: "1.05rem", marginBottom: 12 }}>
                            Your viewings
                          </h3>
                        ) : null}
                        <BuyerViewingsPanel
                          viewings={buyerViewings}
                          listingsById={buyerListingsById}
                          buyerUserId={user?.id}
                          onRefresh={loadBuyerCrm}
                          initialViewingId={deepLinkViewingId}
                          deepLinkResolveState={viewingDeepLinkResolveState}
                          crmLoading={buyerCrmLoading && !buyerViewings.length}
                        />
                      </div>
                    ) : null}
                    {hasOwnedListings && user?.id ? (
                      <AdminOwnerInboxPanel
                        ownerUserId={user.id}
                        section="viewings"
                        surface="user"
                        initialViewingId={deepLinkViewingId}
                      />
                    ) : null}
                    {!buyerViewings.length &&
                    !deepLinkViewingId &&
                    !hasOwnedListings &&
                    !buyerCrmLoading &&
                    !buyerCrmViewingError ? (
                      <p className={styles.muted}>No viewings yet — schedule a viewing from any listing page.</p>
                    ) : null}
                  </section>
                ) : null}
            </DashboardRoleLayout>
          </div>
        </DashboardShell>
      </main>
    </div>
  );
}
