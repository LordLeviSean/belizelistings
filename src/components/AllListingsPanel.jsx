import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { traceAction, traceLog } from "../lib/trace";
import { useToast } from "./ui/ToastProvider";
import styles from "../styles/Dashboard.module.css";

export default function AllListingsPanel({ onAction }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const [ownerMap, setOwnerMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [editingId, setEditingId] = useState("");
  const [removingIds, setRemovingIds] = useState([]);
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
      console.error("[all-listings-panel] load error", error);
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
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-listings-all")
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

  const approveListing = async (listingId) => {
    setActionKey(`${listingId}:approve`);
    traceAction({
      type: "admin_approve_listing",
      payload: { listingId },
    });
    const { error } = await supabase.from("listings").update({ status: "approved" }).eq("id", listingId);
    traceAction({
      type: "admin_approve_listing_result",
      payload: { listingId },
      result: { ok: !error, error: error?.message ?? null },
    });
    if (error) {
      console.error("[all-listings-panel] approve error", error);
      setActionKey("");
      return;
    }
    await loadListings();
    onAction?.("Approved listing");
    showToast({ type: "success", message: "Listing approved" });
    setActionKey("");
  };

  const rejectListing = async (listingId) => {
    setActionKey(`${listingId}:reject`);
    traceAction({
      type: "admin_reject_listing",
      payload: { listingId },
    });
    const { error } = await supabase.from("listings").update({ status: "rejected" }).eq("id", listingId);
    traceAction({
      type: "admin_reject_listing_result",
      payload: { listingId },
      result: { ok: !error, error: error?.message ?? null },
    });
    if (error) {
      console.error("[all-listings-panel] reject error", error);
      setActionKey("");
      return;
    }
    await loadListings();
    onAction?.("Rejected listing");
    showToast({ type: "info", message: "Listing rejected" });
    setActionKey("");
  };

  const deleteListing = async (listingId) => {
    setActionKey(`${listingId}:delete`);
    traceAction({
      type: "admin_delete_listing",
      payload: { listingId },
    });
    await supabase.from("favorites").delete().eq("listing_id", String(listingId));
    const { data, error } = await supabase.from("listings").delete().eq("id", listingId).select();
    traceAction({
      type: "admin_delete_listing_result",
      payload: { listingId },
      result: { ok: !error, error: error?.message ?? null, deletedRows: data?.length ?? 0 },
    });
    if (error) {
      console.error("[all-listings-panel] delete error", error);
      setActionKey("");
      return;
    }
    setRemovingIds((prev) => [...prev, String(listingId)]);
    setListings((prev) => prev.filter((listing) => String(listing.id) !== String(listingId)));
    traceLog("DELETE RESULT:", { listingId, data, error: null });
    await loadListings();
    onAction?.("Deleted listing permanently");
    showToast({ type: "info", message: "Listing deleted" });
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
      console.error("[all-listings-panel] edit error", error);
      setActionKey("");
      return;
    }
    setEditingId("");
    await loadListings();
    onAction?.("Updated listing");
    showToast({ type: "success", message: "Listing updated" });
    setActionKey("");
  };

  if (loading) {
    return (
      <div className={styles.listingsTable}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={`${styles.listingsRow} skeleton`} style={{ minHeight: 76 }} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.listingsTable}>
      <div className={styles.listingsHeaderRow}>
        <span>Image</span>
        <span>Title</span>
        <span>Owner</span>
        <span>Status</span>
        <span>Price</span>
        <span>Actions</span>
      </div>
      {listings.map((listing) => {
        const imageUrl = listing?.listing_images?.[0]?.image_url || "/placeholder.jpg";
        return (
        <div key={listing.id} className={`${styles.listingsRow} ${removingIds.includes(String(listing.id)) ? styles.rowRemoving : ""}`}>
          <img src={imageUrl} alt={listing.title || "Listing"} className={styles.listingsThumb} />
          <div>
            {editingId === String(listing.id) ? null : (
              <>
                <p><strong>{listing.title || "Untitled listing"}</strong></p>
                <p className={styles.muted}>{listing.district || "Unknown district"} · {listing.listing_type || "unknown"} · {listing.beds ?? 0} bd / {listing.baths ?? 0} ba</p>
              </>
            )}
          </div>
          <p className={styles.muted}>{ownerMap[String(listing.user_id)] || String(listing.user_id || "unknown")}</p>
          <span className={`${styles.statusBadge} ${styles[`status${String(listing.status || "").charAt(0).toUpperCase()}${String(listing.status || "").slice(1)}`]}`}>
            {listing.status || "unknown"}
          </span>
          <p className={styles.muted}>{Number(listing.price || 0).toLocaleString()} {listing.currency || "BZD"}</p>
          <div className={styles.rowActions}>
            {editingId === String(listing.id) ? (
              <button type="button" className={styles.rejectButton} onClick={() => setEditingId("")}>Close</button>
            ) : (
              <>
            <button
              type="button"
              className={styles.approveButton}
              onClick={() => approveListing(listing.id)}
              disabled={actionKey === `${listing.id}:approve` || actionKey === `${listing.id}:reject` || actionKey === `${listing.id}:delete`}
            >
              {actionKey === `${listing.id}:approve` ? "Processing..." : "Approve"}
            </button>
            <button
              type="button"
              className={styles.rejectButton}
              onClick={() => rejectListing(listing.id)}
              disabled={actionKey === `${listing.id}:approve` || actionKey === `${listing.id}:reject` || actionKey === `${listing.id}:delete`}
            >
              {actionKey === `${listing.id}:reject` ? "Processing..." : "Reject"}
            </button>
            <button
              type="button"
              className={styles.deleteListingButton}
              onClick={() => deleteListing(listing.id)}
              disabled={actionKey === `${listing.id}:approve` || actionKey === `${listing.id}:reject` || actionKey === `${listing.id}:delete`}
            >
              {actionKey === `${listing.id}:delete` ? "Processing..." : "Delete"}
            </button>
                <button
                  type="button"
                  className={styles.dashboardLink}
                  onClick={() => startEdit(listing)}
                  disabled={actionKey === `${listing.id}:approve` || actionKey === `${listing.id}:reject` || actionKey === `${listing.id}:delete`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.dashboardLink}
                  onClick={() => router.push(`/listing/${listing.id}?admin=true`)}
                >
                  View
                </button>
              </>
            )}
          </div>
        </div>
      )})}
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
