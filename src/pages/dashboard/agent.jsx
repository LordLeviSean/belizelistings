import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import SiteNav from "@/components/SiteNav";
import Breadcrumbs from "@/components/Breadcrumbs";
import { DashboardShell } from "@/components/dashboard";
import { DASHBOARD_ROLE, DASHBOARD_ROLE_META } from "@/constants/dashboardRoles";
import {
  AgentActivityFeed,
  AgentQuickActionBar,
  ListingIntelStrip,
} from "@/components/operational";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import PropertiesPanel from "@/components/PropertiesPanel";
import VacancyPanel from "@/components/VacancyPanel";
import useUserRole from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/ToastProvider";
import {
  AGENT_FREE_ACTIVE_LISTING_CAP,
  getArchiveStatus,
  LISTING_LIFECYCLE,
  PLATFORM_TIERS,
} from "@/constants/operationalModel";
import { getUserActiveListingCount } from "@/lib/listingPersistence";
import {
  applyListingLifecycleAction,
  permanentlyDeleteArchivedListing,
} from "@/utils/ownershipAttribution";
import { OWNERSHIP_ACTIONS } from "@/constants/ownershipModel";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import { INQUIRY_STATUS } from "@/constants/inquiryModel";
import { fetchInquiriesForAgent, updateInquiryStatus } from "@/lib/listingInquiries";
import AgentInquiryList from "@/components/inquiry/AgentInquiryList";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
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
  const [inquiries, setInquiries] = useState([]);
  const [inquiryBusyId, setInquiryBusyId] = useState("");

  const loadListings = useCallback(async () => {
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
      .select("*, listing_images(image_url,position)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setListings(data || []);
    setLoading(false);
  }, [router, role, user]);

  const loadInquiries = useCallback(async () => {
    if (!user?.id || role !== "agent") return;
    const { data, error } = await fetchInquiriesForAgent(supabase, user.id, { limit: 100 });
    if (!error) setInquiries(data || []);
  }, [user?.id, role]);

  useEffect(() => {
    if (roleLoading) return;
    void loadListings();
  }, [roleLoading, loadListings]);

  useEffect(() => {
    if (roleLoading) return;
    void loadInquiries();
  }, [roleLoading, loadInquiries]);

  useEffect(() => {
    if (!user?.id || role !== "agent") return;
    const channel = supabase
      .channel(`agent-listings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings", filter: `user_id=eq.${user.id}` },
        () => {
          void loadListings();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, role, loadListings]);

  useEffect(() => {
    if (!user?.id || role !== "agent") return;
    const channel = supabase
      .channel(`agent-inquiries-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listing_inquiries",
          filter: `agent_user_id=eq.${user.id}`,
        },
        () => {
          void loadInquiries();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, role, loadInquiries]);

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
      extraUpdates: {},
    });
    if (error) {
      setActionId("");
      showToast({ type: "error", message: error?.message || "Unable to restore listing" });
      return;
    }
    await loadListings();
    showToast({ type: "success", message: "Listing moved to Pending Review" });
    setActionId("");
  };

  const resubmitForReviewListing = async (listingId) => {
    setActionId(String(listingId));
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.RESUBMIT,
      extraUpdates: {},
    });
    if (error) {
      setActionId("");
      showToast({ type: "error", message: error?.message || "Unable to resubmit listing" });
      return;
    }
    await loadListings();
    showToast({ type: "success", message: "Listing moved to Pending Review" });
    setActionId("");
  };

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
    await loadInquiries();
    showToast({ type: "success", message: "Marked as responded" });
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

  const draftRows = useMemo(() => {
    return listings
      .filter((l) => getLifecycleStatus(l) === LISTING_LIFECYCLE.DRAFT)
      .slice()
      .sort((a, b) => {
        const tb = new Date(b.updated_at || b.created_at || 0).getTime();
        const ta = new Date(a.updated_at || a.created_at || 0).getTime();
        return tb - ta;
      });
  }, [listings]);

  const draftCount = draftRows.length;

  const listingsById = useMemo(() => {
    const m = {};
    for (const row of listings) {
      if (row?.id != null) m[row.id] = row;
    }
    return m;
  }, [listings]);

  const unreadInquiryCount = useMemo(
    () =>
      inquiries.filter((q) => !q.read_at && q.status === INQUIRY_STATUS.NEW).length,
    [inquiries]
  );

  const filteredListings = listings.filter((listing) => {
    const lifecycle = getLifecycleStatus(listing);
    if (visibilityFilter === "drafts") return lifecycle === LISTING_LIFECYCLE.DRAFT;
    if (visibilityFilter === "archived") return lifecycle === LISTING_LIFECYCLE.ARCHIVED;
    if (visibilityFilter === "rejected") return lifecycle === LISTING_LIFECYCLE.REJECTED;
    if (visibilityFilter === "active") return lifecycle !== LISTING_LIFECYCLE.ARCHIVED;
    return true;
  });

  const listingEmptyProps =
    visibilityFilter === "drafts"
      ? { variant: "drafts", primary: { label: "Create listing", href: "/dashboard/create" } }
      : visibilityFilter === "archived"
        ? { variant: "archived" }
        : visibilityFilter === "rejected"
          ? { variant: "rejected", primary: { label: "Create listing", href: "/dashboard/create" } }
          : visibilityFilter === "active"
            ? { variant: "active", primary: { label: "Create listing", href: "/dashboard/create" } }
            : { variant: "listings", primary: { label: "Create listing", href: "/dashboard/create" } };

  const handleResumeDraft = () => {
    const top = draftRows[0];
    if (top?.id) {
      router.push(`/dashboard/create?draft=${encodeURIComponent(top.id)}`);
      return;
    }
    showToast({ type: "info", message: "No drafts yet. Start from Create listing." });
  };

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <DashboardShell
          roleKey={DASHBOARD_ROLE.agent}
          title="Agent Dashboard"
          subtitle={`${welcomePhrase} · ${DASHBOARD_ROLE_META[DASHBOARD_ROLE.agent].defaultSubtitle}`}
        >
        <div className={styles.adminWrapper}>
        <Breadcrumbs />

        <AgentQuickActionBar
          onCreate={() => router.push("/dashboard/create")}
          onResumeDraft={handleResumeDraft}
          draftCount={draftCount}
          hasListings={listings.length > 0}
        />

        {draftRows.length > 0 ? (
          <div className={styles.draftResumeStrip} aria-label="Draft workspaces">
            <p className={styles.draftResumeTitle}>Resume a draft</p>
            <div className={styles.draftResumeGrid}>
              {draftRows.slice(0, 4).map((d) => {
                const ts = d.updated_at || d.created_at;
                const label = ts
                  ? `Edited ${new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : "Draft";
                return (
                  <div key={d.id} className={`${styles.card} ${styles.draftResumeCard}`}>
                    <div>
                      <h4 className={styles.draftResumeHeading}>{d.title || "Untitled draft"}</h4>
                      <p className={styles.muted}>{label}</p>
                    </div>
                    <button
                      type="button"
                      className={styles.approveButton}
                      onClick={() => router.push(`/dashboard/create?draft=${encodeURIComponent(d.id)}`)}
                    >
                      Continue
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className={styles.adminTabs}>
          <button
            type="button"
            className={styles.dashboardLink}
            onClick={() => {
              setActiveTab("listings");
              setVisibilityFilter("all");
            }}
          >
            Listings
          </button>
          <button type="button" className={styles.dashboardLink} onClick={() => setActiveTab("inquiries")}>
            Inquiries {unreadInquiryCount > 0 ? `(${unreadInquiryCount})` : ""}
          </button>
          <button
            type="button"
            className={styles.dashboardLink}
            onClick={() => {
              setActiveTab("listings");
              setVisibilityFilter("drafts");
            }}
          >
            Drafts {draftCount > 0 ? `(${draftCount})` : ""}
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
            <div className={styles.statusToggle} role="tablist" aria-label="Listing visibility filter">
              {[
                { label: "All", value: "all" },
                { label: "Active", value: "active" },
                { label: "Drafts", value: "drafts" },
                { label: "Rejected", value: "rejected" },
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

            <div className={styles.agentIntelLayout}>
              <AgentActivityFeed
                listings={listings}
                inquiries={inquiries}
                onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
              />
              <div className={styles.agentListingColumn}>
              {loading ? (
                <div className={styles.pendingGrid}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 110 }} />
                  ))}
                </div>
              ) : null}
              {!loading && filteredListings.length === 0 ? (
                <PremiumEmptyState compact {...listingEmptyProps} />
              ) : null}
              <div className={styles.pendingGrid}>
              {filteredListings.map((l) => {
                const lc = getLifecycleStatus(l);
                const isArchived = lc === LISTING_LIFECYCLE.ARCHIVED;
                const isRejected = lc === LISTING_LIFECYCLE.REJECTED;
                const lcKey = lc || "draft";
                const badgeClass = `${lcKey.charAt(0).toUpperCase()}${lcKey.slice(1)}`;
                return (
                <div
                  key={l.id}
                  className={`${styles.card} ${isArchived ? styles.archivedCard : ""} ${isRejected ? styles.rejectedTone : ""} ${
                    actionId === String(l.id) ? styles.cardActionBusy : ""
                  }`}
                >
                  <h3 style={{ margin: 0 }}>{l.title}</h3>
                  <p className={styles.muted}>{Number(l.price || 0).toLocaleString()} BZD</p>
                  <div>
                    <span className={`${styles.statusBadge} ${styles[`status${badgeClass}`]}`}>
                      {isArchived ? "Archived (Not Public)" : lc || "draft"}
                    </span>
                    {isArchived ? (
                      <p className={styles.archivedHint}>Hidden from public listings</p>
                    ) : null}
                    {isRejected ? (
                      <p className={styles.archivedHint}>Not public — resubmit after edits for another review.</p>
                    ) : null}
                  </div>
                  <ListingIntelStrip listing={l} />
                  {isArchived ? (
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
                  ) : isRejected ? (
                    <>
                      <button
                        className={styles.approveButton}
                        type="button"
                        onClick={() => resubmitForReviewListing(l.id)}
                        disabled={actionId === String(l.id)}
                        style={{ marginTop: 8 }}
                      >
                        {actionId === String(l.id) ? "Submitting..." : "Resubmit for Review"}
                      </button>
                      <button
                        className={styles.deleteListingButton}
                        type="button"
                        onClick={() => archiveListing(l.id)}
                        disabled={actionId === String(l.id)}
                        style={{ marginTop: 8 }}
                      >
                        {actionId === String(l.id) ? "Removing..." : "Archive Listing"}
                      </button>
                    </>
                  ) : lc === LISTING_LIFECYCLE.DRAFT ? (
                    <>
                      <button
                        className={styles.approveButton}
                        type="button"
                        onClick={() => router.push(`/dashboard/create?draft=${encodeURIComponent(l.id)}`)}
                        style={{ marginTop: 8 }}
                      >
                        Continue editing
                      </button>
                      <button
                        className={styles.deleteListingButton}
                        type="button"
                        onClick={() => archiveListing(l.id)}
                        disabled={actionId === String(l.id)}
                        style={{ marginTop: 8 }}
                      >
                        {actionId === String(l.id) ? "Removing..." : "Discard draft"}
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
              )})}
              </div>
              </div>
            </div>
          </>
        ) : null}
        {activeTab === "inquiries" ? (
          <section aria-label="Lead inbox">
            <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
              Buyer messages from listing pages route here. Mark responded when you&apos;ve replied outside the app —
              deeper CRM wiring can extend this layer later.
            </p>
            <AgentInquiryList
              inquiries={inquiries}
              listingsById={listingsById}
              busyId={inquiryBusyId}
              onMarkResponded={markInquiryResponded}
              onOpenListing={(listingId) => router.push(`/listing/${listingId}`)}
            />
          </section>
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
        </DashboardShell>
      </main>
    </div>
  );
}
