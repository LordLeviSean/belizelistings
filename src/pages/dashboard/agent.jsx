import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import SiteNav from "@/components/SiteNav";
import Breadcrumbs from "@/components/Breadcrumbs";
import PropertiesPanel from "@/components/PropertiesPanel";
import VacancyPanel from "@/components/VacancyPanel";
import useUserRole from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "@/styles/Dashboard.module.css";

export default function AgentDashboard() {
  const router = useRouter();
  const { user, role, loading: roleLoading } = useUserRole();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [activeTab, setActiveTab] = useState("listings");
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  const loadListings = async () => {
    if (!user) {
      router.replace("/login");
      return;
    }

    if (role !== "agent") {
      router.replace("/dashboard");
      return;
    }

    const { data } = await supabase
      .from("listings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setListings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (roleLoading) return;
    void loadListings();
  }, [roleLoading, user?.id, role]);

  const archiveListing = async (listingId) => {
    const confirmSeenKey = "operator_archive_confirm_seen_v1";
    if (typeof window !== "undefined" && !window.localStorage.getItem(confirmSeenKey)) {
      const confirmed = window.confirm("Remove from public? You can re-publish anytime.");
      if (!confirmed) return;
      window.localStorage.setItem(confirmSeenKey, "true");
    }

    setActionId(String(listingId));
    const { error } = await supabase
      .from("listings")
      .update({ status: "archived" })
      .eq("id", listingId);
    if (error) {
      setActionId("");
      return;
    }
    await loadListings();
    showToast({ type: "info", message: "Listing archived" });
    setActionId("");
  };

  const republishListing = async (listingId) => {
    setActionId(String(listingId));
    const { error } = await supabase
      .from("listings")
      .update({ status: "pending" })
      .eq("id", listingId);
    if (error) {
      setActionId("");
      return;
    }
    await loadListings();
    showToast({ type: "success", message: "Listing moved to pending review" });
    setActionId("");
  };

  const filteredListings = listings.filter((listing) => {
    if (visibilityFilter === "archived") return listing.status === "archived";
    if (visibilityFilter === "active") return listing.status !== "archived";
    return true;
  });

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <div className={styles.adminWrapper}>
        <Breadcrumbs />
        <h1 className={styles.title}>Agent Dashboard</h1>

        <div style={{ marginBottom: 16 }}>
          <button className={styles.primaryButton} onClick={() => router.push("/dashboard/create")}>
            + Create Listing
          </button>
        </div>

        <div className={styles.adminTabs}>
          <button type="button" className={styles.dashboardLink} onClick={() => setActiveTab("listings")}>
            Listings
          </button>
          <button type="button" className={styles.dashboardLink} onClick={() => setActiveTab("properties")}>
            Properties
          </button>
          <button type="button" className={styles.dashboardLink} onClick={() => setActiveTab("vacancy")}>
            Vacancy
          </button>
        </div>

        {activeTab === "listings" ? (
          <>
            <div className={styles.statusToggle} role="tablist" aria-label="Operator listing visibility filter">
              {[
                { label: "All", value: "all" },
                { label: "Active", value: "active" },
                { label: "Archived", value: "archived" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={visibilityFilter === option.value}
                  className={`${styles.toggleButton} ${
                    visibilityFilter === option.value ? styles.toggleButtonActive : ""
                  }`}
                  onClick={() => setVisibilityFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className={styles.pendingGrid}>
              {loading ? (
                <div className={styles.pendingGrid}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 110 }} />
                  ))}
                </div>
              ) : null}
              {!loading && filteredListings.length === 0 ? (
                <p className={styles.muted}>No listings yet.</p>
              ) : null}
              {filteredListings.map((l) => (
                <div
                  key={l.id}
                  className={`${styles.card} ${l.status === "archived" ? styles.archivedCard : ""} ${
                    actionId === String(l.id) ? styles.cardActionBusy : ""
                  }`}
                >
                  <h3 style={{ margin: 0 }}>{l.title}</h3>
                  <p className={styles.muted}>{Number(l.price || 0).toLocaleString()} BZD</p>
                  <div>
                    <span className={`${styles.statusBadge} ${styles[`status${String(l.status || "").charAt(0).toUpperCase()}${String(l.status || "").slice(1)}`]}`}>
                      {l.status === "archived" ? "Archived (Not Public)" : l.status || "draft"}
                    </span>
                    {l.status === "archived" ? (
                      <p className={styles.archivedHint}>Hidden from public listings</p>
                    ) : null}
                  </div>
                  {l.status === "archived" ? (
                    <button
                      className={styles.approveButton}
                      type="button"
                      onClick={() => republishListing(l.id)}
                      disabled={actionId === String(l.id)}
                    >
                      {actionId === String(l.id) ? "Publishing..." : "Re-publish Listing"}
                    </button>
                  ) : (
                    <button
                      className={styles.deleteListingButton}
                      type="button"
                      onClick={() => archiveListing(l.id)}
                      disabled={actionId === String(l.id)}
                    >
                      {actionId === String(l.id) ? "Removing..." : "Remove Listing"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {activeTab === "properties" ? <PropertiesPanel userId={user?.id} /> : null}

        {activeTab === "vacancy" ? <VacancyPanel userId={user?.id} /> : null}
      </div>
      </main>
    </div>
  );
}
