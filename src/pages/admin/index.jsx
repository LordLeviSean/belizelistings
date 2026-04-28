import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import RejectListingModal from "../../components/RejectListingModal";
import SiteNav from "../../components/SiteNav";
import ListingCard from "../../components/ListingCard";
import useAuth from "../../hooks/useAuth";
import { supabase } from "../../lib/supabaseClient";
import styles from "../../styles/Dashboard.module.css";

export default function AdminPendingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [pendingRejectId, setPendingRejectId] = useState(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!cancelled) {
        setIsAdmin(data?.role === "admin");
        setProfileLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !isAdmin) return;
    let cancelled = false;

    const loadListings = async () => {
      setListingsLoading(true);
      // ADMIN: pending queue (full table = omit .eq("status", "pending"))
      const { data, error } = await supabase
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
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[admin] pending listings", error);
      }
      if (!cancelled) {
        const normalized = (data || []).map((l) => ({
          ...l,
          images: l.listing_images || [],
        }));
        setListings(normalized);
        setListingsLoading(false);
      }
    };

    loadListings();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isAdmin]);

  const handleApprove = async (listingId) => {
    if (!user?.id) return;
    setActionId(listingId);
    const reviewed_at = new Date().toISOString();
    const { error } = await supabase
      .from("listings")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at,
      })
      .eq("id", listingId);
    if (error) {
      console.error("[admin] approve", error);
    } else {
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    }
    setActionId(null);
  };

  const handleRejectConfirm = async (reason) => {
    if (!user?.id || !pendingRejectId) return;
    setRejectSubmitting(true);
    const reviewed_at = new Date().toISOString();
    const { error } = await supabase
      .from("listings")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_by: user.id,
        reviewed_at,
      })
      .eq("id", pendingRejectId);
    setRejectSubmitting(false);
    if (error) {
      console.error("[admin] reject", error);
      return;
    }
    setListings((prev) => prev.filter((l) => l.id !== pendingRejectId));
    setPendingRejectId(null);
  };

  if (loading || profileLoading) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <p className={styles.muted}>Loading…</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <div>Access denied</div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <h1 className={styles.title}>Pending Listings</h1>
        {listingsLoading ? <p className={styles.muted}>Loading…</p> : null}
        {!listingsLoading && listings.length === 0 ? <p className={styles.muted}>No pending listings.</p> : null}
        {!listingsLoading && listings.length > 0 ? (
          <div className={styles.listGrid}>
            {listings.map((listing) => (
              <div key={listing.id} className={styles.dashboardListingBlock}>
                <ListingCard listing={listing} />
                <div className={styles.adminActionRow}>
                  <button
                    type="button"
                    className={styles.approveButton}
                    disabled={actionId === listing.id || pendingRejectId === listing.id}
                    onClick={() => handleApprove(listing.id)}
                  >
                    {actionId === listing.id ? "…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className={styles.rejectButton}
                    disabled={actionId === listing.id || pendingRejectId === listing.id}
                    onClick={() => setPendingRejectId(listing.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </main>

      <RejectListingModal
        isOpen={pendingRejectId != null}
        onClose={() => {
          if (!rejectSubmitting) {
            setPendingRejectId(null);
          }
        }}
        onConfirm={handleRejectConfirm}
        loading={rejectSubmitting}
      />
    </div>
  );
}
