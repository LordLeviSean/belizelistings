import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useShallow } from "zustand/react/shallow";
import { supabase } from "@/lib/supabaseClient";
import { discardDraftListing } from "@/lib/listingPersistence";
import { isLegacyGenerationDraft } from "@/lib/legacyDraftCompat";
import { resolveLifecycleStatusBadgeSuffix } from "@/lib/dashboardStatusBadges";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import { MODAL_TYPES, useModalController } from "@/hooks/useModalController";
import ArchiveListingModal from "@/components/listing/ArchiveListingModal";
import MarkRecentlyClosedModal from "@/components/listing/MarkRecentlyClosedModal";
import UserListingRowIntel from "@/components/user/UserListingRowIntel";
import useUserDashboardStore from "@/stores/useUserDashboardStore";
import { useToast } from "@/components/ui/ToastProvider";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import ListingMediaImage from "@/components/listing/ListingMediaImage";
import { IMAGE_QUALITY_THUMB, IMAGE_SIZES_DASHBOARD_THUMB } from "@/constants/imageQuality";
import {
  getArchiveStatus,
  LISTING_LIFECYCLE,
  PLATFORM_TIERS,
  getLifecycleLabel,
} from "@/constants/operationalModel";
import { OWNERSHIP_ACTIONS } from "@/constants/ownershipModel";
import { formatListingLocation } from "@/lib/geography/formatListingLocation";
import { getRegionLabel, normalizeRegionSlug } from "@/constants/geographyLayer";
import { applyListingLifecycleAction } from "@/utils/ownershipAttribution";
import {
  buildModerationArchivePatch,
  buildRecentlyRentedPatch,
  buildRecentlySoldPatch,
} from "@/lib/listingWriteContract";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import {
  MY_LISTINGS_SORT_KEYS,
  MY_LISTINGS_STATUS_FILTERS,
  filterMyListingsPanelRows,
  filterMyListingsPanelRowsBySearch,
  filterMyListingsPanelRowsByStatus,
  sortMyListingsPanelRows,
} from "@/lib/userDashboardListingTruth";
import { resolveListingEditHref } from "@/lib/listingEditAccess";
import {
  resolveListingCompletionAction,
  resolveListingCompletionButtonClassName,
  warnMissingListingMarketType,
} from "@/lib/listingCompletionAction";
import styles from "@/styles/Dashboard.module.css";

function coverUrl(listing) {
  const imgs = Array.isArray(listing?.listing_images) ? listing.listing_images : [];
  const sorted = [...imgs].filter(Boolean).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const first = sorted[0];
  return first?.image_url || "";
}

