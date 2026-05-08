import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import useAuth from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import { traceAction } from "../lib/trace";
import { useToast } from "./ui/ToastProvider";
import { getRegionLabel } from "../constants/geographyLayer";
import { getModerationStatus, getRepublishStatus } from "../constants/operationalModel";
import { formatOperationalTimestamp } from "../utils/listingOperationalMeta";
import ListingTrustStrip from "./ListingTrustStrip";
import AgentOperationalStrip from "./AgentOperationalStrip";
import { buildAgentOperationalSnapshotMap } from "../utils/trustSignals";
import ListingOwnershipMeta from "./ListingOwnershipMeta";
import { clearAllFavoritesForListing } from "../lib/favorites";
import { isMissingColumnError } from "../lib/supabaseCompat";
import {
  applyListingLifecycleAction,
  collectListingOwnershipActorIds,
} from "../utils/ownershipAttribution";
import { OWNERSHIP_ACTIONS } from "../constants/ownershipModel";
import styles from "../styles/Dashboard.module.css";

function formatDistrict(district = "") {
  return getRegionLabel(district);
}

export default function PendingListingsPanel({ onAction }) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const [ownerMap, setOwnerMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [removedIds, setRemovedIds] = useState([]);

  const loadPending = async () => {
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
      .or(`status.eq.${getRepublishStatus()},lifecycle_status.eq.pending,moderation_status.eq.pending_review`)
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
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .in("id", ownerIds);
      const nextOwnerMap = {};
      for (const profile of profileRows || []) {
        nextOwnerMap[String(profile.id)] = profile.full_name || profile.email || String(profile.id).slice(0, 8);
      }
      setOwnerMap(nextOwnerMap);
    } else {
      setOwnerMap({});
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadPending();
  }, []);
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
  }, []);

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
      extraUpdates: {
        status: nextStatus,
      },
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
    setRemovedIds((prev) => [...prev, String(listingId)]);
    window.setTimeout(() => {
      setListings((prev) => prev.filter((row) => String(row.id) !== String(listingId)));
      setRemovedIds((prev) => prev.filter((id) => id !== String(listingId)));
    }, 220);
    onAction?.(`${nextStatus === "approved" ? "Approved" : "Rejected"} pending listing`);
    showToast({
      type: "success",
      message: nextStatus === "approved" ? "Listing approved" : "Listing rejected",
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
      <div className={styles.card}>
        <p className={styles.muted}>No pending listings</p>
        <button type="button" className={styles.primaryButton} onClick={() => router.push("/dashboard/create")}>
          Create Listing
        </button>
      </div>
    );
  }

  return (
    <div className={styles.pendingGrid}>
      {listings.map((listing) => {
        const firstImage = listing?.listing_images?.[0]?.image_url || "/placeholder.jpg";
        const listingKey = String(listing.id);
        return (
          <div
            key={listingKey}
            className={`${styles.pendingCard} ${removedIds.includes(listingKey) ? styles.pendingCardRemoving : ""}`}
          >
            <img src={firstImage} alt={listing.title || "Listing"} className={styles.pendingImage} />
            <div className={styles.pendingBody}>
              <div className={styles.pendingMeta}>
                <p className={styles.pendingTitle}><strong>{listing.title || "Untitled listing"}</strong></p>
                <p className={styles.pendingPrice}>{Number(listing.price || 0).toLocaleString()} BZD · {formatDistrict(listing.district)}</p>
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
