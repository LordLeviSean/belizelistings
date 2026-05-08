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
import { getModerationStatus, getRepublishStatus } from "../../constants/operationalModel";
import styles from "../../styles/Dashboard.module.css";

export default function AdminPage() {
  const router = useRouter();
  const { user, role, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState("pending");
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastAction, setLastAction] = useState("Live");
  const [totals, setTotals] = useState({ listings: 0, users: 0, approved: 0 });
  const [bulkLoading, setBulkLoading] = useState("");
  const [activity, setActivity] = useState([]);
  const [updatedAtLabel, setUpdatedAtLabel] = useState("moments ago");
  const { enabled: livePaletteModeEnabled, setMode: setLivePaletteMode } = useLivePaletteMode();
  const { enabled: pulseModeEnabled, setMode: setPulseMode } = usePulseMode();
  const { enabled: seaFlowModeEnabled, setMode: setSeaFlowMode } = useSeaFlowMode();

  const refreshStats = useCallback(async () => {
    const pendingOr = `status.eq.${getRepublishStatus()},moderation_status.eq.pending_review,lifecycle_status.eq.pending`;
    const approvedOr = `status.eq.${getModerationStatus("approved")},moderation_status.eq.approved,lifecycle_status.eq.approved`;
    let [{ count: pending, error: pendingError }, { count: approved, error: approvedError }, { count: listings }, { count: users }] =
      await Promise.all([
        supabase.from("listings").select("id", { count: "exact", head: true }).or(pendingOr),
        supabase.from("listings").select("id", { count: "exact", head: true }).or(approvedOr),
        supabase.from("listings").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

    if (pendingError && isMissingColumnError(pendingError)) {
      const { count } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", getRepublishStatus());
      pending = count || 0;
    } else if (pendingError) {
      console.warn("[admin] pending count query failed; using legacy status filter", pendingError);
      const { count } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", getRepublishStatus());
      pending = count ?? pending ?? 0;
    }

    if (approvedError && isMissingColumnError(approvedError)) {
      const { count } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", getModerationStatus("approved"));
      approved = count || 0;
    } else if (approvedError) {
      console.warn("[admin] approved count query failed; using legacy status filter", approvedError);
      const { count } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", getModerationStatus("approved"));
      approved = count ?? approved ?? 0;
    }

    setPendingCount(pending || 0);
    setTotals({ listings: listings || 0, users: users || 0, approved: approved || 0 });
    setUpdatedAtLabel("moments ago");
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      if (roleLoading) return;
      if (!user) {
        router.replace("/login");
        return;
      }

      setAdminUserId(user.id);
      setAdminRole(role);

      if (role !== "admin") {
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
    let { data: updatedRows, error } = await supabase
      .from("listings")
      .update({
        status: nextStatus,
        lifecycle_status: nextStatus,
        moderation_status: nextStatus === "approved" ? "approved" : nextStatus,
      })
      .or(pendingOr)
      .select("id");
    if (error && isMissingColumnError(error)) {
      ({ data: updatedRows, error } = await supabase
        .from("listings")
        .update({ status: nextStatus })
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
        <div className={styles.adminWrapper}>
          <h1 className={styles.title}>Admin Control Center</h1>
          <p className={styles.muted}>Admin: {adminUserId} · Role: {adminRole}</p>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}><p className={styles.statLabel}>Total Listings</p><p className={styles.statValue}>{totals.listings}</p></div>
            <div className={styles.statCard}><p className={styles.statLabel}>Pending</p><p className={styles.statValue}>{pendingCount}</p></div>
            <div className={styles.statCard}><p className={styles.statLabel}>Approved</p><p className={styles.statValue}>{totals.approved}</p></div>
            <div className={styles.statCard}><p className={styles.statLabel}>Users</p><p className={styles.statValue}>{totals.users}</p></div>
          </div>
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
                  <p className={styles.muted}>No activity yet</p>
                )}
              </div>
              <p className={styles.muted} style={{ marginTop: 8 }}>
                <span className={styles.liveDot} /> Updated {updatedAtLabel}
              </p>
              <p className={styles.muted} style={{ marginTop: 12 }}>Last Action: {lastAction}</p>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
