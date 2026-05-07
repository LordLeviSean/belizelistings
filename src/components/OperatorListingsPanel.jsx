import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "./ui/ToastProvider";
import styles from "../styles/Dashboard.module.css";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "pending" },
  { label: "Archived", value: "archived" },
];

export default function OperatorListingsPanel({ onAction }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const [ownerMap, setOwnerMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    price: "",
    district: "",
    listing_type: "sale",
    property_type: "house",
    beds: "",
    baths: "",
    garage: "",
    status: "pending",
    currency: "BZD",
  });

  const loadListings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("*, listing_images(image_url,position)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[operator-listings-panel] load error", error);
      setLoading(false);
      return;
    }
    const rows = data || [];
    setListings(rows);
    const ownerIds = [...new Set(rows.map((listing) => String(listing.user_id || "")).filter(Boolean))];
    if (ownerIds.length > 0) {
      const { data: profileRows } = await supabase.from("profiles").select("id,email,full_name").in("id", ownerIds);
      const nextOwnerMap = {};
      for (const profile of profileRows || []) {
        nextOwnerMap[String(profile.id)] = profile.full_name || profile.email || String(profile.id).slice(0, 8);
      }
      setOwnerMap(nextOwnerMap);
    } else {
      setOwnerMap({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-listings-operator")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings" },
        () => {
          loadListings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadListings]);

  const filteredListings = useMemo(() => {
    if (statusFilter === "all") return listings;
    return listings.filter((listing) => listing.status === statusFilter);
  }, [listings, statusFilter]);

  const archiveListing = async (listingId) => {
    setActionKey(`${listingId}:archive`);
    const { error } = await supabase.from("listings").update({ status: "archived" }).eq("id", listingId);
    if (error) {
      setActionKey("");
      showToast({ type: "error", message: "Unable to archive listing" });
      return;
    }
    await loadListings();
    onAction?.("Archived listing from operator panel");
    showToast({ type: "info", message: "Listing archived" });
    setActionKey("");
  };

  const republishListing = async (listingId) => {
    setActionKey(`${listingId}:republish`);
    const { error } = await supabase.from("listings").update({ status: "pending" }).eq("id", listingId);
    if (error) {
      setActionKey("");
      showToast({ type: "error", message: "Unable to re-publish listing" });
      return;
    }
    await loadListings();
    onAction?.("Re-published listing to pending");
    showToast({ type: "success", message: "Listing moved to pending review" });
    setActionKey("");
  };

  const startEdit = (listing) => {
    setEditingId(String(listing.id));
    setEditForm({
      title: listing.title || "",
      price: String(listing.price ?? ""),
      district: listing.district || "",
      listing_type: listing.listing_type || "sale",
      property_type: listing.property_type || "house",
      beds: String(listing.beds ?? ""),
      baths: String(listing.baths ?? ""),
      garage: String(listing.garage ?? ""),
      status: listing.status || "pending",
      currency: listing.currency || "BZD",
    });
  };

  const saveEdit = async (listingId) => {
    setActionKey(`${listingId}:edit`);
    const payload = {
      title: editForm.title.trim(),
      price: Number(editForm.price || 0),
      district: editForm.district.trim(),
      listing_type: editForm.listing_type,
      property_type: editForm.property_type,
      beds: editForm.beds === "" ? null : Number(editForm.beds),
      baths: editForm.baths === "" ? null : Number(editForm.baths),
      garage: editForm.garage === "" ? null : Number(editForm.garage),
      status: editForm.status,
      currency: editForm.currency || "BZD",
    };
    const { error } = await supabase.from("listings").update(payload).eq("id", listingId);
    if (error) {
      console.error("[operator-listings-panel] edit error", error);
      setActionKey("");
      showToast({ type: "error", message: "Unable to update listing" });
      return;
    }
    setEditingId("");
    await loadListings();
    onAction?.("Updated listing from operator panel");
    showToast({ type: "success", message: "Listing updated" });
    setActionKey("");
  };

  if (loading) {
    return (
      <div className={styles.pendingGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 120 }} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.pendingGrid}>
      <div className={styles.statusToggle} role="tablist" aria-label="Operator listing status filter">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={statusFilter === filter.value}
            className={`${styles.toggleButton} ${statusFilter === filter.value ? styles.toggleButtonActive : ""}`}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filteredListings.map((listing) => {
        const imageUrl = listing?.listing_images?.[0]?.image_url || "/placeholder.jpg";
        const isArchived = listing.status === "archived";
        const isPending = listing.status === "pending";
        const isBusy = actionKey.startsWith(`${listing.id}:`);
        return (
          <div
            key={listing.id}
            className={`${styles.pendingCard} ${isArchived ? styles.archivedCard : ""} ${isPending ? styles.pendingTone : ""} ${
              isBusy ? styles.cardActionBusy : ""
            }`}
          >
            <img src={imageUrl} alt={listing.title || "Listing"} className={styles.pendingImage} />
            <div className={styles.pendingBody}>
              <div className={styles.pendingMeta}>
                <h3 className={styles.pendingTitle}>{listing.title || "Untitled listing"}</h3>
                <p className={styles.pendingPrice}>
                  {Number(listing.price || 0).toLocaleString()} {listing.currency || "BZD"}
                </p>
                <p className={styles.pendingSubtle}>
                  Owner: {ownerMap[String(listing.user_id)] || String(listing.user_id || "unknown")}
                </p>
                <span
                  className={`${styles.statusBadge} ${
                    styles[`status${String(listing.status || "").charAt(0).toUpperCase()}${String(listing.status || "").slice(1)}`]
                  }`}
                >
                  {isArchived ? "Archived (Not Public)" : listing.status || "unknown"}
                </span>
              </div>
              <div className={styles.adminActionRow}>
                <button
                  type="button"
                  className={styles.dashboardLink}
                  onClick={() => router.push(`/listing/${listing.id}?admin=true`)}
                  disabled={isBusy}
                >
                  View
                </button>
                {isArchived ? (
                  <button
                    type="button"
                    className={styles.approveButton}
                    onClick={() => republishListing(listing.id)}
                    disabled={isBusy}
                  >
                    {actionKey === `${listing.id}:republish` ? "Publishing..." : "Re-publish"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.deleteListingButton}
                    onClick={() => archiveListing(listing.id)}
                    disabled={isBusy}
                  >
                    {actionKey === `${listing.id}:archive` ? "Removing..." : "Remove Listing"}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.dashboardLink}
                  onClick={() => startEdit(listing)}
                  disabled={isBusy}
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {editingId ? (
        <div className={styles.modalBackdrop} onClick={() => setEditingId("")}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className={styles.sectionTitle}>Edit Listing</h3>
            <div className={styles.modalForm}>
              <input className={styles.input} value={editForm.title} onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Title" />
              <input className={styles.input} value={editForm.price} onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))} placeholder="Price" />
              <select className={styles.select} value={editForm.property_type} onChange={(event) => setEditForm((prev) => ({ ...prev, property_type: event.target.value }))}>
                <option value="house">house</option>
                <option value="apartment">apartment</option>
                <option value="condo">condo</option>
                <option value="land">land</option>
                <option value="commercial">commercial</option>
              </select>
              <select className={styles.select} value={editForm.district} onChange={(event) => setEditForm((prev) => ({ ...prev, district: event.target.value }))}>
                <option value="belize">belize</option>
                <option value="cayo">cayo</option>
                <option value="stann-creek">stann-creek</option>
                <option value="toledo">toledo</option>
                <option value="orange-walk">orange-walk</option>
                <option value="corozal">corozal</option>
              </select>
              <div className={styles.modalGridCols}>
                <input className={styles.input} value={editForm.beds} onChange={(event) => setEditForm((prev) => ({ ...prev, beds: event.target.value }))} placeholder="Beds" />
                <input className={styles.input} value={editForm.baths} onChange={(event) => setEditForm((prev) => ({ ...prev, baths: event.target.value }))} placeholder="Baths" />
                <input className={styles.input} value={editForm.garage} onChange={(event) => setEditForm((prev) => ({ ...prev, garage: event.target.value }))} placeholder="Garage" />
              </div>
              <div className={styles.modalGridCols}>
                <select className={styles.select} value={editForm.listing_type} onChange={(event) => setEditForm((prev) => ({ ...prev, listing_type: event.target.value }))}>
                  <option value="sale">sale</option>
                  <option value="rent">rent</option>
                </select>
                <select className={styles.select} value={editForm.status} onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="approved">approved</option>
                  <option value="pending">pending</option>
                  <option value="rejected">rejected</option>
                  <option value="draft">draft</option>
                  <option value="archived">archived</option>
                </select>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.approveButton} onClick={() => saveEdit(editingId)} disabled={actionKey === `${editingId}:edit`}>
                {actionKey === `${editingId}:edit` ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" className={styles.rejectButton} onClick={() => setEditingId("")}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
