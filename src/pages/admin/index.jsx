import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import SiteNav from "../../components/SiteNav";
import PendingListingsPanel from "../../components/PendingListingsPanel";
import AllListingsPanel from "../../components/AllListingsPanel";
import ManageUsersPanel from "../../components/ManageUsersPanel";
import OperatorListingsPanel from "../../components/OperatorListingsPanel";
import BuyerViewingsPanel from "../../components/inquiry/BuyerViewingsPanel";
import UserInboxPanel from "../../components/inquiry/UserInboxPanel";
import { supabase } from "../../lib/supabaseClient";
import useUserRole from "../../hooks/useUserRole";
import { ACTIVITY_SIGNAL_TYPES } from "../../constants/trustModel";
import { clearAllFavoritesForListings } from "../../lib/favorites";
import { isMissingColumnError } from "../../lib/supabaseCompat";
import { fetchProfileCount } from "../../lib/profileSelectContract";
import { sanitizeListingMutationPayload } from "../../lib/listingPayloadSanitize";
import { LISTING_MUTATION_FLOW } from "../../lib/listingMutationDiagnostics";
import {
  buildModerationApprovePatch,
  buildModerationRejectPatch,
  MODERATION_APPROVE_STATUS_TIERS,
  MODERATION_REJECT_STATUS_TIERS,
} from "../../lib/listingWriteContract";
import { getOperationalLifecycleCountsFromDb } from "../../lib/listingOperationalStats";
import AdminOperationalStats from "../../components/AdminOperationalStats";
import AgentUpgradeRequestsPanel from "../../components/admin/AgentUpgradeRequestsPanel";
import AdminOwnerInboxPanel from "../../components/admin/AdminOwnerInboxPanel";
import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_INQUIRIES, BL_ENABLE_VIEWING_PERSIST } from "../../lib/featureFlags";
import { loadBuyerCrmData } from "../../lib/crm/buyerCrmData";
import { resolveAdminDashboardTabFromQuery } from "../../lib/dashboardCrmRoutes";
import {
  ADMIN_DASHBOARD_TAB_IDS,
  getVisibleAdminDashboardTabs,
  resolveVisibleAdminDashboardTab,
} from "../../constants/dashboardAdminConfig";
import { DashboardShell, DashboardTabNav, DashboardRoleLayout } from "../../components/dashboard";
import { DASHBOARD_ROLE, DASHBOARD_ROLE_META } from "../../constants/dashboardRoles";
import { isBuyerConversationUnread } from "../../lib/crm/conversationMutations";
import styles from "../../styles/Dashboard.module.css";
import premiumStyles from "../../styles/AdminDashboardPremium.module.css";
import loadingStyles from "../../styles/UserDashboard.module.css";
import PremiumEmptyState from "../../components/ui/PremiumEmptyState";
import Link from "next/link";
import PlatformVisualEditorModal from "../../components/admin/PlatformVisualEditorModal";
import platformVisualStyles from "../../components/admin/PlatformVisualEditorEntry.module.css";
import ProfileCompletionPanel from "@/components/profile/ProfileCompletionPanel";
import DeviceNotificationsPanel from "@/components/profile/DeviceNotificationsPanel";

