import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useShallow } from "zustand/react/shallow";
import { supabase } from "@/lib/supabaseClient";
import { discardDraftListing } from "@/lib/listingPersistence";
import { getUserActiveListingCount } from "@/lib/listingPersistence";
import ArchiveListingModal from "@/components/listing/ArchiveListingModal";
import MarkRecentlyClosedModal from "@/components/listing/MarkRecentlyClosedModal";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import { MODAL_TYPES, useModalController } from "@/hooks/useModalController";
import UserListingRowIntel from "@/components/user/UserListingRowIntel";
import useAgentDashboardStore from "@/stores/useAgentDashboardStore";
import { useToast } from "@/components/ui/ToastProvider";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import ListingMediaImage from "@/components/listing/ListingMediaImage";
import { IMAGE_QUALITY_THUMB, IMAGE_SIZES_DASHBOARD_THUMB } from "@/constants/imageQuality";
import {
  getArchiveStatus,
  LISTING_LIFECYCLE,
  getLifecycleLabel,
  resolveActiveListingCapForTier,
} from "@/constants/operationalModel";
import { OWNERSHIP_ACTIONS } from "@/constants/ownershipModel";
import { formatListingLocation } from "@/lib/geography/formatListingLocation";
import { getRegionLabel, normalizeRegionSlug } from "@/constants/geographyLayer";
import { resolveListingEditHref } from "@/lib/listingEditAccess";
import {
  applyListingLifecycleAction,
  permanentlyDeleteArchivedListing,
} from "@/utils/ownershipAttribution";
import { buildModerationArchivePatch, buildRecentlyRentedPatch, buildRecentlySoldPatch } from "@/lib/listingWriteContract";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import { isLegacyGenerationDraft } from "@/lib/legacyDraftCompat";
import { resolveLifecycleStatusBadgeSuffix } from "@/lib/dashboardStatusBadges";
import {
  AGENT_INVENTORY_FILTER_OPTIONS,
  AGENT_INVENTORY_FILTERS,
} from "@/constants/dashboardAgentConfig";
import {
  prepareAgentInventoryRows,
} from "@/lib/agentDashboardHelpers";
import { MY_LISTINGS_SORT_KEYS } from "@/lib/userDashboardListingTruth";
import {
  resolveListingCompletionAction,
  resolveListingCompletionButtonClassName,
  warnMissingListingMarketType,
} from "@/lib/listingCompletionAction";
import { resolveListingManagementActions } from "@/lib/listingManagementActions";
import styles from "@/styles/Dashboard.module.css";

function coverUrl(listing) {
  const imgs = Array.isArray(listing?.listing_images) ? listing.listing_images : [];
  const sorted = [...imgs].filter(Boolean).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return sorted[0]?.image_url || "";
}

function emptyVariantForFilter(filter) {
  if (filter === AGENT_INVENTORY_FILTERS.ARCHIVED) return "archived";
  if (filter === AGENT_INVENTORY_FILTERS.REJECTED) return "rejected";
  if (filter === AGENT_INVENTORY_FILTERS.ACTIVE) return "active";
  if (filter === AGENT_INVENTORY_FILTERS.PENDING) return "moderation";
  if (filter === AGENT_INVENTORY_FILTERS.DRAFTS) return "drafts";
  return "listings";
}

