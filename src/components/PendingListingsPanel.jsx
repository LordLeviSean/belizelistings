import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import useAuth from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import { fetchProfileRowsByIds } from "../lib/profileSelectContract";
import { traceAction } from "../lib/trace";
import { useToast } from "./ui/ToastProvider";
import { formatListingLocation } from "@/lib/geography/formatListingLocation";
import { getModerationStatus, getRepublishStatus, LISTING_LIFECYCLE } from "../constants/operationalModel";
import { clearAllFavoritesForListing } from "../lib/favorites";
import { getLifecycleStatus } from "../utils/canonicalListing";
import { formatOperationalTimestamp } from "../utils/listingOperationalMeta";
import ListingTrustStrip from "./ListingTrustStrip";
import AgentOperationalStrip from "./AgentOperationalStrip";
import { buildAgentOperationalSnapshotMap } from "../utils/trustSignals";
import { getListingCoverImageUrl } from "../utils/listingImage";
import ListingOwnershipMeta from "./ListingOwnershipMeta";
import { isMissingColumnError } from "../lib/supabaseCompat";
import {
  applyListingLifecycleAction,
  collectListingOwnershipActorIds,
} from "../utils/ownershipAttribution";
import { OWNERSHIP_ACTIONS } from "../constants/ownershipModel";
import styles from "../styles/Dashboard.module.css";
import PremiumEmptyState from "./ui/PremiumEmptyState";
import ListingMediaImage from "./listing/ListingMediaImage";
import { IMAGE_QUALITY_THUMB, IMAGE_SIZES_DASHBOARD_THUMB } from "../constants/imageQuality";
import { formatProfileDisplayLabel } from "../lib/profileDisplayName";
import { invalidateApprovedListingsCache } from "../lib/approvedListingsCache";
import useUserDashboardStore from "../stores/useUserDashboardStore";

