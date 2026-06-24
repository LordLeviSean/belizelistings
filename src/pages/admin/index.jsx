import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import SiteNav from "../../components/SiteNav";
import PendingListingsPanel from "../../components/PendingListingsPanel";
import AllListingsPanel from "../../components/AllListingsPanel";
import ManageUsersPanel from "../../components/ManageUsersPanel";
import OperatorListingsPanel from "../../components/OperatorListingsPanel";
import { supabase } from "../../lib/supabaseClient";
import useUserRole from "../../hooks/useUserRole";
import useLivePaletteMode from "../../hooks/useLivePaletteMode";
import usePulseMode from "../../hooks/usePulseMode";
import useSeaFlowMode from "../../hooks/useSeaFlowMode";
import useSeaFlowIntensity from "../../hooks/useSeaFlowIntensity";
import { getSeaFlowIntensityLabel } from "../../utils/seaFlowIntensity";
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
import { DashboardShell } from "../../components/dashboard";
import { DASHBOARD_ROLE, DASHBOARD_ROLE_META } from "../../constants/dashboardRoles";
import styles from "../../styles/Dashboard.module.css";
import PremiumEmptyState from "../../components/ui/PremiumEmptyState";

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
  const { enabled: livePaletteModeEnabled, setMode: setLivePaletteMode } = useLivePaletteMode();
  const { enabled: pulseModeEnabled, setMode: setPulseMode } = usePulseMode();
  const { enabled: seaFlowModeEnabled, setMode: setSeaFlowMode } = useSeaFlowMode();
  const { intensity: seaFlowIntensity, setIntensity: setSeaFlowIntensity } = useSeaFlowIntensity();

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
    const tab = typeof router.query.tab === "string" ? router.query.tab : "";
    if (tab === "pending" || tab === "listings" || tab === "users" || tab === "operator" || tab === "upgrades") {
      setActiveTab(tab);
    }
  }, [router.query.tab]);

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

  useEffect(() => {
    if (!isAdmin) return;
    void refreshStats();
  }, [activeTab, isAdmin, refreshStats]);

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
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <p className={styles.muted}>Resolving admin access...</p>
        </main>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <DashboardShell
          roleKey={DASHBOARD_ROLE.admin}
          title="Admin Control Center"
          subtitle={`${welcomePhrase} · ${DASHBOARD_ROLE_META[DASHBOARD_ROLE.admin].defaultSubtitle}`}
        >
        <div className={styles.adminWrapper}>
          <AdminOperationalStats
            total={totals.listings}
            pending={totals.pending}
            approved={totals.approved}
            rejected={totals.rejected}
            archived={totals.archived}
            users={totals.users}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, marginTop: 18 }}>
            <section>
              <div className={styles.adminTabs}>
                <button
                  type="button"
                  className={`${styles.dashboardLink} ${activeTab === "pending" ? styles.dashboardLinkActive : ""}`}
                  onClick={() => setActiveTab("pending")}
                >
                  Pending
                </button>
                <button
                  type="button"
                  className={`${styles.dashboardLink} ${activeTab === "listings" ? styles.dashboardLinkActive : ""}`}
                  onClick={() => setActiveTab("listings")}
                >
                  Listings
                </button>
                <button
                  type="button"
                  className={`${styles.dashboardLink} ${activeTab === "users" ? styles.dashboardLinkActive : ""}`}
                  onClick={() => setActiveTab("users")}
                >
                  Users
                </button>
                <button
                  type="button"
                  className={`${styles.dashboardLink} ${activeTab === "operator" ? styles.dashboardLinkActive : ""}`}
                  onClick={() => setActiveTab("operator")}
                >
                  Operator
                </button>
                <button
                  type="button"
                  className={`${styles.dashboardLink} ${activeTab === "upgrades" ? styles.dashboardLinkActive : ""}`}
                  onClick={() => setActiveTab("upgrades")}
                >
                  Upgrades
                </button>
              </div>
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
            </section>
            <aside className={styles.card}>
              <h3 className={styles.sectionTitle}>Quick Actions</h3>
              <button type="button" className={styles.primaryButton} onClick={() => router.push("/dashboard/create")}>Create Listing</button>
              <button type="button" className={styles.primaryButton} style={{ marginTop: 8 }} onClick={() => setActiveTab("users")}>
                Create User
              </button>
              <button type="button" className={styles.approveButton} style={{ marginTop: 8 }} onClick={() => handleBulkAction("approved")} disabled={bulkLoading === "approved"}>
                {bulkLoading === "approved" ? "Processing..." : "Bulk Approve"}
              </button>
              <button type="button" className={`${styles.rejectButton} ${styles.quickDangerMuted}`} style={{ marginTop: 8 }} onClick={() => handleBulkAction("rejected")} disabled={bulkLoading === "rejected"}>
                {bulkLoading === "rejected" ? "Processing..." : "Bulk Reject"}
              </button>
              <div className={styles.effectControls}>
                <div className={styles.effectCard}>
                  <div>
                    <p className={styles.livePaletteLabel}>Live Palette Mode</p>
                    <p className={styles.livePaletteSubtext}>
                      Subtle district color breathing in the BelizeListings wordmark.
                    </p>
                  </div>
                  <label className={styles.livePaletteSwitch}>
                    <input
                      type="checkbox"
                      checked={livePaletteModeEnabled}
                      onChange={(e) => setLivePaletteMode(e.target.checked)}
                      aria-label="Toggle live palette mode"
                    />
                    <span className={styles.livePaletteSlider} />
                  </label>
                </div>
                <div className={styles.effectCard}>
                  <div>
                    <p className={styles.livePaletteLabel}>Pulse Mode</p>
                    <p className={styles.livePaletteSubtext}>
                      Calm editorial pulse layered over live palette transitions.
                    </p>
                  </div>
                  <label className={styles.livePaletteSwitch}>
                    <input
                      type="checkbox"
                      checked={pulseModeEnabled}
                      onChange={(e) => setPulseMode(e.target.checked)}
                      aria-label="Toggle pulse mode"
                    />
                    <span className={styles.livePaletteSlider} />
                  </label>
                </div>
                <div className={styles.effectCard}>
                  <div>
                    <p className={styles.livePaletteLabel}>Sea Flow Mode</p>
                    <p className={styles.livePaletteSubtext}>
                      Layered sea-glass current motion across the full homepage hero canvas.
                    </p>
                  </div>
                  <label className={styles.livePaletteSwitch}>
                    <input
                      type="checkbox"
                      checked={seaFlowModeEnabled}
                      onChange={(e) => setSeaFlowMode(e.target.checked)}
                      aria-label="Toggle sea flow mode"
                    />
                    <span className={styles.livePaletteSlider} />
                  </label>
                </div>
                <div className={`${styles.effectCard} ${styles.effectCardStacked}`}>
                  <div className={styles.effectCardCopy}>
                    <p className={styles.livePaletteLabel}>Sea Flow Intensity</p>
                    <p className={styles.livePaletteSubtext}>
                      Wave visibility, atmospheric strength, and glow — live across headline, metrics, and map.
                    </p>
                    <p className={styles.livePaletteIndicator}>
                      {getSeaFlowIntensityLabel(seaFlowIntensity)}
                    </p>
                  </div>
                  <input
                    type="range"
                    className={styles.seaFlowIntensityRange}
                    min="0"
                    max="100"
                    step="25"
                    value={Math.round(seaFlowIntensity * 100)}
                    onChange={(e) => setSeaFlowIntensity(Number(e.target.value) / 100)}
                    aria-label="Sea flow intensity"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(seaFlowIntensity * 100)}
                    list="sea-flow-intensity-stops"
                    disabled={!seaFlowModeEnabled}
                  />
                  <datalist id="sea-flow-intensity-stops">
                    <option value="0" label="Disabled" />
                    <option value="25" label="Subtle" />
                    <option value="50" label="Default" />
                    <option value="75" label="Pronounced" />
                    <option value="100" label="Cinematic" />
                  </datalist>
                </div>
              </div>
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
              <p className={styles.muted} style={{ marginTop: 12 }}>Last Action: {lastAction}</p>
            </aside>
          </div>
        </div>
        </DashboardShell>
      </main>
    </div>
  );
}
