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
import { ACTIVITY_SIGNAL_TYPES } from "../../constants/trustModel";
import { clearAllFavoritesForListings } from "../../lib/favorites";
import { isMissingColumnError } from "../../lib/supabaseCompat";
import { sanitizeListingMutationPayload } from "../../lib/listingPayloadSanitize";
import { LISTING_MUTATION_FLOW } from "../../lib/listingMutationDiagnostics";
import { getOperationalLifecycleCountsFromDb } from "../../lib/listingOperationalStats";
import AdminOperationalStats from "../../components/AdminOperationalStats";
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
  const { enabled: livePaletteModeEnabled, setMode: setLivePaletteMode } = useLivePaletteMode();
  const { enabled: pulseModeEnabled, setMode: setPulseMode } = usePulseMode();
  const { enabled: seaFlowModeEnabled, setMode: setSeaFlowMode } = useSeaFlowMode();

  const refreshStats = useCallback(async () => {
    const [operational, { count: usersCount, error: usersError }] = await Promise.all([
      getOperationalLifecycleCountsFromDb(supabase),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    if (operational.error) {
      console.warn("[admin] operational lifecycle tally failed", operational.error);
    }
    if (usersError) {
      console.warn("[admin] users count query failed", usersError);
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
    if (tab === "pending" || tab === "listings" || tab === "users" || tab === "operator") {
      setActiveTab(tab);
    }
  }, [router.query.tab]);

  useEffect(() => {
    if (!isAdmin) return;
    let debounce;
    const channel = supabase
      .channel("admin-dashboard-listing-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings" },
        () => {
          clearTimeout(debounce);
          debounce = setTimeout(() => {
            void refreshStats();
          }, 320);
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
    const pendingOr = "status.eq.pending,moderation_status.eq.pending_review,lifecycle_status.eq.pending";
    const bulkPayload = sanitizeListingMutationPayload(
      {
        status: nextStatus,
        lifecycle_status: nextStatus,
        moderation_status: nextStatus === "approved" ? "approved" : nextStatus,
      },
      { mutationFlow: LISTING_MUTATION_FLOW.UNSPECIFIED, operation: "PATCH" }
    );
    let { data: updatedRows, error } = await supabase
      .from("listings")
      .update(bulkPayload)
      .or(pendingOr)
      .select("id");
    if (error && isMissingColumnError(error)) {
      const minimalBulk = sanitizeListingMutationPayload(
        { status: nextStatus },
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
              </div>
              {activeTab === "pending" && (
                <PendingListingsPanel
                  onAction={async (message) => {
                    pushActivity(message);
                    await refreshStats();
                  }}
                />
              )}
              {activeTab === "listings" && (
                <AllListingsPanel
                  onAction={async (message) => {
                    pushActivity(message);
                    await refreshStats();
                  }}
                />
              )}
              {activeTab === "users" && (
                <ManageUsersPanel
                  onAction={async (message) => {
                    pushActivity(message);
                    await refreshStats();
                  }}
                />
              )}
              {activeTab === "operator" && (
                <OperatorListingsPanel
                  onAction={async (message) => {
                    pushActivity(message);
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
                      Layered sea-glass current motion behind the homepage map surface.
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
