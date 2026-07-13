import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { fetchProfileRowsByIds } from "../lib/profileSelectContract";
import { sanitizeListingMutationPayload } from "../lib/listingPayloadSanitize";
import { LISTING_MUTATION_FLOW, LISTING_MUTATION_OPERATION } from "../lib/listingMutationDiagnostics";
import { clearAllFavoritesForListing } from "../lib/favorites";
import { traceAction, traceLog } from "../lib/trace";
import { useToast } from "./ui/ToastProvider";
import ListingCard from "./ListingCard";
import ListingOwnershipMeta from "./ListingOwnershipMeta";
import AdminListingTrustAction from "./admin/AdminListingTrustAction";
import AdminListingActionConfirmModal from "./admin/AdminListingActionConfirmModal";
import {
  shouldSkipVerificationRealtimeReload,
  UNVERIFY_CONFIRM_COPY,
} from "./admin/adminListingTrustActionState";
import { applyListingVerificationAction } from "../lib/listingVerificationMutations";
import useUserRole from "../hooks/useUserRole";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { MODAL_TYPES, useModalController } from "@/hooks/useModalController";
import ArchiveListingModal from "./listing/ArchiveListingModal";
import GeographyLocationEditLink from "@/components/geography/GeographyLocationEditLink";
import { formatListingLocation } from "@/lib/geography/formatListingLocation";
import { resolveListingEditHref } from "@/lib/listingEditAccess";
import {
  getArchiveStatus,
  getLifecycleLabel,
  getModerationStatus,
  getRepublishStatus,
  LISTING_LIFECYCLE,
} from "../constants/operationalModel";
import styles from "../styles/Dashboard.module.css";
import { getLifecycleStatus, isPubliclyVisibleListing } from "../utils/canonicalListing";
import { isLandInventoryListing } from "../utils/listingPresentation";
import {
  applyListingLifecycleAction,
  collectListingOwnershipActorIds,
  permanentlyDeleteArchivedListing,
} from "../utils/ownershipAttribution";
import { OWNERSHIP_ACTIONS } from "../constants/ownershipModel";
import PremiumEmptyState, { getPremiumEmptyForRegistryFilter } from "./ui/PremiumEmptyState";
import ListingMediaImage from "./listing/ListingMediaImage";
import { IMAGE_QUALITY_THUMB, IMAGE_SIZES_ADMIN_ROW_THUMB } from "../constants/imageQuality";
import { formatProfileDisplayLabel } from "../lib/profileDisplayName";
import { getListingCoverImageUrl } from "../utils/listingImage";

const EDITOR_STEPS = [
  { id: "basic", label: "Basic" },
  { id: "location", label: "Location" },
  { id: "pricing", label: "Pricing" },
  { id: "details", label: "Details" },
  { id: "verify", label: "Review" },
  { id: "preview", label: "Preview" },
];
const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Published", value: "approved" },
  { label: "Pending Review", value: "pending" },
  { label: "Rejected", value: "rejected" },
  { label: "Archived", value: "archived" },
];