export default function PendingListingsPanel({ onAction, profilesRevision = 0 }) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const [ownerMap, setOwnerMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [removedIds, setRemovedIds] = useState([]);

  const loadPending = useCallback(async () => {
    setLoading(true);
    let { data, error } = await supabase
      .from("listings")
      .select(
        `
          *,
          listing_images (
            image_url,
            position
          )
        `
      )
      .or(
        `status.eq.${getRepublishStatus()},lifecycle_status.eq.pending,lifecycle_status.eq.submitted,moderation_status.eq.pending_review`
      )
      .order("created_at", { ascending: false });
    if (error && isMissingColumnError(error)) {
      ({ data, error } = await supabase
        .from("listings")
        .select(
          `
          *,
          listing_images (
            image_url,
            position
          )
        `
        )
        .eq("status", getRepublishStatus())
        .order("created_at", { ascending: false }));
    }

    if (error) {
      console.error("[pending-panel] load error", error);
      showToast({ type: "error", message: "Could not load the moderation queue. Try again shortly." });
      setLoading(false);
      return;
    }

    const rows = (data || []).filter(
      (listing) => getLifecycleStatus(listing) === LISTING_LIFECYCLE.PENDING_REVIEW
    );
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
    void loadPending();
  }, [loadPending, profilesRevision]);
  const agentSnapshotMap = useMemo(
    () => buildAgentOperationalSnapshotMap(listings),
    [listings]
  );

  useEffect(() => {
    const channel = supabase
      .channel("admin-listings-pending")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings" },
        () => {
          void loadPending();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPending]);

  const moderateListing = async (listingId, nextStatus) => {
    if (!user?.id) return;
    setActionKey(`${listingId}:${nextStatus}`);
    traceAction({
      type: `admin_${nextStatus}_pending`,
      payload: { listingId, reviewerId: user.id },
    });
    const action =
      nextStatus === "approved" ? OWNERSHIP_ACTIONS.APPROVE : OWNERSHIP_ACTIONS.REJECT;
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action,
    });
    traceAction({
      type: `admin_${nextStatus}_pending_result`,
      payload: { listingId, reviewerId: user.id },
      result: { ok: !error, error: error?.message ?? null },
    });
    if (error) {
      console.error("[pending-panel] moderation error", error);
      setActionKey("");
      return;
    }
    if (nextStatus === "approved") {
      await clearAllFavoritesForListing(listingId);
    }
    const approved = getModerationStatus("approved");
    setListings((prev) =>
      prev.map((row) =>
        String(row.id) === String(listingId)
          ? {
              ...row,
              status: nextStatus,
              lifecycle_status: nextStatus === approved ? approved : nextStatus,
              moderation_status: nextStatus === approved ? "approved" : "rejected",
            }
          : row
      )
    );
    setRemovedIds((prev) => [...prev, String(listingId)]);
    window.setTimeout(() => {
      setListings((prev) => prev.filter((row) => String(row.id) !== String(listingId)));
      setRemovedIds((prev) => prev.filter((id) => id !== String(listingId)));
    }, 220);
    invalidateApprovedListingsCache();
    useUserDashboardStore.getState().invalidate();
    await onAction?.(`${nextStatus === "approved" ? "Approved" : "Rejected"} pending listing`);
    void loadPending();
    showToast({
      type: "success",
      message: nextStatus === "approved" ? "Listing approved" : "Listing moved to Rejected",
    });
    setActionKey("");
  };

  if (loading) {
    return (
      <div className={styles.pendingGrid}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={`${styles.pendingCard} skeleton`} style={{ minHeight: 118 }} />
        ))}
      </div>
    );
  }
  if (!listings.length) {
    return (
      <PremiumEmptyState
        variant="moderation"
        title="Nothing waiting in the moderation queue"
        description="When agents submit new inventory, submissions surface here for calm editorial review."
        primary={{
          label: "Create listing",
          onClick: () => router.push("/dashboard/create"),
          className: styles.primaryButton,
        }}
      />
    );
  }

  return (
    <div className={styles.pendingGrid}>
      {listings.map((listing) => {
        const firstImage = getListingCoverImageUrl(listing) || "/placeholder.jpg";
        const listingKey = String(listing.id);
        return (
          <div
            key={listingKey}
            className={`${styles.pendingCard} ${removedIds.includes(listingKey) ? styles.pendingCardRemoving : ""}`}
          >
            <div className={styles.pendingImage}>
              <ListingMediaImage
                src={firstImage}
                alt={listing.title || "Listing"}
                fill
                sizes={IMAGE_SIZES_DASHBOARD_THUMB}
                quality={IMAGE_QUALITY_THUMB}
                hoverZoom={false}
              />
            </div>
            <div className={styles.pendingBody}>
              <div className={styles.pendingMeta}>
                <p className={styles.pendingTitle}><strong>{listing.title || "Untitled listing"}</strong></p>
                <p className={styles.pendingPrice}>{Number(listing.price || 0).toLocaleString()} BZD · {formatListingLocation(listing) || "Belize"}</p>
                <p className={styles.pendingSubtle}>Owner: {ownerMap[String(listing.user_id)] || String(listing.user_id || "Unknown")}</p>
                <p className={styles.pendingSubtle}>{formatOperationalTimestamp(listing.created_at)}</p>
                <ListingOwnershipMeta listing={listing} ownerMap={ownerMap} />
                <AgentOperationalStrip snapshot={agentSnapshotMap[String(listing.user_id || "")]} />
                <ListingTrustStrip listing={listing} variant="pending" />
              </div>
                <button
                type="button"
                className={styles.approveButton}
                disabled={actionKey === `${listing.id}:approved` || actionKey === `${listing.id}:rejected`}
                  onClick={() => moderateListing(listing.id, getModerationStatus("approved"))}
              >
                {actionKey === `${listing.id}:approved` ? "Approving..." : "Approve"}
              </button>
              <button
                type="button"
                className={`${styles.rejectButton} ${styles.rejectButtonSoft}`}
                disabled={actionKey === `${listing.id}:approved` || actionKey === `${listing.id}:rejected`}
                  onClick={() => moderateListing(listing.id, getModerationStatus("rejected"))}
              >
                {actionKey === `${listing.id}:rejected` ? "Rejecting..." : "Reject"}
              </button>
              <button
                type="button"
                className={styles.dashboardLink}
                onClick={() => router.push(`/listing/${listing.id}?admin=true`)}
              >
                View
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