export default function AdminPage() {
  const router = useRouter();
  const { user, role, loading: roleLoading, welcomePhrase } = useUserRole();
  const [activeTab, setActiveTab] = useState("pending");
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastAction, setLastAction] = useState("Live");
  const [totals, setTotals] = useState({
    listings: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    archived: 0,
    users: 0,
  });
  const [bulkLoading, setBulkLoading] = useState("");
  const [activity, setActivity] = useState([]);
  const [updatedAtLabel, setUpdatedAtLabel] = useState("moments ago");
  /** Bumped on profiles realtime (and shared with panels for owner/user lists). */
  const [profilesRevision, setProfilesRevision] = useState(0);
  const [upgradeRequestsRevision, setUpgradeRequestsRevision] = useState(0);
  const [listingsRevision, setListingsRevision] = useState(0);
  const [buyerViewings, setBuyerViewings] = useState([]);
  const [buyerConversations, setBuyerConversations] = useState([]);
  const [buyerListingsById, setBuyerListingsById] = useState({});
  const [buyerCrmLoading, setBuyerCrmLoading] = useState(false);
  const [visualEditorOpen, setVisualEditorOpen] = useState(false);

  const crmTabsEnabled = BL_ENABLE_INQUIRIES || BL_ENABLE_CONVERSATIONS;
  const visibleTabs = useMemo(() => getVisibleAdminDashboardTabs(), [crmTabsEnabled]);

  const selectTab = useCallback(
    (tabId, extraQuery = {}) => {
      const nextTab = resolveVisibleAdminDashboardTab(tabId, visibleTabs);
      setActiveTab(nextTab);
      const query = { ...router.query, tab: nextTab, ...extraQuery };
      for (const key of Object.keys(extraQuery)) {
        if (extraQuery[key] == null || extraQuery[key] === "") delete query[key];
      }
      if (!extraQuery.action) delete query.action;
      void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
    },
    [router, visibleTabs]
  );

  const loadBuyerCrm = useCallback(async () => {
    if (!user?.id) return;
    setBuyerCrmLoading(true);
    const { viewings, conversations, listingsById } = await loadBuyerCrmData(supabase, user.id);
    setBuyerViewings(viewings);
    setBuyerConversations(conversations);
    setBuyerListingsById(listingsById);
    setBuyerCrmLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (
      activeTab !== ADMIN_DASHBOARD_TAB_IDS.INBOX &&
      activeTab !== ADMIN_DASHBOARD_TAB_IDS.VIEWINGS
    ) {
      return;
    }
    void loadBuyerCrm();
  }, [activeTab, loadBuyerCrm]);

  useEffect(() => {
    if (!user?.id || !isAdmin) return;
    void loadBuyerCrm();
  }, [user?.id, isAdmin, loadBuyerCrm]);

  const tabCounts = useMemo(() => {
    const counts = {};
    if (totals.pending > 0) {
      counts[ADMIN_DASHBOARD_TAB_IDS.PENDING] = totals.pending;
    }
    const inboxUnread = buyerConversations.filter((conv) => isBuyerConversationUnread(conv)).length;
    if (inboxUnread > 0) {
      counts[ADMIN_DASHBOARD_TAB_IDS.INBOX] = inboxUnread;
    }
    return counts;
  }, [totals.pending, buyerConversations]);

  const refreshStats = useCallback(async () => {
    const [operational, { count: usersCount, error: usersError }] = await Promise.all([
      getOperationalLifecycleCountsFromDb(supabase),
      fetchProfileCount(supabase),
    ]);

    if (operational.error) {
      console.warn("[admin] operational lifecycle tally failed", operational.error);
    }
    if (usersError) {
      console.warn("[admin] users count query failed", usersError);
    }
    if (
      process.env.NODE_ENV === "development" &&
      !usersError &&
      usersCount === 1
    ) {
      console.info(
        "[admin] Profiles count is 1 via client; if the DB has more users, apply supabase/migrations/20260512190000_profiles_admin_rls_fix.sql (or 20260512180000_profiles_admin_rls.sql) via supabase db push or SQL editor."
      );
    }

    setTotals({
      listings: operational.totalOperational,
      pending: operational.pending,
      approved: operational.approved,
      rejected: operational.rejected,
      archived: operational.archived,
      users: usersCount ?? 0,
    });
    setUpdatedAtLabel("moments ago");
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      if (roleLoading) return;
      if (!user) {
        setCheckingAccess(false);
        setIsAdmin(false);
        router.replace("/login");
        return;
      }

      if (role !== "admin") {
        setCheckingAccess(false);
        setIsAdmin(false);
        router.replace("/dashboard");
        return;
      }

      await refreshStats();
      setIsAdmin(true);
      setCheckingAccess(false);
    };

    void checkAdmin();
  }, [router, roleLoading, user?.id, role]);

  useEffect(() => {
    const inferred = resolveAdminDashboardTabFromQuery(router.query);
    setActiveTab(resolveVisibleAdminDashboardTab(inferred, visibleTabs));
  }, [
    router.query.tab,
    router.query.conversation,
    router.query.viewing,
    router.query.listing,
    visibleTabs,
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    let debounce;
    const schedule = (fromProfiles) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        void refreshStats();
        if (fromProfiles) {
          setProfilesRevision((r) => r + 1);
        }
      }, 320);
    };
    const channel = supabase
      .channel("admin-dashboard-operational")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings" },
        () => {
          schedule(false);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          schedule(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_upgrade_requests" },
        () => {
          schedule(true);
          setUpgradeRequestsRevision((r) => r + 1);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [isAdmin, refreshStats]);

  const pushActivity = (message, signal = null) => {
    const stamp = new Date().toLocaleTimeString();
    const event = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      stamp,
      message,
      signal,
    };
    setActivity((prev) => [event, ...prev].slice(0, 8));
    setLastAction(message);
  };

  const handleBulkAction = async (nextStatus) => {
    if (bulkLoading) return;
    setBulkLoading(nextStatus);
    const pendingOr =
      "status.eq.pending,moderation_status.eq.pending_review,lifecycle_status.eq.pending,lifecycle_status.eq.submitted";
    const bulkPayload = sanitizeListingMutationPayload(
      nextStatus === "approved" ? buildModerationApprovePatch() : buildModerationRejectPatch(),
      { mutationFlow: LISTING_MUTATION_FLOW.UNSPECIFIED, operation: "PATCH" }
    );
    let { data: updatedRows, error } = await supabase
      .from("listings")
      .update(bulkPayload)
      .or(pendingOr)
      .select("id");
    if (error && isMissingColumnError(error)) {
      const minimalBulk = sanitizeListingMutationPayload(
        nextStatus === "approved"
          ? { ...MODERATION_APPROVE_STATUS_TIERS[1] }
          : { ...MODERATION_REJECT_STATUS_TIERS[1] },
        { mutationFlow: LISTING_MUTATION_FLOW.UNSPECIFIED, operation: "PATCH" }
      );
      ({ data: updatedRows, error } = await supabase
        .from("listings")
        .update(minimalBulk)
        .eq("status", "pending")
        .select("id"));
    }
    if (!error && nextStatus === "approved" && updatedRows?.length) {
      const ids = updatedRows.map((row) => row.id).filter(Boolean);
      await clearAllFavoritesForListings(ids);
    }
    if (!error) {
      setListingsRevision((r) => r + 1);
      await refreshStats();
      pushActivity(
        `Bulk ${nextStatus} applied`,
        nextStatus === "approved" ? ACTIVITY_SIGNAL_TYPES.NEWLY_APPROVED : null
      );
    }
    setBulkLoading("");
  };

  if (checkingAccess) {
    return (
      <div className={premiumStyles.adminPage}>
        <SiteNav active="dashboard" />
        <main className={premiumStyles.main}>
          <p className={styles.muted}>Resolving admin access...</p>
        </main>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className={premiumStyles.adminPage}>
      <div className={premiumStyles.silkLeft} aria-hidden />
      <div className={premiumStyles.silkRight} aria-hidden />
      <div className={premiumStyles.silkHeader} aria-hidden />
      <SiteNav active="dashboard" />
      <main className={premiumStyles.main}>
        <div className={premiumStyles.frame}>
          <DashboardShell
            roleKey={DASHBOARD_ROLE.admin}
            title="Admin Control Center"
            subtitle={`${welcomePhrase} · ${DASHBOARD_ROLE_META[DASHBOARD_ROLE.admin].defaultSubtitle}`}
          >
            <DashboardRoleLayout
              contentInnerClassName={`${premiumStyles.adminDashboardInner} ${premiumStyles.contentWell}`}
              dataSurfaceClassName={premiumStyles.dataSurface}
              statsLampClassName={premiumStyles.lampTarget}
              statsRegionClassName={premiumStyles.adminStatsRegion}
              mainGridClassName={premiumStyles.adminMainGridTight}
              stats={
                <AdminOperationalStats
                  total={totals.listings}
                  pending={totals.pending}
                  approved={totals.approved}
                  rejected={totals.rejected}
                  archived={totals.archived}
                  users={totals.users}
                />
              }
              navigation={
                <DashboardTabNav
                  tabs={visibleTabs}
                  activeTab={activeTab}
                  onSelect={selectTab}
                  tabCounts={tabCounts}
                  variant="link"
                  activeTabClassName="adminTabNeonActive"
                />
              }
              aside={
                <aside className={`${styles.card} ${premiumStyles.lampTarget}`}>
                  <h3 className={styles.sectionTitle}>Quick Actions</h3>
                  <Link
                    className={`${styles.primaryButton} ${premiumStyles.adminPrimaryAction}`}
                    href="/admin/marketplace-health"
                    style={{ display: "inline-block", textAlign: "center", textDecoration: "none" }}
                  >
                    Marketplace Health
                  </Link>
                  <div className={platformVisualStyles.platformVisualEntry}>
                    <p className={platformVisualStyles.platformVisualTitle}>Visual Editor</p>
                    <p className={platformVisualStyles.platformVisualHint}>
                      Customize the platform&apos;s global visual effects.
                    </p>
                    <button
                      type="button"
                      className={`${styles.primaryButton} ${premiumStyles.adminPrimaryAction} ${platformVisualStyles.platformVisualButton}`}
                      onClick={() => setVisualEditorOpen(true)}
                    >
                      Open Visual Editor
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`${styles.primaryButton} ${premiumStyles.adminPrimaryAction}`}
                    style={{ marginTop: 8 }}
                    onClick={() => router.push("/dashboard/create")}
                  >
                    Create Listing
                  </button>
                  <button
                    type="button"
                    className={`${styles.primaryButton} ${premiumStyles.adminPrimaryAction}`}
                    style={{ marginTop: 8 }}
                    onClick={() => selectTab(ADMIN_DASHBOARD_TAB_IDS.USERS, { action: "create-user" })}
                  >
                    Create User
                  </button>
                  <button
                    type="button"
                    className={`${styles.approveButton} ${premiumStyles.adminPrimaryAction}`}
                    style={{ marginTop: 8 }}
                    onClick={() => handleBulkAction("approved")}
                    disabled={bulkLoading === "approved"}
                  >
                    {bulkLoading === "approved" ? "Processing..." : "Bulk Approve"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.rejectButton} ${styles.quickDangerMuted}`}
                    style={{ marginTop: 8 }}
                    onClick={() => handleBulkAction("rejected")}
                    disabled={bulkLoading === "rejected"}
                  >
                    {bulkLoading === "rejected" ? "Processing..." : "Bulk Reject"}
                  </button>
                  <h4 style={{ marginTop: 16, marginBottom: 8 }}>Recent Activity</h4>
                  <div style={{ display: "grid", gap: 6 }}>
                    {activity.length ? (
                      activity.map((item) => (
                        <p key={item.id} className={styles.muted}>
                          {item.stamp} - {item.message}
                        </p>
                      ))
                    ) : (
                      <PremiumEmptyState variant="activity" compact title="Operational activity is quiet" />
                    )}
                  </div>
                  <p className={styles.muted} style={{ marginTop: 8 }}>
                    <span className={styles.liveDot} /> Updated {updatedAtLabel}
                  </p>
                  <p className={styles.muted} style={{ marginTop: 12 }}>
                    Last Action: {lastAction}
                  </p>
                </aside>
              }
            >
              {activeTab === "pending" && (
                <PendingListingsPanel
                  profilesRevision={profilesRevision}
                  onAction={async (message) => {
                    pushActivity(message);
                    setListingsRevision((r) => r + 1);
                    await refreshStats();
                  }}
                />
              )}
              {activeTab === "listings" && (
                <AllListingsPanel
                  profilesRevision={profilesRevision}
                  listingsRevision={listingsRevision}
                  onAction={async (message) => {
                    pushActivity(message);
                    setListingsRevision((r) => r + 1);
                    await refreshStats();
                  }}
                />
              )}
              {activeTab === "users" && (
                <ManageUsersPanel
                  profilesRevision={profilesRevision}
                  onAction={async (message) => {
                    pushActivity(message);
                    setProfilesRevision((r) => r + 1);
                    if (/listing|deleted user|permanently deleted/i.test(String(message || ""))) {
                      setListingsRevision((r) => r + 1);
                    }
                    await refreshStats();
                  }}
                />
              )}
              {activeTab === "operator" && (
                <OperatorListingsPanel
                  profilesRevision={profilesRevision}
                  onAction={async (message) => {
                    pushActivity(message);
                    setListingsRevision((r) => r + 1);
                    await refreshStats();
                  }}
                />
              )}
              {activeTab === "upgrades" && (
                <AgentUpgradeRequestsPanel
                  requestsRevision={upgradeRequestsRevision}
                  onAction={async (message) => {
                    pushActivity(message);
                    setProfilesRevision((r) => r + 1);
                    setUpgradeRequestsRevision((r) => r + 1);
                    await refreshStats();
                  }}
                />
              )}
              {activeTab === ADMIN_DASHBOARD_TAB_IDS.INBOX ? (
                <section aria-label="Inbox">
                  {buyerConversations.length > 0 ? (
                    <div style={{ marginBottom: 24 }}>
                      <h3 className={styles.sectionTitle} style={{ fontSize: "1.05rem", marginBottom: 12 }}>
                        Your Inbox
                      </h3>
                      <UserInboxPanel
                        conversations={buyerConversations}
                        buyerUserId={user?.id}
                        onRefresh={loadBuyerCrm}
                        initialConversationId={
                          typeof router.query.conversation === "string"
                            ? router.query.conversation
                            : Array.isArray(router.query.conversation)
                              ? router.query.conversation[0]
                              : null
                        }
                      />
                    </div>
                  ) : null}
                  {user?.id ? (
                    <AdminOwnerInboxPanel
                      ownerUserId={user.id}
                      section="inquiries"
                      initialConversationId={
                        typeof router.query.conversation === "string"
                          ? router.query.conversation
                          : Array.isArray(router.query.conversation)
                            ? router.query.conversation[0]
                            : null
                      }
                    />
                  ) : null}
                </section>
              ) : null}
              {activeTab === ADMIN_DASHBOARD_TAB_IDS.VIEWINGS ? (
                <section aria-label="Viewings">
                  {buyerViewings.length > 0 ? (
                    <div style={{ marginBottom: 24 }}>
                      <h3 className={styles.sectionTitle} style={{ fontSize: "1.05rem", marginBottom: 12 }}>
                        Your viewings
                      </h3>
                      <BuyerViewingsPanel
                        viewings={buyerViewings}
                        listingsById={buyerListingsById}
                        buyerUserId={user?.id}
                        onRefresh={loadBuyerCrm}
                        initialViewingId={
                          typeof router.query.viewing === "string"
                            ? router.query.viewing
                            : Array.isArray(router.query.viewing)
                              ? router.query.viewing[0]
                              : null
                        }
                      />
                    </div>
                  ) : null}
                  {user?.id ? (
                    <AdminOwnerInboxPanel
                      ownerUserId={user.id}
                      section="viewings"
                      initialViewingId={
                        typeof router.query.viewing === "string"
                          ? router.query.viewing
                          : Array.isArray(router.query.viewing)
                            ? router.query.viewing[0]
                            : null
                      }
                    />
                  ) : null}
                </section>
              ) : null}

              {activeTab === ADMIN_DASHBOARD_TAB_IDS.PROFILE ? (
                <>
                  <ProfileCompletionPanel />
                  <DeviceNotificationsPanel />
                </>
              ) : null}
            </DashboardRoleLayout>
          </DashboardShell>
        </div>
      </main>
      <PlatformVisualEditorModal
        open={visualEditorOpen}
        onClose={() => setVisualEditorOpen(false)}
      />
    </div>
  );
}
