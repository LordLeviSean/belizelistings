import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SiteNav from "../../components/SiteNav";
import PendingListingsPanel from "../../components/PendingListingsPanel";
import AllListingsPanel from "../../components/AllListingsPanel";
import ManageUsersPanel from "../../components/ManageUsersPanel";
import OperatorListingsPanel from "../../components/OperatorListingsPanel";
import Breadcrumbs from "../../components/Breadcrumbs";
import { supabase } from "../../lib/supabaseClient";
import useUserRole from "../../hooks/useUserRole";
import useLivePaletteMode from "../../hooks/useLivePaletteMode";
import usePulseMode from "../../hooks/usePulseMode";
import useSpotlightMode from "../../hooks/useSpotlightMode";
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
  const { enabled: spotlightModeEnabled, setMode: setSpotlightMode } = useSpotlightMode();

  const refreshStats = async () => {
    const [{ count: pending }, { count: approved }, { count: listings }, { count: users }] = await Promise.all([
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("listings").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    setPendingCount(pending || 0);
    setTotals({ listings: listings || 0, users: users || 0, approved: approved || 0 });
    setUpdatedAtLabel("moments ago");
  };

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

  const pushActivity = (message) => {
    const stamp = new Date().toLocaleTimeString();
    setActivity((prev) => [`${stamp} - ${message}`, ...prev].slice(0, 8));
    setLastAction(message);
  };

  const handleBulkAction = async (nextStatus) => {
    if (bulkLoading) return;
    setBulkLoading(nextStatus);
    const { error } = await supabase.from("listings").update({ status: nextStatus }).eq("status", "pending");
    if (!error) {
      await refreshStats();
      pushActivity(`Bulk ${nextStatus} applied`);
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
          <Breadcrumbs />
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
                <button type="button" className={styles.dashboardLink} onClick={() => setActiveTab("pending")}>Pending</button>
                <button type="button" className={styles.dashboardLink} onClick={() => setActiveTab("listings")}>Listings</button>
                <button type="button" className={styles.dashboardLink} onClick={() => setActiveTab("users")}>Users</button>
                <button type="button" className={styles.dashboardLink} onClick={() => setActiveTab("operator")}>Operator</button>
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
              <div className={styles.livePaletteControl}>
                <p className={styles.livePaletteLabel}>Live Palette Mode</p>
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
              {livePaletteModeEnabled ? (
                <div className={styles.livePaletteControl}>
                  <div>
                    <p className={styles.livePaletteLabel}>Pulse Mode</p>
                    <p className={styles.livePaletteSubtext}>
                      Higher-energy ambient palette motion using the Belize district color system.
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
              ) : null}
              {livePaletteModeEnabled && pulseModeEnabled ? (
                <p className={styles.livePaletteIndicator}>
                  High-energy ambient motion enabled.
                </p>
              ) : null}
              {livePaletteModeEnabled ? (
                <div className={styles.livePaletteControl}>
                  <div>
                    <p className={styles.livePaletteLabel}>Spotlight Mode</p>
                    <p className={styles.livePaletteSubtext}>
                      Premium illuminated signage glow behind the BelizeListings wordmark.
                    </p>
                  </div>
                  <label className={styles.livePaletteSwitch}>
                    <input
                      type="checkbox"
                      checked={spotlightModeEnabled}
                      onChange={(e) => setSpotlightMode(e.target.checked)}
                      aria-label="Toggle spotlight mode"
                    />
                    <span className={styles.livePaletteSlider} />
                  </label>
                </div>
              ) : null}
              <h4 style={{ marginTop: 16, marginBottom: 8 }}>Recent Activity</h4>
              <div style={{ display: "grid", gap: 6 }}>
                {activity.length ? activity.map((item) => <p key={item} className={styles.muted}>{item}</p>) : <p className={styles.muted}>No activity yet</p>}
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
