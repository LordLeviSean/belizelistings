import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { fetchProfileRowsByIds } from "../lib/profileSelectContract";
import { sanitizeListingMutationPayload } from "../lib/listingPayloadSanitize";
import { LISTING_MUTATION_FLOW, LISTING_MUTATION_OPERATION } from "../lib/listingMutationDiagnostics";
import { clearAllFavoritesForListing } from "../lib/favorites";
import { useToast } from "./ui/ToastProvider";
import HomePropertyCard from "./HomePropertyCard";
import ListingTrustStrip from "./ListingTrustStrip";
import ListingOwnershipMeta from "./ListingOwnershipMeta";
import DeleteConfirmModal from "./DeleteConfirmModal";
import ArchiveListingModal from "./listing/ArchiveListingModal";
import { getSelectableRegions } from "../constants/geographyLayer";
import { getArchiveStatus, getModerationStatus, getRepublishStatus, LISTING_LIFECYCLE } from "../constants/operationalModel";
import styles from "../styles/Dashboard.module.css";
import { getLifecycleStatus, isPubliclyVisibleListing } from "../utils/canonicalListing";
import {
  applyListingLifecycleAction,
  collectListingOwnershipActorIds,
  permanentlyDeleteArchivedListing,
} from "../utils/ownershipAttribution";
import { OWNERSHIP_ACTIONS } from "../constants/ownershipModel";
import PremiumEmptyState, { getPremiumEmptyForRegistryFilter } from "./ui/PremiumEmptyState";
import { formatProfileDisplayLabel } from "../lib/profileDisplayName";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Published", value: "approved" },
  { label: "Pending Review", value: "pending" },
  { label: "Rejected", value: "rejected" },
  { label: "Archived", value: "archived" },
];

const EDITOR_STEPS = [
  { id: "basic", label: "Basic" },
  { id: "location", label: "Location" },
  { id: "pricing", label: "Pricing" },
  { id: "details", label: "Details" },
  { id: "verify", label: "Review" },
  { id: "preview", label: "Preview" },
];
const REGION_OPTIONS = getSelectableRegions();