function AgentInventoryPanel({ userId, tier, lifecycleFilter, onLifecycleFilterChange }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [actionId, setActionId] = useState("");
  const modal = useModalController();
  const deletePayload = modal.isModalOpen(MODAL_TYPES.DELETE) ? modal.activeModal?.payload : null;
  const archiveTargetId = modal.isModalOpen(MODAL_TYPES.ARCHIVE)
    ? String(modal.activeModal?.payload?.listingId || "")
    : "";
  const closeTarget = modal.isModalOpen(MODAL_TYPES.MARK_RECENTLY_CLOSED)
    ? modal.activeModal?.payload || null
    : null;
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState(MY_LISTINGS_SORT_KEYS.NEWEST);

  const {
    listings,
    loading,
    invalidate,
    patchMyListingRow,
    removeMyListingRow,
    myListingsInitialFetchDone,
  } = useAgentDashboardStore(
    useShallow((s) => ({
      listings: s.myListingsRows,
      loading: s.listingsLoading,
      invalidate: s.invalidate,
      patchMyListingRow: s.patchMyListingRow,
      removeMyListingRow: s.removeMyListingRow,
      myListingsInitialFetchDone: s.myListingsInitialFetchDone,
    }))
  );
  const listingsErrorMessage = useAgentDashboardStore((s) => s.listingsErrorMessage);

  const prevErrRef = useRef(null);
  useEffect(() => {
    if (!listingsErrorMessage) {
      prevErrRef.current = null;
      return;
    }
    if (listingsErrorMessage === prevErrRef.current) return;
    prevErrRef.current = listingsErrorMessage;
    showToast({ type: "error", message: listingsErrorMessage });
  }, [listingsErrorMessage, showToast]);

  const panelListings = useMemo(
    () => prepareAgentInventoryRows(listings, lifecycleFilter, searchQuery, sortKey),
    [listings, lifecycleFilter, searchQuery, sortKey]
  );

  const mayShowEmpty =
    myListingsInitialFetchDone && !loading && !listingsErrorMessage && panelListings.length === 0;
  const mayShowError = myListingsInitialFetchDone && !loading && Boolean(listingsErrorMessage);
  const showSkeleton =
    loading || (!myListingsInitialFetchDone && !listingsErrorMessage && listings.length === 0);

  const editListingHref = (listingId) => resolveListingEditHref(listingId);

  const openMarkRecentlyClosed = (listing) => {
    const action = resolveListingCompletionAction(listing);
    if (!action) {
      warnMissingListingMarketType(listing, "agent-inventory");
      showToast({
        type: "error",
        message: "Set this listing to For Sale or For Rent before marking it closed.",
      });
      return;
    }
    modal.closeAllModals();
    modal.openModal(MODAL_TYPES.MARK_RECENTLY_CLOSED, {
      listingId: String(listing.id),
      title: listing.title || "Listing",
      action,
    });
  };

  const confirmMarkRecentlyClosed = async () => {
    const listingId = closeTarget?.listingId;
    const action = closeTarget?.action;
    if (!listingId || !action) return;
    const optimisticPatch =
      action.ownershipAction === OWNERSHIP_ACTIONS.CLOSE_RENTED
        ? buildRecentlyRentedPatch()
        : buildRecentlySoldPatch();

    setActionId(String(listingId));
    patchMyListingRow(listingId, optimisticPatch);
    const result = await applyListingLifecycleAction(supabase, {
      listingId,
      action: action.ownershipAction,
    });
    if (result.error) {
      setActionId("");
      invalidate();
      showToast({ type: "error", message: result.error?.message || "Unable to update listing status" });
      return;
    }
    if (result.appliedPayload) {
      patchMyListingRow(listingId, result.appliedPayload);
    }
    invalidate();
    showToast({
      type: "success",
      message: action.successMessage,
    });
    setActionId("");
    modal.closeModal(MODAL_TYPES.MARK_RECENTLY_CLOSED);
  };

  const confirmArchiveListing = async () => {
    const listingId = archiveTargetId;
    if (!listingId) return;

    setActionId(String(listingId));
    patchMyListingRow(listingId, buildModerationArchivePatch());
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.ARCHIVE,
      extraUpdates: { status: getArchiveStatus() },
    });
    if (error) {
      setActionId("");
      invalidate();
      showToast({ type: "error", message: error?.message || "Unable to archive listing" });
      return;
    }
    invalidate();
    showToast({ type: "success", message: "Listing archived successfully." });
    setActionId("");
    modal.closeModal(MODAL_TYPES.ARCHIVE);
  };

  const republishListing = async (listingId) => {
    setActionId(String(listingId));
    const tierCap = resolveActiveListingCapForTier(tier);
    if (tierCap != null && userId) {
      const activeCount = await getUserActiveListingCount(supabase, userId);
      if (activeCount >= tierCap) {
        showToast({
          type: "error",
          message: `Active listing limit reached (${tierCap}). Archive another listing before restoring.`,
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
      invalidate();
      showToast({ type: "error", message: error?.message || "Unable to restore listing" });
      return;
    }
    invalidate();
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
      invalidate();
      showToast({ type: "error", message: error?.message || "Unable to resubmit listing" });
      return;
    }
    invalidate();
    showToast({ type: "success", message: "Listing moved to Pending Review" });
    setActionId("");
  };

  const confirmDiscardDraft = async () => {
    const listingId = deletePayload?.id ?? deletePayload;
    if (!listingId || !userId || deletePayload?.variant !== "discard") return;
    setActionId(String(listingId));
    const { error } = await discardDraftListing(supabase, { listingId, userId });
    if (error) {
      setActionId("");
      showToast({ type: "error", message: error?.message || "Unable to discard draft" });
      return;
    }
    modal.closeModal(MODAL_TYPES.DELETE);
    removeMyListingRow(listingId);
    invalidate();
    showToast({ type: "info", message: "Draft discarded" });
    setActionId("");
  };

  const permanentlyDeleteListing = async () => {
    const listingId = deletePayload?.id ?? deletePayload;
    if (!listingId || deletePayload?.variant !== "permanent") return;
    setActionId(`delete:${listingId}`);
    const { error } = await permanentlyDeleteArchivedListing(supabase, {
      listingId,
      statusHint: "archived",
    });
    if (error) {
      showToast({ type: "error", message: error.message || "Unable to permanently delete listing" });
      setActionId("");
      return;
    }
    removeMyListingRow(listingId);
    invalidate();
    showToast({ type: "info", message: "Listing permanently deleted" });
    modal.closeModal(MODAL_TYPES.DELETE);
    setActionId("");
  };

  const openDiscardDraft = (listing) => {
    modal.closeAllModals();
    modal.openModal(MODAL_TYPES.DELETE, {
      id: listing.id,
      title: listing.title,
      variant: "discard",
    });
  };

  const openPermanentDelete = (listing) => {
    modal.closeAllModals();
    modal.openModal(MODAL_TYPES.DELETE, {
      id: listing.id,
      title: listing.title,
      variant: "permanent",
    });
  };

  const openArchiveListing = (listingId) => {
    modal.closeAllModals();
    modal.openModal(MODAL_TYPES.ARCHIVE, { listingId: String(listingId) });
  };

  const emptyProps = {
    variant: emptyVariantForFilter(lifecycleFilter),
    primary: { label: "Create listing", href: "/dashboard/create" },
  };

  return (
    <section aria-label="Listing inventory">
      <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
        Filter by lifecycle stage — active homes are public, pending rows await editorial review, and
        archived inventory stays off the map until you restore it.
      </p>

      <div className={styles.statusToggle} role="tablist" aria-label="Listing lifecycle filter">
        {AGENT_INVENTORY_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={lifecycleFilter === option.value}
            className={`${styles.toggleButton} ${
              lifecycleFilter === option.value ? styles.toggleButtonActive : ""
            }`}
            onClick={() => onLifecycleFilterChange?.(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={styles.userListingToolbar}>
        <label className={styles.userListingSearchWrap}>
          <input
            type="search"
            className={styles.userListingSearch}
            placeholder="Search title or district"
            aria-label="Search listings"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        <select
          className={styles.userListingSelect}
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          aria-label="Sort listings"
        >
          <option value={MY_LISTINGS_SORT_KEYS.NEWEST}>Newest</option>
          <option value={MY_LISTINGS_SORT_KEYS.OLDEST}>Oldest</option>
          <option value={MY_LISTINGS_SORT_KEYS.PRICE_DESC}>Price (high to low)</option>
          <option value={MY_LISTINGS_SORT_KEYS.PRICE_ASC}>Price (low to high)</option>
          <option value={MY_LISTINGS_SORT_KEYS.DISTRICT}>District</option>
        </select>
      </div>

      {showSkeleton ? (
        <div className={styles.pendingGrid}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 140 }} />
          ))}
        </div>
      ) : null}

      {mayShowEmpty ? <PremiumEmptyState compact {...emptyProps} /> : null}

      {mayShowError ? (
        <PremiumEmptyState
          compact
          variant="generic"
          title="We could not load your listings"
          description="Check your connection and try again."
          primary={{ label: "Try again", onClick: () => invalidate() }}
        />
      ) : null}

      <div className={styles.pendingGrid}>
        {!showSkeleton &&
          !mayShowError &&
          panelListings.map((l) => {
            const lc = getLifecycleStatus(l);
            const isArchived = lc === LISTING_LIFECYCLE.ARCHIVED;
            const isRejected = lc === LISTING_LIFECYCLE.REJECTED;
            const isDraft = lc === LISTING_LIFECYCLE.DRAFT;
            const isPublished = lc === LISTING_LIFECYCLE.PUBLISHED;
            const isPending = lc === LISTING_LIFECYCLE.PENDING_REVIEW;
            const isLegacyDraft = isDraft && isLegacyGenerationDraft(l);
            const badgeClass = resolveLifecycleStatusBadgeSuffix(lc, { legacyDraft: isLegacyDraft });
            const thumb = coverUrl(l);
            const districtLabel =
              formatListingLocation(l) || getRegionLabel(normalizeRegionSlug(l.district || ""));
            const mgmt = resolveListingManagementActions(l, { viewerUserId: userId });

            return (
              <div
                key={l.id}
                className={`${styles.card} ${isArchived ? styles.archivedCard : ""} ${
                  isRejected ? styles.rejectedTone : ""
                } ${actionId === String(l.id) || actionId === `delete:${l.id}` ? styles.cardActionBusy : ""}`}
              >
                <div className={styles.userListingCardTop}>
                  <div className={styles.userListingThumb}>
                    {thumb ? (
                      <ListingMediaImage
                        src={thumb}
                        alt=""
                        fill
                        sizes={IMAGE_SIZES_DASHBOARD_THUMB}
                        quality={IMAGE_QUALITY_THUMB}
                        hoverZoom={false}
                      />
                    ) : (
                      <span className={styles.userListingThumbPlaceholder}>No photo</span>
                    )}
                  </div>
                  <div className={styles.userListingCardBody}>
                    <h3 style={{ margin: "0 0 4px" }}>{l.title || "Untitled"}</h3>
                    <p className={styles.muted} style={{ margin: "0 0 6px" }}>
                      {districtLabel || "Belize"} · {Number(l.price || 0).toLocaleString()} BZD
                    </p>
                    <div>
                      <span className={`${styles.statusBadge} ${styles[`status${badgeClass}`]}`}>
                        {isLegacyDraft ? "Legacy Draft" : getLifecycleLabel(lc)}
                      </span>
                    </div>
                    {isArchived ? (
                      <p className={styles.archivedHint}>Hidden from public listings</p>
                    ) : null}
                    {isRejected ? (
                      <p className={styles.archivedHint}>
                        Not public — resubmit after edits for another review.
                      </p>
                    ) : null}
                    {!isDraft ? (
                      <div style={{ marginTop: 10 }}>
                        <UserListingRowIntel listing={l} />
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.userListingActions}>
                    {mgmt.canView ? (
                      <Link className={styles.approveButton} href={`/listing/${l.id}`}>
                        View
                      </Link>
                    ) : null}
                    {mgmt.canDiscardDraft ? (
                      <>
                        <button
                          type="button"
                          className={styles.approveButton}
                          onClick={() => router.push(editListingHref(l.id))}
                        >
                          Continue editing
                        </button>
                        <button
                          type="button"
                          className={styles.deleteListingButton}
                          onClick={() => openDiscardDraft(l)}
                          disabled={actionId === String(l.id)}
                        >
                          Discard draft
                        </button>
                      </>
                    ) : null}
                    {mgmt.canEdit && !mgmt.canDiscardDraft && !mgmt.isRejected ? (
                      <Link className={styles.approveButton} href={editListingHref(l.id)}>
                        Edit
                      </Link>
                    ) : null}
                    {mgmt.completionAction.visible ? (
                      <button
                        type="button"
                        className={resolveListingCompletionButtonClassName(
                          styles,
                          mgmt.completionAction.action.buttonVariant
                        )}
                        onClick={() => openMarkRecentlyClosed(l)}
                        disabled={actionId === String(l.id)}
                      >
                        {mgmt.completionAction.action.label}
                      </button>
                    ) : null}
                    {mgmt.canArchive ? (
                      <button
                        type="button"
                        className={styles.deleteListingButton}
                        onClick={() => openArchiveListing(l.id)}
                        disabled={actionId === String(l.id)}
                      >
                        {actionId === String(l.id)
                          ? "Archiving…"
                          : mgmt.isRecentlyClosed
                            ? "Archive now"
                            : "Archive"}
                      </button>
                    ) : null}
                    {mgmt.isRejected && mgmt.canResubmit ? (
                      <>
                        <Link className={styles.approveButton} href={editListingHref(l.id)}>
                          Edit
                        </Link>
                        <button
                          type="button"
                          className={styles.approveButton}
                          onClick={() => resubmitForReviewListing(l.id)}
                          disabled={actionId === String(l.id)}
                        >
                          {actionId === String(l.id) ? "Submitting…" : "Resubmit"}
                        </button>
                        <button
                          type="button"
                          className={styles.deleteListingButton}
                          onClick={() => openArchiveListing(l.id)}
                          disabled={actionId === String(l.id)}
                        >
                          Archive
                        </button>
                      </>
                    ) : null}
                    {isArchived ? (
                      <>
                        <button
                          type="button"
                          className={styles.approveButton}
                          onClick={() => republishListing(l.id)}
                          disabled={actionId === String(l.id) || actionId === `delete:${l.id}`}
                        >
                          {actionId === String(l.id) ? "Publishing…" : "Re-publish"}
                        </button>
                        <button
                          type="button"
                          className={`${styles.rejectButton} ${styles.quickDangerMuted}`}
                          onClick={() => openPermanentDelete(l)}
                          disabled={actionId === String(l.id) || actionId === `delete:${l.id}`}
                        >
                          Permanently delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <ArchiveListingModal
        open={Boolean(archiveTargetId)}
        isArchiving={Boolean(archiveTargetId && actionId === archiveTargetId)}
        onClose={() => {
          if (actionId === archiveTargetId) return;
          modal.closeModal(MODAL_TYPES.ARCHIVE);
        }}
        onConfirm={confirmArchiveListing}
      />

      <MarkRecentlyClosedModal
        open={Boolean(closeTarget?.listingId)}
        isSubmitting={Boolean(closeTarget?.listingId && actionId === closeTarget.listingId)}
        action={closeTarget?.action || null}
        listingTitle={closeTarget?.title || "Listing"}
        onClose={() => {
          if (actionId === closeTarget?.listingId) return;
          modal.closeModal(MODAL_TYPES.MARK_RECENTLY_CLOSED);
        }}
        onConfirm={confirmMarkRecentlyClosed}
      />

      <DeleteConfirmationModal
        isOpen={modal.isModalOpen(MODAL_TYPES.DELETE)}
        title={
          deletePayload?.variant === "permanent"
            ? "Permanent Deletion"
            : "Discard this draft?"
        }
        warningText={
          deletePayload?.variant === "permanent"
            ? "This permanently removes the listing and associated operational history. This action cannot be undone."
            : "This draft will be permanently removed. This action cannot be undone."
        }
        confirmLabel={deletePayload?.variant === "permanent" ? "Permanently Delete" : "Discard Draft"}
        item={deletePayload}
        requireTypeDelete={deletePayload?.variant === "permanent"}
        loading={
          Boolean(deletePayload?.id) &&
          (deletePayload.variant === "permanent"
            ? actionId === `delete:${deletePayload.id}`
            : actionId === String(deletePayload.id))
        }
        onClose={() => {
          if (
            deletePayload?.variant === "permanent" &&
            actionId === `delete:${deletePayload?.id}`
          ) {
            return;
          }
          if (
            deletePayload?.variant !== "permanent" &&
            actionId === String(deletePayload?.id)
          ) {
            return;
          }
          modal.closeModal(MODAL_TYPES.DELETE);
        }}
        onConfirm={
          deletePayload?.variant === "permanent"
            ? permanentlyDeleteListing
            : confirmDiscardDraft
        }
      />
    </section>
  );
}

export default memo(AgentInventoryPanel);