export default function AllListingsPanel({ onAction, profilesRevision = 0, listingsRevision = 0 }) {
  const router = useRouter();
  const { user } = useUserRole();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const [ownerMap, setOwnerMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const modal = useModalController();
  const [editStep, setEditStep] = useState(0);
  const deletePayload = modal.isModalOpen(MODAL_TYPES.DELETE) ? modal.activeModal?.payload : null;
  const archiveTargetId = modal.isModalOpen(MODAL_TYPES.ARCHIVE)
    ? String(modal.activeModal?.payload?.listingId || "")
    : "";
  const editingId = modal.isModalOpen(MODAL_TYPES.EDIT)
    ? String(modal.activeModal?.payload?.listingId || "")
    : "";
  const unverifyTargetId =
    modal.isModalOpen(MODAL_TYPES.ADMIN_ACTION) &&
    modal.activeModal?.payload?.action === "unverify"
      ? String(modal.activeModal?.payload?.listingId || "")
      : "";
  const [statusFilter, setStatusFilter] = useState("all");
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

  const actionKeyRef = useRef("");
  const unverifyTargetIdRef = useRef("");

  const setVerificationActionKey = useCallback((next) => {
    const key = String(next || "");
    actionKeyRef.current = key;
    setActionKey(key);
  }, []);

  const setUnverifyTarget = useCallback(
    (next) => {
      const id = String(next || "");
      unverifyTargetIdRef.current = id;
      if (!id) {
        modal.closeModal(MODAL_TYPES.ADMIN_ACTION);
        return;
      }
      modal.closeAllModals();
      modal.openModal(MODAL_TYPES.ADMIN_ACTION, { listingId: id, action: "unverify" });
    },
    [modal]
  );

  const loadListings = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("*, listing_images(image_url,position)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[all-listings-panel] load error", error);
      if (!background) setLoading(false);
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
    if (!background) setLoading(false);
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings, profilesRevision, listingsRevision]);
  const filteredListings = useMemo(() => {
    if (statusFilter === "all") return listings;
    return listings.filter((listing) => {
      const lifecycle = getLifecycleStatus(listing);
      if (statusFilter === "pending") return lifecycle === LISTING_LIFECYCLE.PENDING_REVIEW;
      if (statusFilter === "approved") return isPubliclyVisibleListing(listing);
      if (statusFilter === "rejected") return lifecycle === LISTING_LIFECYCLE.REJECTED;
      if (statusFilter === "archived") return lifecycle === LISTING_LIFECYCLE.ARCHIVED;
      return true;
    });
  }, [listings, statusFilter]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-listings-all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings" },
        () => {
          if (
            shouldSkipVerificationRealtimeReload(actionKeyRef.current, unverifyTargetIdRef.current)
          ) {
            return;
          }
          void loadListings({ background: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadListings]);

  const approveListing = async (listingId) => {
    setActionKey(`${listingId}:approve`);
    traceAction({
      type: "admin_approve_listing",
      payload: { listingId },
    });
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.APPROVE,
      extraUpdates: {
        status: getModerationStatus("approved"),
      },
    });
    traceAction({
      type: "admin_approve_listing_result",
      payload: { listingId },
      result: { ok: !error, error: error?.message ?? null },
    });
    if (error) {
      console.error("[all-listings-panel] approve error", error);
      setActionKey("");
      return;
    }
    await clearAllFavoritesForListing(listingId);
    await loadListings();
    onAction?.("Approved listing");
    showToast({ type: "success", message: "Listing approved" });
    setActionKey("");
  };

  const rejectListing = async (listingId) => {
    setActionKey(`${listingId}:reject`);
    traceAction({
      type: "admin_reject_listing",
      payload: { listingId },
    });
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.REJECT,
      extraUpdates: {
        status: getModerationStatus("rejected"),
      },
    });
    traceAction({
      type: "admin_reject_listing_result",
      payload: { listingId },
      result: { ok: !error, error: error?.message ?? null },
    });
    if (error) {
      console.error("[all-listings-panel] reject error", error);
      setActionKey("");
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
    onAction?.("Rejected listing");
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
      showToast({ type: "error", message: "Unable to resubmit listing" });
      setActionKey("");
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
    onAction?.("Resubmitted listing to pending review");
    showToast({ type: "success", message: "Listing moved to Pending Review" });
    setActionKey("");
  };

  const runListingVerification = useCallback(
    async (listingId, verified) => {
      const id = String(listingId || "").trim();
      if (!id || !user?.id) return;

      setVerificationActionKey(`${id}:verify`);
      try {
        const result = await applyListingVerificationAction({
          listingId: id,
          verified,
          adminUserId: user.id,
          client: supabase,
        });
        if (!result.ok) {
          console.error("[all-listings-panel] verification update failed", result.error);
          showToast({
            type: "error",
            message: verified ? "Unable to verify listing" : "Unable to remove verification",
          });
          return;
        }

        const patch = result.data || {};
        setListings((prev) =>
          prev.map((row) =>
            String(row.id) === id
              ? {
                  ...row,
                  verification_status:
                    patch.verification_status ?? (verified ? "verified" : "unverified"),
                  verified_at: patch.verified_at ?? (verified ? new Date().toISOString() : null),
                  verified_by: patch.verified_by ?? (verified ? user.id : null),
                }
              : row
          )
        );
        onAction?.(verified ? "Verified listing" : "Removed listing verification");
        showToast({
          type: "success",
          message: verified ? "Listing verified" : "Verification removed",
        });
        if (!verified) setUnverifyTarget("");
      } catch (error) {
        console.error("[all-listings-panel] verification update threw", error);
        showToast({
          type: "error",
          message: verified ? "Unable to verify listing" : "Unable to remove verification",
        });
      } finally {
        setVerificationActionKey("");
      }
    },
    [onAction, setUnverifyTarget, setVerificationActionKey, showToast, user?.id]
  );

  const confirmArchiveListing = async () => {
    const listingId = archiveTargetId;
    if (!listingId) return;

    setActionKey(`${listingId}:archive`);
    traceAction({
      type: "admin_archive_listing",
      payload: { listingId },
    });
    const archiveResult = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.ARCHIVE,
      extraUpdates: {
        status: getArchiveStatus(),
      },
    });
    const { error } = archiveResult;
    traceAction({
      type: "admin_archive_listing_result",
      payload: { listingId },
      result: {
        ok: !error,
        error: error?.message ?? null,
        usedMinimalFallback: archiveResult.meta?.usedMinimalFallback ?? false,
      },
    });
    if (error) {
      console.error("[all-listings-panel] archive error", error);
      showToast({ type: "error", message: "Unable to archive listing" });
      setActionKey("");
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
    traceLog("ARCHIVE RESULT:", {
      listingId,
      appliedPayload: archiveResult.appliedPayload,
      meta: archiveResult.meta,
      error: null,
    });
    await loadListings();
    onAction?.("Archived listing");
    showToast({ type: "success", message: "Listing archived successfully." });
    setActionKey("");
    modal.closeModal(MODAL_TYPES.ARCHIVE);
  };

  const restoreListing = async (listingId) => {
    setActionKey(`${listingId}:restore`);
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.REPUBLISH,
      extraUpdates: {},
    });
    if (error) {
      showToast({ type: "error", message: "Unable to restore listing" });
      setActionKey("");
      return;
    }
    await loadListings();
    onAction?.("Restored archived listing");
    showToast({ type: "success", message: "Listing moved to Pending Review" });
    setActionKey("");
  };

  const permanentlyDeleteListing = async () => {
    if (!deletePayload?.id) return;
    setActionKey(`${deletePayload.id}:delete-permanent`);
    const { error } = await permanentlyDeleteArchivedListing(supabase, {
      listingId: deletePayload.id,
      statusHint: deletePayload.status,
    });
    if (error) {
      console.error("[all-listings-panel] permanent delete error", error);
      showToast({
        type: "error",
        message: error.message || "Unable to permanently delete listing",
      });
      setActionKey("");
      return;
    }
    setListings((prev) =>
      prev.filter((listing) => String(listing.id) !== String(deletePayload.id))
    );
    await loadListings();
    onAction?.("Permanently deleted archived listing");
    showToast({ type: "info", message: "Listing permanently deleted" });
    modal.closeModal(MODAL_TYPES.DELETE);
    setActionKey("");
  };

  const closeEditModal = useCallback(() => {
    modal.closeModal(MODAL_TYPES.EDIT);
    setEditStep(0);
  }, [modal]);

  const openPermanentDelete = (listing) => {
    modal.closeAllModals();
    modal.openModal(MODAL_TYPES.DELETE, {
      id: listing.id,
      status: listing.status,
      title: listing.title,
    });
  };

  const openArchiveListing = (listingId) => {
    modal.closeAllModals();
    modal.openModal(MODAL_TYPES.ARCHIVE, { listingId: String(listingId) });
  };

  const startEdit = (listing) => {
    modal.closeAllModals();
    modal.openModal(MODAL_TYPES.EDIT, { listingId: String(listing.id) });
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
      console.error("[all-listings-panel] edit error", error);
      setActionKey("");
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
    modal.closeModal(MODAL_TYPES.EDIT);
    await loadListings();
    onAction?.("Updated listing");
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
      const listing = listings.find((l) => String(l.id) === String(modal.payload?.listingId));
      return <GeographyLocationEditLink listing={listing} />;
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
      const listing = listings.find((l) => String(l.id) === String(modal.payload?.listingId));
      const locationOk = Boolean(formatListingLocation(listing));
      return (
        <div className={styles.modalForm}>
          <p className={styles.muted}>Ready for review: {editForm.title && editForm.price ? "Yes" : "Needs detail"}</p>
          <p className={styles.muted}>Location: {locationOk ? formatListingLocation(listing) : "Edit in listing workspace"}</p>
          <p className={styles.muted}>Approved for publishing: {editForm.status === "approved" ? "Approved" : "Pending state"}</p>
        </div>
      );
    }
    return null;
  };

  if (loading && listings.length === 0) {
    return (
      <div className={styles.listingsTable}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={`${styles.listingsRow} skeleton`} style={{ minHeight: 76 }} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.listingsTable}>
      <div className={styles.statusToggle} role="tablist" aria-label="Admin listings status filter">
        {STATUS_FILTERS.map((filter) => (
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
      <div className={styles.listingsHeaderRow}>
        <span>Image</span>
        <span>Title</span>
        <span>Owner</span>
        <span>Status</span>
        <span>Price</span>
        <span>Actions</span>
      </div>
      {filteredListings.map((listing) => {
        const imageUrl = getListingCoverImageUrl(listing) || "/placeholder.jpg";
        const effectiveLifecycle = getLifecycleStatus(listing);
        const isArchived = effectiveLifecycle === LISTING_LIFECYCLE.ARCHIVED;
        const isRejected = effectiveLifecycle === LISTING_LIFECYCLE.REJECTED;
        const lcLabel = effectiveLifecycle || "draft";
        const statusClassKey = `${lcLabel.charAt(0).toUpperCase()}${lcLabel.slice(1)}`;
        const rowBusy =
          actionKey === `${listing.id}:approve` ||
          actionKey === `${listing.id}:reject` ||
          actionKey === `${listing.id}:archive` ||
          actionKey === `${listing.id}:resubmit` ||
          actionKey === `${listing.id}:verify`;
        const rowIsLand = isLandInventoryListing(listing);
        return (
        <div key={listing.id} className={styles.listingsRow}>
          <div className={styles.listingsThumb}>
            <ListingMediaImage
              src={imageUrl}
              alt={listing.title || "Listing"}
              fill
              sizes={IMAGE_SIZES_ADMIN_ROW_THUMB}
              quality={IMAGE_QUALITY_THUMB}
              hoverZoom={false}
            />
          </div>
          <div>
            {editingId === String(listing.id) ? null : (
              <>
                <p><strong>{listing.title || "Untitled listing"}</strong></p>
                <p className={styles.muted}>
                  {formatListingLocation(listing) || "Unknown region"} · {listing.listing_type || "unknown"}
                  {rowIsLand ? "" : ` · ${listing.beds ?? 0} bd / ${listing.baths ?? 0} ba`}
                </p>
                {isArchived ? (
                  <p className={styles.muted}>Eligible for restore or permanent deletion</p>
                ) : null}
                {isRejected ? (
                  <p className={styles.muted}>Edit if needed, then resubmit for review.</p>
                ) : null}
                <ListingOwnershipMeta listing={listing} ownerMap={ownerMap} />
                <AdminListingTrustAction
                  listing={listing}
                  busy={actionKey === `${listing.id}:verify`}
                  onVerify={() => void runListingVerification(listing.id, true)}
                  onRequestUnverify={() => setUnverifyTarget(String(listing.id))}
                />
              </>
            )}
          </div>
          <p className={styles.muted}>{ownerMap[String(listing.user_id)] || String(listing.user_id || "unknown")}</p>
          <span className={`${styles.statusBadge} ${styles[`status${statusClassKey}`]}`}>
            {getLifecycleLabel(effectiveLifecycle)}
          </span>
          <p className={styles.muted}>{Number(listing.price || 0).toLocaleString()} {listing.currency || "BZD"}</p>
          <div className={styles.rowActions}>
            {editingId === String(listing.id) ? (
              <button type="button" className={styles.rejectButton} onClick={closeEditModal}>Close</button>
            ) : (
              <>
            {isArchived ? (
              <>
                <button
                  type="button"
                  className={styles.approveButton}
                  onClick={() => restoreListing(listing.id)}
                  disabled={actionKey === `${listing.id}:restore` || actionKey === `${listing.id}:delete-permanent`}
                >
                  {actionKey === `${listing.id}:restore` ? "Restoring..." : "Restore"}
                </button>
                <button
                  type="button"
                  className={`${styles.rejectButton} ${styles.quickDangerMuted}`}
                  onClick={() => openPermanentDelete(listing)}
                  disabled={actionKey === `${listing.id}:delete-permanent`}
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
                  disabled={rowBusy || actionKey === `${listing.id}:resubmit`}
                >
                  {actionKey === `${listing.id}:resubmit` ? "Submitting..." : "Resubmit for Review"}
                </button>
                <button
                  type="button"
                  className={styles.deleteListingButton}
                  onClick={() => openArchiveListing(listing.id)}
                  disabled={rowBusy}
                >
                  {actionKey === `${listing.id}:archive` ? "Processing..." : "Archive"}
                </button>
                <button type="button" className={styles.dashboardLink} onClick={() => startEdit(listing)} disabled={rowBusy}>
                  Edit
                </button>
                <button type="button" className={styles.dashboardLink} onClick={() => router.push(`/listing/${listing.id}?admin=true`)}>
                  View
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.approveButton}
                  onClick={() => approveListing(listing.id)}
                  disabled={rowBusy}
                >
                  {actionKey === `${listing.id}:approve` ? "Processing..." : "Approve"}
                </button>
                <button
                  type="button"
                  className={styles.rejectButton}
                  onClick={() => rejectListing(listing.id)}
                  disabled={rowBusy}
                >
                  {actionKey === `${listing.id}:reject` ? "Processing..." : "Reject"}
                </button>
                <button
                  type="button"
                  className={styles.deleteListingButton}
                  onClick={() => openArchiveListing(listing.id)}
                  disabled={rowBusy}
                >
                  {actionKey === `${listing.id}:archive` ? "Processing..." : "Archive"}
                </button>
                <button type="button" className={styles.dashboardLink} onClick={() => startEdit(listing)} disabled={rowBusy}>
                  Edit
                </button>
                <button type="button" className={styles.dashboardLink} onClick={() => router.push(`/listing/${listing.id}?admin=true`)}>
                  View
                </button>
              </>
            )}
              </>
            )}
          </div>
        </div>
      )})}
      {!filteredListings.length ? (
        <PremiumEmptyState compact {...getPremiumEmptyForRegistryFilter(statusFilter)} />
      ) : null}
      {editingId ? (
        <div className={styles.modalBackdrop} onClick={closeEditModal}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className={styles.sectionTitle}>Edit Listing · Editorial Mode</h3>
            <p className={styles.muted} style={{ marginTop: 0 }}>
              Refine listing details with a live BelizeListings preview before saving.
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
                <ListingCard
                  listing={{
                    ...(listings.find((l) => String(l.id) === String(editingId)) || {}),
                    id: editingId || "edit-preview",
                    title: editForm.title || "Belize Property",
                    price: Number(editForm.price || 0),
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
              <button type="button" className={styles.rejectButton} onClick={closeEditModal}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
      <ArchiveListingModal
        open={Boolean(archiveTargetId)}
        isArchiving={Boolean(archiveTargetId && actionKey === `${archiveTargetId}:archive`)}
        onClose={() => {
          if (actionKey === `${archiveTargetId}:archive`) return;
          modal.closeModal(MODAL_TYPES.ARCHIVE);
        }}
        onConfirm={confirmArchiveListing}
      />
      <AdminListingActionConfirmModal
        open={Boolean(unverifyTargetId)}
        busy={Boolean(unverifyTargetId && actionKey === `${unverifyTargetId}:verify`)}
        onClose={() => {
          if (actionKey === `${unverifyTargetId}:verify`) return;
          setUnverifyTarget("");
        }}
        onConfirm={() => void runListingVerification(unverifyTargetId, false)}
        {...UNVERIFY_CONFIRM_COPY}
      />
      <DeleteConfirmationModal
        isOpen={modal.isModalOpen(MODAL_TYPES.DELETE)}
        title="Permanent Deletion"
        warningText="This permanently removes the listing and associated operational history. This action cannot be undone."
        confirmLabel="Permanently Delete"
        item={deletePayload}
        requireTypeDelete
        loading={
          Boolean(deletePayload?.id) &&
          actionKey === `${deletePayload.id}:delete-permanent`
        }
        onClose={() => {
          if (actionKey === `${deletePayload?.id}:delete-permanent`) return;
          modal.closeModal(MODAL_TYPES.DELETE);
        }}
        onConfirm={permanentlyDeleteListing}
      />
    </div>
  );
}