export default function OperatorListingsPanel({ onAction, profilesRevision = 0 }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const [ownerMap, setOwnerMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [archiveTargetId, setArchiveTargetId] = useState("");
  const [editStep, setEditStep] = useState(0);
  const [editForm, setEditForm] = useState({
    title: "",
    price: "",
    district: "",
    listing_type: "sale",
    property_type: "house",
    beds: "",
    baths: "",
    garage: "",
    status: "pending",
    currency: "BZD",
  });

  const loadListings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("*, listing_images(image_url,position)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[operator-listings-panel] load error", error);
      setLoading(false);
      return;
    }
    const rows = data || [];
    setListings(rows);
    const ownerIds = [
      ...new Set(
        rows
          .flatMap((listing) => [String(listing.user_id || ""), ...collectListingOwnershipActorIds(listing)])
          .filter(Boolean)
      ),
    ];
    if (ownerIds.length > 0) {
      const { data: profileRows } = await fetchProfileRowsByIds(supabase, ownerIds);
      const nextOwnerMap = {};
      for (const profile of profileRows || []) {
        nextOwnerMap[String(profile.id)] = formatProfileDisplayLabel(profile);
      }
      setOwnerMap(nextOwnerMap);
    } else {
      setOwnerMap({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings, profilesRevision]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-listings-operator")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings" },
        () => {
          loadListings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadListings]);

  const filteredListings = useMemo(() => {
    if (statusFilter === "all") return listings;
    return listings.filter((listing) => {
      const lifecycle = getLifecycleStatus(listing);
      if (statusFilter === "approved") return isPubliclyVisibleListing(listing);
      if (statusFilter === "pending") return lifecycle === LISTING_LIFECYCLE.PENDING_REVIEW;
      if (statusFilter === "rejected") return lifecycle === LISTING_LIFECYCLE.REJECTED;
      if (statusFilter === "archived") return lifecycle === LISTING_LIFECYCLE.ARCHIVED;
      return true;
    });
  }, [listings, statusFilter]);
  const confirmArchiveListing = async () => {
    const listingId = archiveTargetId;
    if (!listingId) return;

    setActionKey(`${listingId}:archive`);
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.ARCHIVE,
      extraUpdates: {
        status: getArchiveStatus(),
      },
    });
    if (error) {
      setActionKey("");
      showToast({ type: "error", message: "Unable to archive listing" });
      return;
    }
    const archived = getArchiveStatus();
    setListings((prev) =>
      prev.map((listing) =>
        String(listing.id) === String(listingId)
          ? {
              ...listing,
              status: archived,
              lifecycle_status: archived,
              moderation_status: "archived",
            }
          : listing
      )
    );
    await loadListings();
    onAction?.("Archived listing from operator panel");
    showToast({ type: "success", message: "Listing archived successfully." });
    setActionKey("");
    setArchiveTargetId("");
  };

  const approveListing = async (listingId) => {
    setActionKey(`${listingId}:approve`);
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.APPROVE,
      extraUpdates: { status: getModerationStatus("approved") },
    });
    if (error) {
      setActionKey("");
      showToast({ type: "error", message: "Unable to approve listing" });
      return;
    }
    await clearAllFavoritesForListing(listingId);
    await loadListings();
    onAction?.("Operator approved listing");
    showToast({ type: "success", message: "Listing approved" });
    setActionKey("");
  };

  const rejectListing = async (listingId) => {
    setActionKey(`${listingId}:reject`);
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.REJECT,
      extraUpdates: { status: getModerationStatus("rejected") },
    });
    if (error) {
      setActionKey("");
      showToast({ type: "error", message: "Unable to reject listing" });
      return;
    }
    const rejected = getModerationStatus("rejected");
    setListings((prev) =>
      prev.map((listing) =>
        String(listing.id) === String(listingId)
          ? {
              ...listing,
              status: rejected,
              lifecycle_status: rejected,
              moderation_status: "rejected",
              published_at: null,
              reviewed_at: null,
            }
          : listing
      )
    );
    await clearAllFavoritesForListing(listingId);
    await loadListings();
    onAction?.("Operator rejected listing");
    showToast({ type: "info", message: "Listing moved to Rejected" });
    setActionKey("");
  };

  const resubmitListing = async (listingId) => {
    setActionKey(`${listingId}:resubmit`);
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.RESUBMIT,
      extraUpdates: {},
    });
    if (error) {
      setActionKey("");
      showToast({ type: "error", message: "Unable to resubmit listing" });
      return;
    }
    const pending = getRepublishStatus();
    setListings((prev) =>
      prev.map((listing) =>
        String(listing.id) === String(listingId)
          ? {
              ...listing,
              status: pending,
              lifecycle_status: pending,
              moderation_status: "pending_review",
              published_at: null,
              reviewed_at: null,
            }
          : listing
      )
    );
    await loadListings();
    onAction?.("Operator resubmitted listing");
    showToast({ type: "success", message: "Listing moved to Pending Review" });
    setActionKey("");
  };

  const republishListing = async (listingId) => {
    setActionKey(`${listingId}:republish`);
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.REPUBLISH,
      extraUpdates: {},
    });
    if (error) {
      setActionKey("");
      showToast({ type: "error", message: "Unable to re-publish listing" });
      return;
    }
    const pending = getRepublishStatus();
    setListings((prev) =>
      prev.map((listing) =>
        String(listing.id) === String(listingId)
          ? {
              ...listing,
              status: pending,
              lifecycle_status: pending,
              moderation_status: "pending_review",
              published_at: null,
              reviewed_at: null,
            }
          : listing
      )
    );
    await loadListings();
    onAction?.("Re-published listing to pending");
    showToast({ type: "success", message: "Listing moved to Pending Review" });
    setActionKey("");
  };

  const permanentlyDeleteListing = async () => {
    if (!deleteTarget?.id) return;
    setActionKey(`${deleteTarget.id}:delete-permanent`);
    const { error } = await permanentlyDeleteArchivedListing(supabase, {
      listingId: deleteTarget.id,
      statusHint: deleteTarget.status,
    });
    if (error) {
      setActionKey("");
      showToast({ type: "error", message: error.message || "Unable to permanently delete listing" });
      return;
    }
    await loadListings();
    onAction?.("Permanently deleted archived listing");
    showToast({ type: "info", message: "Listing permanently deleted" });
    setDeleteTarget(null);
    setActionKey("");
  };

  const startEdit = (listing) => {
    setEditingId(String(listing.id));
    setEditStep(0);
    setEditForm({
      title: listing.title || "",
      price: String(listing.price ?? ""),
      district: String(listing.district || ""),
      listing_type: listing.listing_type || "sale",
      property_type: listing.property_type || "house",
      beds: String(listing.beds ?? ""),
      baths: String(listing.baths ?? ""),
      garage: String(listing.garage ?? ""),
      status: listing.status || "pending",
      currency: listing.currency || "BZD",
    });
  };

  const saveEdit = async (listingId) => {
    setActionKey(`${listingId}:edit`);
    const payload = sanitizeListingMutationPayload(
      {
        title: editForm.title.trim(),
        price: Number(editForm.price || 0),
        district: editForm.district.trim(),
        listing_type: editForm.listing_type,
        property_type: editForm.property_type,
        beds: editForm.beds === "" ? null : Number(editForm.beds),
        baths: editForm.baths === "" ? null : Number(editForm.baths),
        garage: editForm.garage === "" ? null : Number(editForm.garage),
        status: editForm.status,
        currency: editForm.currency || "BZD",
      },
      { mutationFlow: LISTING_MUTATION_FLOW.UNSPECIFIED, operation: LISTING_MUTATION_OPERATION.PATCH }
    );
    const { error } = await supabase.from("listings").update(payload).eq("id", listingId);
    if (error) {
      console.error("[operator-listings-panel] edit error", error);
      setActionKey("");
      showToast({ type: "error", message: "Unable to update listing" });
      return;
    }
    const prior = listings.find((l) => String(l.id) === String(listingId));
    if (
      String(editForm.status || "").toLowerCase() === getModerationStatus("approved") &&
      prior &&
      getLifecycleStatus(prior) !== getModerationStatus("approved")
    ) {
      await clearAllFavoritesForListing(listingId);
    }
    setEditingId("");
    await loadListings();
    onAction?.("Updated listing from operator panel");
    showToast({ type: "success", message: "Listing updated" });
    setActionKey("");
  };

  const renderEditStepFields = () => {
    const stepId = EDITOR_STEPS[editStep]?.id;
    if (stepId === "basic") {
      return (
        <>
          <input className={styles.input} value={editForm.title} onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Title" />
          <select className={styles.select} value={editForm.property_type} onChange={(event) => setEditForm((prev) => ({ ...prev, property_type: event.target.value }))}>
            <option value="house">house</option>
            <option value="apartment">apartment</option>
            <option value="condo">condo</option>
            <option value="land">land</option>
            <option value="commercial">commercial</option>
          </select>
        </>
      );
    }
    if (stepId === "location") {
      return (
        <select className={styles.select} value={editForm.district} onChange={(event) => setEditForm((prev) => ({ ...prev, district: event.target.value }))}>
          {REGION_OPTIONS.map((region) => (
            <option key={region.slug} value={region.slug}>
              {region.label}
            </option>
          ))}
        </select>
      );
    }
    if (stepId === "pricing") {
      return (
        <>
          <input className={styles.input} value={editForm.price} onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))} placeholder="Price" />
          <div className={styles.modalGridCols}>
            <select className={styles.select} value={editForm.listing_type} onChange={(event) => setEditForm((prev) => ({ ...prev, listing_type: event.target.value }))}>
              <option value="sale">sale</option>
              <option value="rent">rent</option>
            </select>
            <select className={styles.select} value={editForm.status} onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="approved">published</option>
              <option value="pending">pending review</option>
              <option value="rejected">rejected</option>
              <option value="draft">draft</option>
              <option value="archived">archived</option>
            </select>
          </div>
        </>
      );
    }
    if (stepId === "details") {
      return (
        <div className={styles.modalGridCols}>
          <input className={styles.input} value={editForm.beds} onChange={(event) => setEditForm((prev) => ({ ...prev, beds: event.target.value }))} placeholder="Beds" />
          <input className={styles.input} value={editForm.baths} onChange={(event) => setEditForm((prev) => ({ ...prev, baths: event.target.value }))} placeholder="Baths" />
          <input className={styles.input} value={editForm.garage} onChange={(event) => setEditForm((prev) => ({ ...prev, garage: event.target.value }))} placeholder="Garage" />
        </div>
      );
    }
    if (stepId === "verify") {
      return (
        <div className={styles.modalForm}>
          <p className={styles.muted}>Ready for review: {editForm.title && editForm.price ? "Yes" : "Needs detail"}</p>
          <p className={styles.muted}>Verification pending: {editForm.district ? "Structured" : "Incomplete location"}</p>
          <p className={styles.muted}>Approved for publishing: {editForm.status === "approved" ? "Approved" : "Pending state"}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={styles.pendingGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 120 }} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.pendingGrid}>
      <div className={styles.statusToggle} role="tablist" aria-label="Operator listing status filter">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={statusFilter === filter.value}
            className={`${styles.toggleButton} ${statusFilter === filter.value ? styles.toggleButtonActive : ""}`}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filteredListings.length === 0 ? (
        <PremiumEmptyState compact {...getPremiumEmptyForRegistryFilter(statusFilter)} />
      ) : null}

      {filteredListings.map((listing) => {
        const imageUrl = listing?.listing_images?.[0]?.image_url || "/placeholder.jpg";
        const lifecycle = getLifecycleStatus(listing);
        const isArchived = lifecycle === LISTING_LIFECYCLE.ARCHIVED;
        const isRejected = lifecycle === LISTING_LIFECYCLE.REJECTED;
        const isPending = lifecycle === LISTING_LIFECYCLE.PENDING_REVIEW;
        const isPublished = isPubliclyVisibleListing(listing);
        const isBusy = actionKey.startsWith(`${listing.id}:`);
        return (
          <div
            key={listing.id}
            className={`${styles.pendingCard} ${isArchived ? styles.archivedCard : ""} ${isPending ? styles.pendingTone : ""} ${
              isRejected ? styles.rejectedTone : ""
            } ${isBusy ? styles.cardActionBusy : ""}`}
          >
            <img src={imageUrl} alt={listing.title || "Listing"} className={styles.pendingImage} />
            <div className={styles.pendingBody}>
              <div className={styles.pendingMeta}>
                <h3 className={styles.pendingTitle}>{listing.title || "Untitled listing"}</h3>
                <p className={styles.pendingPrice}>
                  {Number(listing.price || 0).toLocaleString()} {listing.currency || "BZD"}
                </p>
                <p className={styles.pendingSubtle}>
                  Owner: {ownerMap[String(listing.user_id)] || String(listing.user_id || "unknown")}
                </p>
                <ListingOwnershipMeta listing={listing} ownerMap={ownerMap} />
                <ListingTrustStrip listing={listing} variant="operator" mode="single" />
                {isArchived ? (
                  <p className={styles.pendingSubtle}>
                    Eligible for restore or permanent deletion
                  </p>
                ) : null}
                {isRejected ? (
                  <p className={styles.pendingSubtle}>Edit if needed, then resubmit for review.</p>
                ) : null}
              </div>
              <div className={styles.adminActionRow}>
                {isArchived ? (
                  <>
                    <button
                      type="button"
                      className={styles.approveButton}
                      onClick={() => republishListing(listing.id)}
                      disabled={isBusy}
                    >
                      {actionKey === `${listing.id}:republish` ? "Publishing..." : "Re-publish"}
                    </button>
                    <button
                      type="button"
                      className={`${styles.rejectButton} ${styles.quickDangerMuted}`}
                      onClick={() => setDeleteTarget({ id: listing.id, status: listing.status })}
                      disabled={isBusy}
                    >
                      Permanently Delete
                    </button>
                  </>
                ) : isRejected ? (
                  <>
                    <button
                      type="button"
                      className={styles.approveButton}
                      onClick={() => resubmitListing(listing.id)}
                      disabled={isBusy}
                    >
                      {actionKey === `${listing.id}:resubmit` ? "Submitting..." : "Resubmit for Review"}
                    </button>
                    <button
                      type="button"
                      className={styles.deleteListingButton}
                      onClick={() => setArchiveTargetId(String(listing.id))}
                      disabled={isBusy}
                    >
                      {actionKey === `${listing.id}:archive` ? "Removing..." : "Archive"}
                    </button>
                    <button type="button" className={styles.dashboardLink} onClick={() => startEdit(listing)} disabled={isBusy}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.dashboardLink}
                      onClick={() => router.push(`/listing/${listing.id}?admin=true`)}
                      disabled={isBusy}
                    >
                      View
                    </button>
                  </>
                ) : (
                  <>
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          className={styles.approveButton}
                          onClick={() => approveListing(listing.id)}
                          disabled={isBusy}
                        >
                          {actionKey === `${listing.id}:approve` ? "Approving..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          className={styles.rejectButton}
                          onClick={() => rejectListing(listing.id)}
                          disabled={isBusy}
                        >
                          {actionKey === `${listing.id}:reject` ? "Rejecting..." : "Reject"}
                        </button>
                      </>
                    ) : null}
                    {isPublished && !isPending ? (
                      <button
                        type="button"
                        className={styles.rejectButton}
                        onClick={() => rejectListing(listing.id)}
                        disabled={isBusy}
                      >
                        {actionKey === `${listing.id}:reject` ? "Rejecting..." : "Reject"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.dashboardLink}
                      onClick={() => router.push(`/listing/${listing.id}?admin=true`)}
                      disabled={isBusy}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className={styles.deleteListingButton}
                      onClick={() => setArchiveTargetId(String(listing.id))}
                      disabled={isBusy}
                    >
                      {actionKey === `${listing.id}:archive` ? "Removing..." : "Remove Listing"}
                    </button>
                    <button
                      type="button"
                      className={styles.dashboardLink}
                      onClick={() => startEdit(listing)}
                      disabled={isBusy}
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {editingId ? (
        <div className={styles.modalBackdrop} onClick={() => setEditingId("")}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className={styles.sectionTitle}>Edit Listing · Editorial Mode</h3>
            <p className={styles.muted} style={{ marginTop: 0 }}>
              Curate listing quality with live BelizeListings card preview.
            </p>
            <div className={styles.statusToggle} style={{ marginBottom: 8 }}>
              {EDITOR_STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  className={`${styles.toggleButton} ${idx === editStep ? styles.toggleButtonActive : ""}`}
                  onClick={() => setEditStep(idx)}
                >
                  {step.label}
                </button>
              ))}
            </div>
            <div className={styles.modalForm}>
              {renderEditStepFields()}
              <div style={{ marginTop: 6 }}>
                <p className={styles.muted} style={{ margin: "0 0 6px" }}>Live Public Preview</p>
                <HomePropertyCard
                  listing={{
                    id: editingId || "edit-preview",
                    title: editForm.title || "Belize Property",
                    price: Number(editForm.price || 0),
                    district: editForm.district || "belize",
                    property_type: editForm.property_type || "house",
                    listing_type: editForm.listing_type || "sale",
                    beds: Number(editForm.beds || 0),
                    baths: Number(editForm.baths || 0),
                    currency: editForm.currency || "BZD",
                    images: [],
                  }}
                  imageSizes="(max-width: 760px) 100vw, 320px"
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.dashboardLink}
                onClick={() => setEditStep((prev) => Math.max(0, prev - 1))}
                disabled={editStep === 0}
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.dashboardLink}
                onClick={() => setEditStep((prev) => Math.min(EDITOR_STEPS.length - 1, prev + 1))}
                disabled={editStep === EDITOR_STEPS.length - 1}
              >
                Next
              </button>
              <button type="button" className={styles.approveButton} onClick={() => saveEdit(editingId)} disabled={actionKey === `${editingId}:edit`}>
                {actionKey === `${editingId}:edit` ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" className={styles.rejectButton} onClick={() => { setEditingId(""); setEditStep(0); }}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
      <ArchiveListingModal
        open={Boolean(archiveTargetId)}
        isArchiving={Boolean(archiveTargetId && actionKey === `${archiveTargetId}:archive`)}
        onClose={() => {
          if (actionKey === `${archiveTargetId}:archive`) return;
          setArchiveTargetId("");
        }}
        onConfirm={confirmArchiveListing}
      />
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={permanentlyDeleteListing}
        loading={Boolean(deleteTarget) && actionKey === `${deleteTarget.id}:delete-permanent`}
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
    </div>
  );
}
