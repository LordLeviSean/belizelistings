import { memo, useMemo } from "react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import useUserDashboardStore from "@/stores/useUserDashboardStore";
import { filterPendingListingsPanelRows } from "@/lib/userDashboardListingTruth";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import ListingMediaImage from "@/components/listing/ListingMediaImage";
import { IMAGE_QUALITY_THUMB, IMAGE_SIZES_DASHBOARD_THUMB } from "@/constants/imageQuality";
import { getModerationStatus } from "@/utils/canonicalListing";
import { formatListingLocation } from "@/lib/geography/formatListingLocation";
import styles from "@/styles/Dashboard.module.css";

function coverUrl(listing) {
  const imgs = Array.isArray(listing?.listing_images) ? listing.listing_images : [];
  const sorted = [...imgs].filter(Boolean).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return sorted[0]?.image_url || "";
}

function resolvePendingBadge(row) {
  const mod = getModerationStatus(row);
  if (mod === "needs_edits" || mod === "needs_edit") {
    return { label: "Needs edits", className: styles.statusNeedsEdits };
  }
  if (mod === "approved") {
    return { label: "Approved", className: styles.statusApproved };
  }
  if (mod === "rejected") {
    return { label: "Rejected", className: styles.statusRejected };
  }
  return { label: "Pending review", className: styles.statusPending };
}

function UserPendingListingsPanel() {
  const { listings, loading, myListingsInitialFetchDone } = useUserDashboardStore(
    useShallow((s) => ({
      listings: s.myListingsRows,
      loading: s.listingsLoading,
      myListingsInitialFetchDone: s.myListingsInitialFetchDone,
    }))
  );

  const pendingRows = useMemo(() => filterPendingListingsPanelRows(listings), [listings]);

  const showSkeleton =
    loading || (!myListingsInitialFetchDone && pendingRows.length === 0);
  const mayShowEmpty =
    myListingsInitialFetchDone && !loading && pendingRows.length === 0;

  return (
    <section aria-label="Pending review">
      <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
        Listings here are with the BelizeListings editorial team. They are not public yet — preview
        the listing while moderation runs; we will notify you when the status changes.
      </p>

      {showSkeleton ? (
        <div className={styles.pendingGrid}>
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 140 }} />
          ))}
        </div>
      ) : null}

      {mayShowEmpty ? (
        <PremiumEmptyState
          compact
          variant="moderation"
          title="Nothing awaiting review"
          description="When you submit a listing for approval, it appears here until it is published or needs your attention."
          primary={{ label: "My listings", href: "/dashboard/user?tab=my-listings" }}
        />
      ) : null}

      <div className={styles.pendingGrid}>
        {!showSkeleton &&
          pendingRows.map((l) => {
            const thumb = coverUrl(l);
            const districtLabel = formatListingLocation(l) || "Belize";
            const submitted = l.updated_at || l.created_at;
            const submittedLabel = submitted
              ? new Date(submitted).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—";
            const badge = resolvePendingBadge(l);
            const mod = getModerationStatus(l);

            return (
              <div key={l.id} className={styles.card}>
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
                      Submitted {submittedLabel}
                    </p>
                    <span className={`${styles.statusBadge} ${badge.className}`}>{badge.label}</span>
                    {mod !== "unknown" ? (
                      <p className={styles.muted} style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
                        Moderation: {mod.replace(/_/g, " ")}
                      </p>
                    ) : null}
                  </div>
                  <div className={styles.userListingActions}>
                    <Link className={styles.approveButton} href={`/listing/${l.id}`}>
                      View
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}

export default memo(UserPendingListingsPanel);
