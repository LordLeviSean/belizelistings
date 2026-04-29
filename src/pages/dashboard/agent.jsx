import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import SiteNav from "@/components/SiteNav";
import useUserRole from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "@/styles/Dashboard.module.css";

export default function AgentDashboard() {
  const router = useRouter();
  const { user, role, loading: roleLoading } = useUserRole();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [removedIds, setRemovedIds] = useState([]);

  const loadListings = async () => {
    if (!user) {
      router.replace("/login");
      return;
    }

    if (role !== "agent") {
      router.replace("/dashboard");
      return;
    }

    const { data } = await supabase
      .from("listings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setListings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (roleLoading) return;
    void loadListings();
  }, [roleLoading, user?.id, role]);

  const deleteListing = async (listingId) => {
    setActionId(String(listingId));
    await supabase.from("favorites").delete().eq("listing_id", String(listingId));
    const { error } = await supabase.from("listings").delete().eq("id", listingId);
    if (error) {
      setActionId("");
      return;
    }
    setRemovedIds((prev) => [...prev, String(listingId)]);
    setListings((prev) => prev.filter((listing) => String(listing.id) !== String(listingId)));
    await loadListings();
    showToast({ type: "info", message: "Listing deleted" });
    setActionId("");
  };

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <div className={styles.adminWrapper}>
        <h1 className={styles.title}>Agent Dashboard</h1>

        <div style={{ marginBottom: 16 }}>
          <button className={styles.primaryButton} onClick={() => router.push("/dashboard/create")}>
            + Create Listing
          </button>
        </div>

        <div className={styles.pendingGrid}>
          {loading ? (
            <div className={styles.pendingGrid}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 110 }} />
              ))}
            </div>
          ) : null}
          {!loading && listings.length === 0 ? (
            <p className={styles.muted}>No listings yet.</p>
          ) : null}
          {listings.map((l) => (
            <div key={l.id} className={`${styles.card} ${removedIds.includes(String(l.id)) ? styles.rowRemoving : ""}`}>
              <h3 style={{ margin: 0 }}>{l.title}</h3>
              <p className={styles.muted}>{Number(l.price || 0).toLocaleString()} BZD</p>
              <span className={`${styles.statusBadge} ${styles[`status${String(l.status || "").charAt(0).toUpperCase()}${String(l.status || "").slice(1)}`]}`}>
                {l.status || "draft"}
              </span>
              <button
                className={styles.deleteListingButton}
                type="button"
                onClick={() => deleteListing(l.id)}
                disabled={actionId === String(l.id)}
              >
                {actionId === String(l.id) ? "Deleting..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
      </div>
      </main>
    </div>
  );
}