function UserMyListingsPanel({ userId, tier }) {
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
  const [statusFilter, setStatusFilter] = useState(MY_LISTINGS_STATUS_FILTERS.ALL);
  const [sortKey, setSortKey] = useState(MY_LISTINGS_SORT_KEYS.NEWEST);

  const { listings, loading, invalidate, patchMyListingRow, removeMyListingRow, myListingsInitialFetchDone } =
    useUserDashboardStore(
    useShallow((s) => ({
      listings: s.myListingsRows,
      loading: s.listingsLoading,
      invalidate: s.invalidate,
      patchMyListingRow: s.patchMyListingRow,
      removeMyListingRow: s.removeMyListingRow,
      myListingsInitialFetchDone: s.myListingsInitialFetchDone,
    }))
  );
  const listingsErrorMessage = useUserDashboardStore((s) => s.listingsErrorMessage);

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

  const panelListings = useMemo(() => {
    const base = filterMyListingsPanelRows(listings);
    const searched = filterMyListingsPanelRowsBySearch(base, searchQuery);
    const filtered = filterMyListingsPanelRowsByStatus(searched, statusFilter);
    return sortMyListingsPanelRows(filtered, sortKey);
  }, [listings, searchQuery, statusFilter, sortKey]);

  const mayShowEmptyListings =
    myListingsInitialFetchDone && !loading && !listingsErrorMessage && panelListings.length === 0;
  const mayShowListingsError =
    myListingsInitialFetchDone && !loading && Boolean(listingsErrorMessage);
  const showListingsSkeleton =
    loading || (!myListingsInitialFetchDone && !listingsErrorMessage && listings.length === 0);

  const confirmArchiveListing = async () => {
    const listingId = archiveTargetId;
    if (!listingId) return;

    setActionId(String(listingId));
    patchMyListingRow(listingId, buildModerationArchivePatch());
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: OWNERSHIP_ACTIONS.ARCHIVE,
      extraUpdates: {
        status: getArchiveStatus(),
      },
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

  const confirmDiscardDraft = async () => {
    const listingId = deletePayload?.id ?? deletePayload;
    if (!listingId || !userId) return;
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

  const openDiscardDraft = (listing) => {
    modal.closeAllModals();
    modal.openModal(MODAL_TYPES.DELETE, { id: listing.id, title: listing.title });
  };

  const openArchiveListing = (listingId) => {
    modal.closeAllModals();
    modal.openModal(MODAL_TYPES.ARCHIVE, { listingId: String(listingId) });
  };

  const openMarkRecentlyClosed = (listing) => {
    const action = resolveListingCompletionAction(listing);
    if (!action) {
      warnMissingListingMarketType(listing, "user-my-listings");
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
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action: action.ownershipAction,
    });
    if (error) {
      setActionId("");
      invalidate();
      showToast({ type: "error", message: error?.message || "Unable to update listing status" });
      return;
    }
    invalidate();
    showToast({
      type: "success",
      message: action.successMessage,
    });
    setActionId("");
    modal.closeModal(MODAL_TYPES.MARK_RECENTLY_CLOSED);
  };

  const resubmitViaEditor = (listingId) => {
    router.push(resolveListingEditHref(listingId, { resubmit: true }));
  };

  const editListingHref = (listingId) => resolveListingEditHref(listingId);

  const emptyProps = useMemo(
    () => ({
      variant: "listings",
      primary: { label: "Create listing", href: "/dashboard/create" },
    }),
    []
  );

  return (
    <section aria-label="My listings">
      <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
        Published homes and drafts live here. Pending review and archived inventory have their own
        tabs — use filters below to focus your workspace.
      </p>

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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value={MY_LISTINGS_STATUS_FILTERS.ALL}>All statuses</option>
          <option value={MY_LISTINGS_STATUS_FILTERS.PUBLISHED}>Published</option>
          <option value={MY_LISTINGS_STATUS_FILTERS.DRAFT}>Draft</option>
          <option value={MY_LISTINGS_STATUS_FILTERS.REJECTED}>Rejected</option>
        </select>
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

      {showListingsSkeleton ? (
        <div className={styles.pendingGrid}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 140 }} />
          ))}
        </div>
      ) : null}

      {mayShowEmptyListings ? <PremiumEmptyState compact {...emptyProps} /> : null}

      {mayShowListingsError ? (
        <PremiumEmptyState
          compact
          variant="generic"
          title="We could not load your listings"
          description="Check your connection and try again. If this continues, refresh the page or contact support."
          primary={{
            label: "Try again",
            onClick: () => invalidate(),
          }}
        />
      ) : null}

      <div className={styles.pendingGrid}>
        {!showListingsSkeleton &&
          !mayShowListingsError &&
          panelListings.map((l) => {
            const lc = getLifecycleStatus(l);
            const isRejected = lc === LISTING_LIFECYCLE.REJECTED;
            const isDraft = lc === LISTING_LIFECYCLE.DRAFT;
            const isPublished = lc === LISTING_LIFECYCLE.PUBLISHED;
            const isLegacyDraft = isDraft && isLegacyGenerationDraft(l);
            const badgeClass = resolveLifecycleStatusBadgeSuffix(lc, { legacyDraft: isLegacyDraft });
            const thumb = coverUrl(l);
            const districtLabel =
              formatListingLocation(l) || getRegionLabel(normalizeRegionSlug(l.district || ""));
            const created = l.created_at ? new Date(l.created_at).toLocaleDateString() : "—";
            const completionAction = isPublished ? resolveListingCompletionAction(l) : null;

            return (
              <div
                key={l.id}
                className={`${styles.card} ${isRejected ? styles.rejectedTone : ""} ${
                  actionId === String(l.id) ? styles.cardActionBusy : ""
                }`}
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
                    <p className={styles.muted} style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
                      Created {created}
                    </p>
                    <div>
                      <span className={`${styles.statusBadge} ${styles[`status${badgeClass}`]}`}>
                        {isLegacyDraft ? "Legacy Draft" : getLifecycleLabel(lc)}
                      </span>
                    </div>
                    {!isDraft ? (
                      <div style={{ marginTop: 10 }}>
                        {isRejected ? (
                          <p className={styles.pendingSubtle}>Edit if needed, then resubmit for review.</p>
                        ) : null}
                        <UserListingRowIntel listing={l} />
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.userListingActions}>
                    {!isDraft ? (
                      <Link className={styles.approveButton} href={`/listing/${l.id}`}>
                        View
                      </Link>
                    ) : null}
                    {isDraft ? (
                      <>
                        <button
                          type="button"
                          className={styles.approveButton}
                          onClick={() =>
                            router.push(resolveListingEditHref(l.id))
                          }
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
                    {!isDraft && isPublished && completionAction ? (
                      <>
                        <Link className={styles.approveButton} href={editListingHref(l.id)}>
                          Edit
                        </Link>
                        <button
                          type="button"
                          className={resolveListingCompletionButtonClassName(
                            styles,
                            completionAction.buttonVariant
                          )}
                          onClick={() => openMarkRecentlyClosed(l)}
                          disabled={actionId === String(l.id)}
                        >
                          {completionAction.label}
                        </button>
                        <button
                          type="button"
                          className={styles.deleteListingButton}
                          onClick={() => openArchiveListing(l.id)}
                          disabled={actionId === String(l.id)}
                        >
                          {actionId === String(l.id) ? "Archiving…" : "Archive"}
                        </button>
                      </>
                    ) : null}
                    {isRejected ? (
                      <>
                        <Link className={styles.approveButton} href={editListingHref(l.id)}>
                          Edit
                        </Link>
                        <button
                          type="button"
                          className={styles.approveButton}
                          onClick={() => resubmitViaEditor(l.id)}
                        >
                          Resubmit
                        </button>
                        <button
                          type="button"
                          className={styles.deleteListingButton}
                          onClick={() => openArchiveListing(l.id)}
                          disabled={actionId === String(l.id)}
                        >
                          {actionId === String(l.id) ? "Archiving…" : "Archive"}
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
        listingTitle={closeTarget?.title || ""}
        onClose={() => {
          if (actionId === closeTarget?.listingId) return;
          modal.closeModal(MODAL_TYPES.MARK_RECENTLY_CLOSED);
        }}
        onConfirm={confirmMarkRecentlyClosed}
      />
      <DeleteConfirmationModal
        isOpen={modal.isModalOpen(MODAL_TYPES.DELETE)}
        title="Discard this draft?"
        warningText="This draft will be permanently removed. This action cannot be undone."
        confirmLabel="Discard Draft"
        item={deletePayload}
        loading={
          Boolean(deletePayload?.id) &&
          actionId === String(deletePayload.id)
        }
        onClose={() => {
          if (actionId === String(deletePayload?.id)) return;
          modal.closeModal(MODAL_TYPES.DELETE);
        }}
        onConfirm={confirmDiscardDraft}
      />
    </section>
  );
}

export default memo(UserMyListingsPanel);
