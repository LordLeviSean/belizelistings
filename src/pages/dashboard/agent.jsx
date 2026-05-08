import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import SiteNav from "@/components/SiteNav";
import Breadcrumbs from "@/components/Breadcrumbs";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import PropertiesPanel from "@/components/PropertiesPanel";
import VacancyPanel from "@/components/VacancyPanel";
import useUserRole from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/ToastProvider";
import {
  AGENT_FREE_ACTIVE_LISTING_CAP,
  getArchiveStatus,
  getRepublishStatus,
  PLATFORM_TIERS,
} from "@/constants/operationalModel";
import { getUserActiveListingCount } from "@/lib/listingPersistence";
import {
  applyListingLifecycleAction,
  permanentlyDeleteArchivedListing,
} from "@/utils/ownershipAttribution";
import { clearAllFavoritesForListing } from "@/lib/favorites";
import { OWNERSHIP_ACTIONS } from "@/constants/ownershipModel";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import styles from "@/styles/Dashboard.module.css";

export default function AgentDashboard() {
  const router = useRouter();
  const { user, role, loading: roleLoading, tier } = useUserRole();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState("");
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
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.ARCHIVE,
      extraUpdates: {
        status: getArchiveStatus(),
      },
    });
    if (error) {
      setActionId("");
      showToast({ type: "error", message: error?.message || "Unable to archive listing" });
      return;
    }
    await loadListings();
    showToast({ type: "info", message: "Listing archived" });
    setActionId("");
  };

  const republishListing = async (listingId) => {
    setActionId(String(listingId));
    if (tier === PLATFORM_TIERS.AGENT_FREE && user?.id) {
      const activeCount = await getUserActiveListingCount(supabase, user.id);
      if (activeCount >= AGENT_FREE_ACTIVE_LISTING_CAP) {
        showToast({
          type: "error",
          message: `Free Agent limit reached (${AGENT_FREE_ACTIVE_LISTING_CAP} active listings). Archive another listing before restoring.`,
        });
        setActionId("");
        return;
      }
    }
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.REPUBLISH,
      extraUpdates: {
        status: getRepublishStatus(),
      },
    });
    if (error) {
      setActionId("");
      showToast({ type: "error", message: error?.message || "Unable to restore listing" });
      return;
    }
    await clearAllFavoritesForListing(listingId);
    await loadListings();
    showToast({ type: "success", message: "Listing moved to pending review" });
    setActionId("");
  };

  const permanentlyDeleteListing = async () => {
    if (!deleteTargetId) return;
    setActionId(`delete:${deleteTargetId}`);
    const { error } = await permanentlyDeleteArchivedListing(supabase, {
      listingId: deleteTargetId,
      statusHint: "archived",
    });
    if (error) {
      showToast({ type: "error", message: error.message || "Unable to permanently delete listing" });
      setActionId("");
      return;
    }
    await loadListings();
    showToast({ type: "info", message: "Listing permanently deleted" });
    setDeleteTargetId("");
    setActionId("");
  };

  const filteredListings = listings.filter((listing) => {
    const lifecycle = getLifecycleStatus(listing);
    if (visibilityFilter === "archived") return lifecycle === "archived";
    if (visibilityFilter === "active") return lifecycle !== "archived";
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
                  className={`${styles.card} ${getLifecycleStatus(l) === "archived" ? styles.archivedCard : ""} ${
                    actionId === String(l.id) ? styles.cardActionBusy : ""
                  }`}
                >
                  <h3 style={{ margin: 0 }}>{l.title}</h3>
                  <p className={styles.muted}>{Number(l.price || 0).toLocaleString()} BZD</p>
                  <div>
                    <span className={`${styles.statusBadge} ${styles[`status${String(l.status || "").charAt(0).toUpperCase()}${String(l.status || "").slice(1)}`]}`}>
                      {getLifecycleStatus(l) === "archived" ? "Archived (Not Public)" : getLifecycleStatus(l) || "draft"}
                    </span>
                    {getLifecycleStatus(l) === "archived" ? (
                      <p className={styles.archivedHint}>Hidden from public listings</p>
                    ) : null}
                  </div>
                  {getLifecycleStatus(l) === "archived" ? (
                    <>
                      <button
                        className={styles.approveButton}
                        type="button"
                        onClick={() => republishListing(l.id)}
                        disabled={actionId === String(l.id) || actionId === `delete:${l.id}`}
                      >
                        {actionId === String(l.id) ? "Publishing..." : "Re-publish Listing"}
                      </button>
                      <button
                        className={`${styles.rejectButton} ${styles.quickDangerMuted}`}
                        type="button"
                        onClick={() => setDeleteTargetId(String(l.id))}
                        disabled={actionId === String(l.id) || actionId === `delete:${l.id}`}
                        style={{ marginTop: 8 }}
                      >
                        Permanently Delete
                      </button>
                    </>
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
        <DeleteConfirmModal
          isOpen={Boolean(deleteTargetId)}
          onClose={() => setDeleteTargetId("")}
          onConfirm={permanentlyDeleteListing}
          loading={actionId === `delete:${deleteTargetId}` && Boolean(deleteTargetId)}
          mode="delete"
          title="Permanent Deletion"
          description={
            <>
              This permanently removes the listing and associated operational history. This action
              cannot be undone. Type <strong>delete</strong> to continue.
            </>
          }
          confirmLabel="Permanently Delete"
        />

        {activeTab === "properties" ? <PropertiesPanel userId={user?.id} /> : null}

        {activeTab === "vacancy" ? <VacancyPanel userId={user?.id} /> : null}
      </div>
      </main>
    </div>
  );
}
