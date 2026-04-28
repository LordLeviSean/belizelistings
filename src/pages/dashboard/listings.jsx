import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { createDebugger } from "@/lib/debug";
import SiteNav from "../../components/SiteNav";
import ListingCard from "../../components/ListingCard";
import AgentAccessGate from "../../components/AgentAccessGate";
import DeleteConfirmModal from "../../components/DeleteConfirmModal";
import useAuth from "../../hooks/useAuth";
import { withReapprovalRequired } from "../../lib/listingReapproval";
import { supabase } from "../../lib/supabaseClient";
import styles from "../../styles/Dashboard.module.css";

export default function DashboardListingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAgent, setIsAgent] = useState(false);
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const debugRef = useRef(createDebugger("DASHBOARD"));
  const [debugState, setDebugState] = useState({});
  const isDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "true";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const loadProfile = async () => {
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!cancelled) {
        const agent = data?.role === "agent";
        setIsAgent(agent);
        setProfileLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !isAgent) return;
    let cancelled = false;

    const loadListings = async () => {
      setListingsLoading(true);
      // AGENT: all own rows — no status filter
      const { data } = await supabase
        .from("listings")
        .select(`
          *,
          listing_images (
            image_url,
            position
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      debugRef.current.log("RAW_LISTINGS", data);

      if (!cancelled) {
        const listingsWithImages = (data || []).map((l) => ({
          ...l,
          images: l.listing_images || [],
        }));
        debugRef.current.log("NORMALIZED_LISTINGS", listingsWithImages);
        console.log("DASHBOARD LISTINGS:", listingsWithImages);
        setDebugState(debugRef.current.getState());
        setListings(listingsWithImages);
        setListingsLoading(false);
      }
    };

    loadListings();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isAgent]);

  function statusLabel(status) {
    switch (status) {
      case "draft":
        return "Draft";
      case "pending":
        return "Pending Approval";
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      default:
        return status || "—";
    }
  }

  const handleSubmitForReview = async (listingId) => {
    if (!listingId) return;
    setSubmittingId(listingId);
    const { error } = await supabase
      .from("listings")
      .update(withReapprovalRequired({ status: "pending" }))
      .eq("id", listingId);
    if (!error) {
      setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, status: "pending" } : l)));
    } else {
      console.error("Submit for review error:", error);
    }
    setSubmittingId(null);
  };

  const handleDelete = async (listingId) => {
    if (!listingId) return;
    setIsDeleting(true);
    debugRef.current.log("DELETE_START", listingId);

    // Intentionally not using withReapprovalRequired — soft-delete is not a content edit
    const { data, error } = await supabase.from("listings").update({ status: "deleted" }).eq("id", listingId).select();

    debugRef.current.log("DELETE_RESULT", { data, error });
    setDebugState(debugRef.current.getState());

    if (!error) {
      setDeleteModalOpen(false);
      setSelectedListing(null);
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    }
    setIsDeleting(false);
  };

  if (loading || profileLoading) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <p className={styles.muted}>Loading listings...</p>
        </main>
      </div>
    );
  }

  if (!user) return null;

  if (!isAgent) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <h1 className={styles.title}>My Listings</h1>
          <AgentAccessGate user={user} />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <h1 className={styles.title}>My Listings</h1>
        <div className={styles.linkRow}>
          <Link href="/dashboard/create" className={styles.dashboardLink}>
            Create Listing
          </Link>
        </div>
        {listingsLoading ? <p className={styles.muted}>Loading your listings...</p> : null}
        {!listingsLoading && listings.length === 0 ? (
          <p className={styles.muted}>No listings yet.</p>
        ) : (
          <div className={styles.listGrid}>
            {listings.map((listing) => (
              <div key={listing.id} className={styles.dashboardListingBlock}>
                <ListingCard listing={listing} />
                <div className={styles.listingActionRow}>
                  <div className={styles.listingMeta}>
                    <p>
                      <strong>{listing.title}</strong> — Status: {statusLabel(listing.status)}
                    </p>
                    {listing.status === "rejected" && listing.rejection_reason ? (
                      <p className={styles.rejectionNote}>Reason: {listing.rejection_reason}</p>
                    ) : null}
                  </div>
                  <div className={styles.listingButtonGroup}>
                    {listing.status === "draft" ? (
                      <button
                        type="button"
                        className={styles.submitReviewButton}
                        disabled={submittingId === listing.id}
                        onClick={() => handleSubmitForReview(listing.id)}
                      >
                        {submittingId === listing.id ? "Submitting…" : "Submit for Review"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.deleteListingButton}
                      disabled={isDeleting}
                      onClick={() => {
                        setSelectedListing(listing);
                        setDeleteModalOpen(true);
                      }}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {isDebug && (
          <div
            style={{
              marginTop: "40px",
              padding: "20px",
              background: "#0B0F14",
              border: "1px solid #2A2F36",
              borderRadius: "12px",
              fontSize: "12px",
              maxHeight: "300px",
              overflow: "auto",
            }}
          >
            <h3>SYSTEM DEBUG</h3>
            <pre>{JSON.stringify(debugState, null, 2)}</pre>
          </div>
        )}
      </main>
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedListing(null);
        }}
        onConfirm={() => handleDelete(selectedListing?.id)}
        loading={isDeleting}
      />
    </div>
  );
}
