import { memo, useMemo, useState } from "react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { supabase } from "@/lib/supabaseClient";
import { filterArchivedListingsPanelRows } from "@/lib/userDashboardListingTruth";
import useUserDashboardStore from "@/stores/useUserDashboardStore";
import { useToast } from "@/components/ui/ToastProvider";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import { MODAL_TYPES, useModalController } from "@/hooks/useModalController";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import UserListingRowIntel from "@/components/user/UserListingRowIntel";
import {
  LISTING_LIFECYCLE,
  resolveActiveListingCapForTier,
} from "@/constants/operationalModel";
import { OWNERSHIP_ACTIONS } from "@/constants/ownershipModel";
import { getRegionLabel, normalizeRegionSlug } from "@/constants/geographyLayer";
import { applyListingLifecycleAction, permanentlyDeleteArchivedListing } from "@/utils/ownershipAttribution";
import { buildModerationResubmitPatch } from "@/lib/listingWriteContract";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import { resolveListingEditHref } from "@/lib/listingEditAccess";
import styles from "@/styles/Dashboard.module.css";

function coverUrl(listing) {
  const imgs = Array.isArray(listing?.listing_images) ? listing.listing_images : [];
  const sorted = [...imgs].filter(Boolean).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return sorted[0]?.image_url || "";
}

function UserArchivedListingsPanel({ userId, tier }) {
  const { showToast } = useToast();
  const [actionId, setActionId] = useState("");
  const modal = useModalController();
  const deletePayload = modal.isModalOpen(MODAL_TYPES.DELETE) ? modal.activeModal?.payload : null;

  const { listings, loading, invalidate, patchMyListingRow, removeMyListingRow, myListingsInitialFetchDone, activeListings } =
    useUserDashboardStore(
      useShallow((s) => ({
        listings: s.myListingsRows,
        loading: s.listingsLoading,
        invalidate: s.invalidate,
        patchMyListingRow: s.patchMyListingRow,
        removeMyListingRow: s.removeMyListingRow,
        myListingsInitialFetchDone: s.myListingsInitialFetchDone,
        activeListings: s.activeListings,
      }))
    );

  const archivedRows = useMemo(() => filterArchivedListingsPanelRows(listings), [listings]);

  const showSkeleton =
    loading || (!myListingsInitialFetchDone && archivedRows.length === 0);
  const mayShowEmpty = myListingsInitialFetchDone && !loading && archivedRows.length === 0;

  const restoreListing = async (listingId) => {
    setActionId(String(listingId));
    const tierCap = resolveActiveListingCapForTier(tier);
    if (tierCap != null && userId) {
      const activeCount = Number(activeListings) || 0;
      if (activeCount >= tierCap) {
        showToast({
          type: "error",
          message: `Limit reached (${tierCap} active listings). Archive another listing before restoring to review.`,
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
      showToast({ type: "error", message: error?.message || "Unable to restore listing to review" });
      return;
    }
    patchMyListingRow(listingId, buildModerationResubmitPatch());
    invalidate();
    showToast({ type: "success", message: "Listing moved to Pending Review" });
    setActionId("");
  };

  const confirmPermanentDelete = async () => {
    const listingId = deletePayload?.id ?? deletePayload;
    if (!listingId) return;
    setActionId(String(listingId));
    const { error } = await permanentlyDeleteArchivedListing(supabase, {
      listingId,
      statusHint: LISTING_LIFECYCLE.ARCHIVED,
    });
    if (error) {
      setActionId("");
      showToast({ type: "error", message: error?.message || "Unable to delete listing" });
      return;
    }
    removeMyListingRow(listingId);
    invalidate();
    showToast({ type: "info", message: "Listing removed" });
    modal.closeModal(MODAL_TYPES.DELETE);
    setActionId("");
  };

  return (
    <section aria-label="Archived listings">
      <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
        Archived homes are off the public map. Restore to Review when you are ready to submit again, or remove
        permanently when you no longer need the record.
      </p>

      {showSkeleton ? (
        <div className={styles.pendingGrid}>
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 140 }} />
          ))}
        </div>
      ) : null}

      {mayShowEmpty ? <PremiumEmptyState compact variant="archived" /> : null}

      <div className={styles.pendingGrid}>
        {!showSkeleton &&
          archivedRows.map((l) => {
            const thumb = coverUrl(l);
            const districtLabel = getRegionLabel(normalizeRegionSlug(l.district || ""));
            const archivedAt = l.archived_at || l.updated_at || l.created_at;
            const archivedLabel = archivedAt
              ? new Date(archivedAt).toLocaleDateString()
              : "—";
            const lc = getLifecycleStatus(l);

            return (
              <div
                key={l.id}
                className={`${styles.card} ${styles.archivedCard} ${
                  actionId === String(l.id) ? styles.cardActionBusy : ""
                }`}
              >
                <div className={styles.userListingCardTop}>
                  <div className={styles.userListingThumb}>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className={styles.userListingThumbImg} />
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
                      Archived {archivedLabel}
                    </p>
                    <span className={`${styles.statusBadge} ${styles.statusArchived}`}>
                      Archived (Not Public)
                    </span>
                    {lc === LISTING_LIFECYCLE.ARCHIVED ? (
                      <div style={{ marginTop: 10 }}>
                        <UserListingRowIntel listing={l} />
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.userListingActions}>
                    <Link className={styles.approveButton} href={`/listing/${l.id}`}>
                      View
                    </Link>
                    <Link
                      className={styles.approveButton}
                      href={resolveListingEditHref(l.id)}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      className={styles.approveButton}
                      onClick={() => restoreListing(l.id)}
                      disabled={actionId === String(l.id)}
                    >
                      {actionId === String(l.id) ? "Restoring to Review…" : "Restore to Review"}
                    </button>
                    <button
                      type="button"
                      className={styles.deleteListingButton}
                      onClick={() => {
                        modal.closeAllModals();
                        modal.openModal(MODAL_TYPES.DELETE, {
                          id: l.id,
                          title: l.title || "Untitled",
                        });
                      }}
                      disabled={actionId === String(l.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <DeleteConfirmationModal
        isOpen={modal.isModalOpen(MODAL_TYPES.DELETE)}
        title="Delete Listing?"
        warningText="This action cannot be undone. The archived listing will be permanently removed."
        confirmLabel="Delete"
        item={deletePayload}
        loading={
          Boolean(deletePayload?.id) &&
          actionId === String(deletePayload.id)
        }
        onClose={() => {
          if (actionId === String(deletePayload?.id)) return;
          modal.closeModal(MODAL_TYPES.DELETE);
        }}
        onConfirm={confirmPermanentDelete}
      />
    </section>
  );
}

export default memo(UserArchivedListingsPanel);
