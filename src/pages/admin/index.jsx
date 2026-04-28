import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import RejectListingModal from "../../components/RejectListingModal";
import SiteNav from "../../components/SiteNav";
import ListingCard from "../../components/ListingCard";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../components/ui/ToastProvider";
import { supabase } from "../../lib/supabaseClient";
import styles from "../../styles/Dashboard.module.css";

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "8px",
  background: "var(--bg-main)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
};

const primaryBtn = {
  padding: "10px 16px",
  background: "var(--accent)",
  borderRadius: "8px",
  border: "none",
  color: "#fff",
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "10px 16px",
  background: "var(--bg-elevated)",
  borderRadius: "8px",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  cursor: "pointer",
};

export default function AdminPendingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [pendingRejectId, setPendingRejectId] = useState(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingStatusTab, setPendingStatusTab] = useState("pending");
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [allListings, setAllListings] = useState([]);
  const [allListingsLoading, setAllListingsLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pendingListings, setPendingListings] = useState([]);
  const [editingListing, setEditingListing] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    price: "",
    district: "",
  });
  const [creating, setCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState("pending");
  const [form, setForm] = useState({
    title: "",
    price: "",
    district: "",
    property_type: "house",
    beds: "",
    baths: "",
    garages: "",
    images: [],
  });

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
        setProfile(data || null);
        setIsAdmin(data?.role === "admin");
        setProfileLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const loadCounts = useCallback(async () => {
    const statuses = ["pending", "approved", "rejected"];
    const next = { pending: 0, approved: 0, rejected: 0 };
    await Promise.all(
      statuses.map(async (status) => {
        const { count } = await supabase
          .from("listings")
          .select("status", { count: "exact", head: true })
          .eq("status", status);
        next[status] = count || 0;
      })
    );
    setCounts(next);
  }, []);

  useEffect(() => {
    if (!user?.id || !isAdmin) return;
    if (activeTab !== "pending") return;
    let cancelled = false;

    const loadListings = async () => {
      setListingsLoading(true);
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
        .eq("status", pendingStatusTab)
        .order("created_at", { ascending: false });
      if (error) {
        console.error(`[admin] ${pendingStatusTab} listings`, error);
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
    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isAdmin, activeTab, pendingStatusTab, loadCounts]);

  useEffect(() => {
    if (!user?.id || !isAdmin) return;
    if (activeTab !== "listings") return;
    let cancelled = false;
    const fetchListings = async () => {
      setAllListingsLoading(true);
      const { data } = await supabase.from("listings").select("*").order("created_at", { ascending: false });
      if (!cancelled) {
        setAllListings(data || []);
        setAllListingsLoading(false);
      }
    };
    fetchListings();
    return () => {
      cancelled = true;
    };
  }, [activeTab, user?.id, isAdmin]);

  useEffect(() => {
    if (!user?.id || !isAdmin) return;
    let cancelled = false;
    const fetchPendingListings = async () => {
      const { data } = await supabase.from("listings").select("id").eq("status", "pending");
      if (!cancelled) {
        setPendingListings(data || []);
      }
    };
    fetchPendingListings();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isAdmin, activeTab, listings.length]);

  useEffect(() => {
    if (!user?.id || !isAdmin) return;
    if (activeTab !== "users") return;
    let cancelled = false;
    const fetchUsers = async () => {
      setUsersLoading(true);
      const { data } = await supabase.from("profiles").select("*");
      if (!cancelled) {
        setUsers(data || []);
        setUsersLoading(false);
      }
    };
    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [activeTab, user?.id, isAdmin]);

  const emptySubtext = useMemo(() => {
    if (pendingStatusTab === "approved") return "No approved listings";
    if (pendingStatusTab === "rejected") return "No rejected listings";
    return "No listings waiting for review";
  }, [pendingStatusTab]);

  const approvedCount = (allListings || []).filter((l) => l.status === "approved").length;
  const rejectedCount = (allListings || []).filter((l) => l.status === "rejected").length;
  const filteredListings = (allListings || []).filter((l) => {
    if (activeFilter === "all") return true;
    return l.status === activeFilter;
  });

  const approveListing = async (listingId) => {
    await supabase.from("listings").update({ status: "approved" }).eq("id", listingId);
    const { data } = await supabase.from("listings").select("*").order("created_at", { ascending: false });
    setAllListings(data || []);
    showToast({ type: "success", message: "Listing approved" });
  };

  const deleteListing = async (listingId) => {
    await supabase.from("listings").update({ status: "deleted" }).eq("id", listingId);
    const { data } = await supabase.from("listings").select("*").order("created_at", { ascending: false });
    setAllListings(data || []);
    showToast({ type: "info", message: "Listing removed" });
  };

  const rejectListing = async (listingId) => {
    await supabase.from("listings").update({ status: "rejected" }).eq("id", listingId);
    const { data } = await supabase.from("listings").select("*").order("created_at", { ascending: false });
    setAllListings(data || []);
    showToast({ type: "info", message: "Listing rejected" });
  };

  const toggleRole = async (u) => {
    await supabase
      .from("profiles")
      .update({
        role: u.role === "admin" ? "agent" : "admin",
      })
      .eq("id", u.id);
    const { data } = await supabase.from("profiles").select("*");
    setUsers(data || []);
    showToast({ type: "success", message: "User role updated" });
  };

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
      showToast({ type: "error", message: "Unable to approve listing" });
    } else {
      setListings((prev) => prev.filter((l) => l.id !== listingId));
      showToast({ type: "success", message: "Listing approved" });
      loadCounts();
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
      showToast({ type: "error", message: "Unable to reject listing" });
      return;
    }
    setListings((prev) => prev.filter((l) => l.id !== pendingRejectId));
    setPendingRejectId(null);
    showToast({ type: "info", message: "Listing rejected" });
    loadCounts();
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

  if (!profile || profile.role !== "admin") {
    return <div>Access denied</div>;
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
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "40px 20px",
          }}
        >
          <h1 style={{ fontSize: "34px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
            Admin Panel
          </h1>

          <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
            Manage listings, users, and platform activity
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            <button
              type="button"
              onClick={() => setCreating(true)}
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                padding: "10px 16px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              + Create Listing
            </button>

            <input
              placeholder="Search listings..."
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                padding: "10px 14px",
                borderRadius: "8px",
                color: "white",
                minWidth: "220px",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            {[
              { label: "Pending", value: pendingListings?.length || 0 },
              {
                label: "Approved",
                value: approvedCount || 0,
              },
              {
                label: "Rejected",
                value: rejectedCount || 0,
              },
              { label: "Users", value: users?.length || 0 },
            ].map((card, i) => (
              <div
                key={i}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  padding: "16px",
                  borderRadius: "var(--radius)",
                  transition: "all 0.2s ease",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  {card.label}
                </div>
                <div style={{ fontSize: "26px", fontWeight: 600 }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: "20px",
            }}
          >
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: "var(--radius)",
                padding: "16px",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <h3 style={{ marginBottom: "12px" }}>Listings</h3>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginBottom: "18px",
                }}
              >
                {["pending", "approved", "rejected", "all"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "999px",
                      border: "1px solid var(--border-subtle)",
                      background: activeFilter === f ? "var(--bg-elevated)" : "transparent",
                      color: activeFilter === f ? "#fff" : "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                {[
                  { key: "pending", label: "Pending" },
                  { key: "listings", label: "All Listings" },
                  { key: "users", label: "Users" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "999px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: activeTab === tab.key ? "#1c252e" : "transparent",
                      color: "#e6edf3",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "pending" && (
                <>
                  <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
                    <span className={styles.muted}>Pending: {counts.pending}</span>
                    <span className={styles.muted}>Approved: {counts.approved}</span>
                    <span className={styles.muted}>Rejected: {counts.rejected}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                    {["pending", "approved", "rejected"].map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={status === pendingStatusTab ? styles.approveButton : styles.rejectButton}
                        onClick={() => setPendingStatusTab(status)}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                  {listingsLoading ? <p className={styles.muted}>Loading listings...</p> : null}
                  {!listingsLoading && listings.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 8px" }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>Nothing here</p>
                      <p className={styles.muted} style={{ marginTop: 8 }}>
                        {emptySubtext}
                      </p>
                    </div>
                  ) : null}
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
                </>
              )}

              {activeTab === "listings" && (
                <div>
                  {allListingsLoading ? <p className={styles.muted}>Loading listings...</p> : null}
                  {!allListingsLoading && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                    {filteredListings.map((l) => (
                      <div
                        key={l.id}
                        style={{
                          display: "flex",
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius)",
                          padding: "12px",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = "0 10px 25px rgba(0,0,0,0.25)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "none";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <img
                          src={l.images?.[0]?.url || "/placeholder.jpg"}
                          alt=""
                          style={{
                            width: "90px",
                            height: "70px",
                            objectFit: "cover",
                            borderRadius: "10px",
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 600 }}>{l.title}</div>
                          <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                            {Number(l.price || 0).toLocaleString()} BZD
                          </div>
                        </div>
                        <div
                          style={{
                            padding: "6px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            background:
                              l.status === "approved"
                                ? "rgba(31,122,79,0.2)"
                                : l.status === "pending"
                                  ? "rgba(247,144,9,0.2)"
                                  : "rgba(180,35,24,0.2)",
                          }}
                        >
                          {l.status}
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => approveListing(l.id)}
                            style={{
                              background: "var(--accent)",
                              color: "#fff",
                              border: "none",
                              padding: "6px 10px",
                              borderRadius: "8px",
                              cursor: "pointer",
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectListing(l.id)}
                            style={{
                              background: "var(--danger)",
                              color: "#fff",
                              border: "none",
                              padding: "6px 10px",
                              borderRadius: "8px",
                              cursor: "pointer",
                            }}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingListing(l);
                              setEditForm({
                                title: l.title || "",
                                price: l.price || "",
                                district: l.district || "",
                              });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteListing(l.id)}
                            style={{
                              background: "transparent",
                              border: "1px solid var(--border-strong)",
                              color: "var(--text-secondary)",
                              padding: "6px 10px",
                              borderRadius: "8px",
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "users" && (
                <div>
                  {usersLoading ? <p className={styles.muted}>Loading users...</p> : null}
                  {!usersLoading &&
                    users.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          padding: "10px",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "8px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "10px",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500 }}>{u.full_name || "User"}</div>
                          <div style={{ fontSize: "12px", color: "#9aa4af" }}>{u.role}</div>
                        </div>

                        <button type="button" onClick={() => toggleRole(u)}>
                          {u.role === "admin" ? "Make Agent" : "Make Admin"}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  background: "#0f141a",
                  borderRadius: "16px",
                  padding: "16px",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <h4>Activity</h4>
                <p style={{ opacity: 0.6 }}>No recent activity</p>
              </div>

              <div
                style={{
                  background: "#0f141a",
                  borderRadius: "16px",
                  padding: "16px",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <h4>System</h4>
                <p style={{ opacity: 0.6 }}>All systems operational</p>
              </div>
            </div>
          </div>
        </div>
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

      {editingListing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setEditingListing(null)}
        >
          <div
            style={{
              background: "#111822",
              padding: "20px",
              borderRadius: "12px",
              width: "320px",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "12px" }}>Edit Listing</h3>

            <input
              value={editForm.title}
              onChange={(e) =>
                setEditForm({ ...editForm, title: e.target.value })
              }
              placeholder="Title"
              style={{ width: "100%", marginBottom: "8px" }}
            />

            <input
              value={editForm.price}
              onChange={(e) =>
                setEditForm({ ...editForm, price: e.target.value })
              }
              placeholder="Price"
              style={{ width: "100%", marginBottom: "8px" }}
            />

            <input
              value={editForm.district}
              onChange={(e) =>
                setEditForm({ ...editForm, district: e.target.value })
              }
              placeholder="District"
              style={{ width: "100%", marginBottom: "12px" }}
            />

            <button
              type="button"
              onClick={async () => {
                await supabase
                  .from("listings")
                  .update(editForm)
                  .eq("id", editingListing.id);

                setEditingListing(null);
                location.reload();
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {creating && (
        <div
          onClick={() => setCreating(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "520px",
              background: "#0f141a",
              borderRadius: "16px",
              padding: "24px",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            <h2 style={{ marginBottom: "20px" }}>Create Listing</h2>

            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              style={inputStyle}
            />

            <input
              placeholder="Price"
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: e.target.value })
              }
              style={inputStyle}
            />

            <input
              placeholder="District"
              value={form.district}
              onChange={(e) =>
                setForm({ ...form, district: e.target.value })
              }
              style={inputStyle}
            />

            <select
              value={form.property_type}
              onChange={(e) =>
                setForm({ ...form, property_type: e.target.value })
              }
              style={inputStyle}
            >
              <option value="house">House</option>
              <option value="land">Land</option>
            </select>

            {form.property_type === "house" && (
              <>
                <input
                  placeholder="Beds"
                  value={form.beds}
                  onChange={(e) =>
                    setForm({ ...form, beds: e.target.value })
                  }
                  style={inputStyle}
                />

                <input
                  placeholder="Baths"
                  value={form.baths}
                  onChange={(e) =>
                    setForm({ ...form, baths: e.target.value })
                  }
                  style={inputStyle}
                />

                <input
                  placeholder="Garages"
                  value={form.garages}
                  onChange={(e) =>
                    setForm({ ...form, garages: e.target.value })
                  }
                  style={inputStyle}
                />
              </>
            )}

            <input
              type="file"
              multiple
              onChange={(e) =>
                setForm({ ...form, images: e.target.files || [] })
              }
              style={{ marginTop: "10px", color: "#fff" }}
            />

            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button type="button" onClick={() => setCreating(false)} style={secondaryBtn}>
                Cancel
              </button>

              <button
                type="button"
                onClick={async () => {
                  const { data, error } = await supabase
                    .from("listings")
                    .insert({
                      title: form.title,
                      price: Number(form.price),
                      district: form.district,
                      property_type: form.property_type,
                      beds:
                        form.property_type === "house"
                          ? Number(form.beds)
                          : null,
                      baths:
                        form.property_type === "house"
                          ? Number(form.baths)
                          : null,
                      garage:
                        form.property_type === "house"
                          ? Number(form.garages)
                          : null,
                      status: "approved",
                    })
                    .select()
                    .single();

                  if (error) {
                    console.error(error);
                    return;
                  }

                  if (form.images.length > 0) {
                    for (let i = 0; i < form.images.length; i++) {
                      const file = form.images[i];
                      const filePath = `${data.id}/${Date.now()}-${file.name}`;

                      await supabase.storage
                        .from("listing-images")
                        .upload(filePath, file);

                      const { data: urlData } = supabase.storage
                        .from("listing-images")
                        .getPublicUrl(filePath);

                      await supabase.from("listing_images").insert({
                        listing_id: data.id,
                        image_url: urlData.publicUrl,
                        position: i,
                      });
                    }
                  }

                  setCreating(false);
                  location.reload();
                }}
                style={primaryBtn}
              >
                Create Listing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
