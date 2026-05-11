import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { clearAllFavoritesForListing } from "../lib/favorites";
import { traceAction } from "../lib/trace";
import { useToast } from "./ui/ToastProvider";
import { isMissingColumnError } from "../lib/supabaseCompat";
import { sanitizeListingMutationPayload } from "../lib/listingPayloadSanitize";
import { LISTING_MUTATION_FLOW, LISTING_MUTATION_OPERATION } from "../lib/listingMutationDiagnostics";
import { getLifecycleLabel } from "../constants/operationalModel";
import { getLifecycleStatus } from "../utils/canonicalListing";
import styles from "../styles/Dashboard.module.css";

function listingOwnerProfileId(listing) {
  return String(listing?.user_id || listing?.agent_id || "").trim();
}

async function loadAllListingsForAdminUsers(supabase) {
  const selectAttempts = [
    "id, user_id, agent_id, status, lifecycle_status, moderation_status",
    "id, user_id, status, lifecycle_status, moderation_status",
    "id, user_id, agent_id, status",
    "id, user_id, status",
  ];
  for (const columns of selectAttempts) {
    const { data, error } = await supabase.from("listings").select(columns);
    if (!error) return data || [];
    if (!isMissingColumnError(error)) {
      console.error("[manage-users-panel] listings query failed", error);
      return [];
    }
  }
  return [];
}

export default function ManageUsersPanel({ onAction }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [roleUpdatingId, setRoleUpdatingId] = useState("");
  const [newUser, setNewUser] = useState({ email: "", password: "", role: "user" });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserMessage, setCreateUserMessage] = useState("");
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: usersData, error: usersError }, listingsRows] = await Promise.all([
      supabase.from("profiles").select("*"),
      loadAllListingsForAdminUsers(supabase),
    ]);
    if (usersError) {
      console.error("[manage-users-panel] profiles load error", usersError);
    }
    setUsers(usersData || []);
    setListings(listingsRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-listings-users")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const listingBuckets = useMemo(() => {
    const byUser = {};
    for (const listing of listings) {
      const key = listingOwnerProfileId(listing);
      if (!key) continue;
      if (!byUser[key]) byUser[key] = [];
      byUser[key].push(listing);
    }
    return byUser;
  }, [listings]);

  const updateRole = async (userId, newRole) => {
    setRoleUpdatingId(String(userId));
    traceAction({
      type: "admin_update_role",
      payload: { userId, newRole },
    });
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    traceAction({
      type: "admin_update_role_result",
      payload: { userId, newRole },
      result: { ok: !error, error: error?.message ?? null },
    });
    if (error) {
      console.error("[manage-users-panel] role update error", error);
      setRoleUpdatingId("");
      return;
    }
    await loadData();
    onAction?.("Updated user role");
    showToast({ type: "success", message: "Role updated" });
    setRoleUpdatingId("");
  };

  const updateListingStatus = async (listingId, status) => {
    setActionKey(`${listingId}:${status}`);
    traceAction({
      type: "admin_userpanel_update_listing_status",
      payload: { listingId, status },
    });
    const patch = sanitizeListingMutationPayload(
      { status },
      { mutationFlow: LISTING_MUTATION_FLOW.UNSPECIFIED, operation: LISTING_MUTATION_OPERATION.PATCH }
    );
    const { error } = await supabase.from("listings").update(patch).eq("id", listingId);
    traceAction({
      type: "admin_userpanel_update_listing_status_result",
      payload: { listingId, status },
      result: { ok: !error, error: error?.message ?? null },
    });
    if (error) {
      console.error("[manage-users-panel] listing status error", error);
      setActionKey("");
      return;
    }
    if (status === "approved") {
      await clearAllFavoritesForListing(listingId);
    }
    await loadData();
    onAction?.(`Updated listing to ${status}`);
    showToast({ type: "success", message: `Listing ${status}` });
    setActionKey("");
  };

  const deleteListing = async (listingId) => {
    setActionKey(`${listingId}:delete`);
    traceAction({
      type: "admin_userpanel_delete_listing",
      payload: { listingId },
    });
    await supabase.from("favorites").delete().eq("listing_id", String(listingId));
    const { error } = await supabase.from("listings").delete().eq("id", listingId);
    traceAction({
      type: "admin_userpanel_delete_listing_result",
      payload: { listingId },
      result: { ok: !error, error: error?.message ?? null },
    });
    if (error) {
      console.error("[manage-users-panel] listing delete error", error);
      setActionKey("");
      return;
    }
    await loadData();
    onAction?.("Deleted listing from user panel");
    showToast({ type: "info", message: "Listing deleted" });
    setActionKey("");
  };

  const createUser = async () => {
    if (!newUser.email.trim() || !newUser.password.trim()) return;
    setCreatingUser(true);
    setCreateUserMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newUser),
      });
      const payload = await response.json();
      if (!response.ok) {
        setCreateUserMessage(payload?.error || "Unable to create user");
        return false;
      } else {
        setCreateUserMessage("User created successfully");
        setNewUser({ email: "", password: "", role: "user" });
        await loadData();
        onAction?.("Created new user");
        showToast({ type: "success", message: "User created" });
        return true;
      }
    } catch (error) {
      setCreateUserMessage(error.message || "Unable to create user");
      return false;
    } finally {
      setCreatingUser(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 128 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Create New User</h3>
        <button type="button" className={styles.primaryButton} onClick={() => setShowCreateUserModal(true)}>
          + Create User
        </button>
        {createUserMessage ? <p className={styles.muted} style={{ marginTop: 8 }}>{createUserMessage}</p> : null}
      </div>
      {users.map((user) => {
        const userListings = listingBuckets[String(user.id)] || [];
        const approved = userListings.filter((l) => getLifecycleStatus(l) === "approved").length;
        const pending = userListings.filter((l) => getLifecycleStatus(l) === "pending").length;
        const rejected = userListings.filter((l) => getLifecycleStatus(l) === "rejected").length;
        const archived = userListings.filter((l) => getLifecycleStatus(l) === "archived").length;
        return (
          <div key={user.id} className={styles.card}>
            <p><strong>{user.full_name || user.email || "User"}</strong></p>
            <p className={styles.muted}>{user.email || "No email"}</p>
            <p className={styles.muted}>
              Total: {userListings.length} · Approved: {approved} · Pending: {pending} · Rejected: {rejected} · Archived: {archived}
            </p>
            <select
              className={styles.select}
              value={user.role || "user"}
              disabled={roleUpdatingId === String(user.id)}
              onChange={(e) => updateRole(user.id, e.target.value)}
            >
              <option value="admin">Admin</option>
              <option value="agent">Agent</option>
              <option value="user">User</option>
            </select>
            {roleUpdatingId === String(user.id) ? (
              <p className={styles.muted} style={{ marginTop: 6 }}>Processing...</p>
            ) : null}
            {userListings.length > 0 ? (
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {userListings.map((listing) => (
                  <div key={listing.id} className={styles.userListingRow}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600 }}>Listing {String(listing.id).slice(0, 8)}</p>
                      <p className={styles.muted} style={{ margin: 0 }}>
                        Status:{" "}
                        <span
                          className={`${styles.statusBadge} ${styles[`status${String(getLifecycleStatus(listing) || "draft").charAt(0).toUpperCase()}${String(getLifecycleStatus(listing) || "draft").slice(1)}`]}`}
                        >
                          {getLifecycleLabel(getLifecycleStatus(listing))}
                        </span>
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className={styles.approveButton}
                        disabled={actionKey === `${listing.id}:approved` || actionKey === `${listing.id}:rejected` || actionKey === `${listing.id}:delete`}
                        onClick={() => updateListingStatus(listing.id, "approved")}
                      >
                        {actionKey === `${listing.id}:approved` ? "Processing..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        className={styles.rejectButton}
                        disabled={actionKey === `${listing.id}:approved` || actionKey === `${listing.id}:rejected` || actionKey === `${listing.id}:delete`}
                        onClick={() => updateListingStatus(listing.id, "rejected")}
                      >
                        {actionKey === `${listing.id}:rejected` ? "Processing..." : "Reject"}
                      </button>
                      <button
                        type="button"
                        className={styles.deleteListingButton}
                        disabled={actionKey === `${listing.id}:approved` || actionKey === `${listing.id}:rejected` || actionKey === `${listing.id}:delete`}
                        onClick={() => deleteListing(listing.id)}
                      >
                        {actionKey === `${listing.id}:delete` ? "Processing..." : "Delete"}
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
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {showCreateUserModal ? (
        <div className={styles.modalBackdrop} onClick={() => setShowCreateUserModal(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className={styles.sectionTitle}>Create User</h3>
            <div className={styles.modalForm}>
              <input
                className={styles.input}
                placeholder="Email"
                value={newUser.email}
                onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
              />
              <input
                className={styles.input}
                placeholder="Temporary password"
                type="password"
                value={newUser.password}
                onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
              />
              <select
                className={styles.select}
                value={newUser.role}
                onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value }))}
              >
                <option value="admin">admin</option>
                <option value="agent">agent</option>
                <option value="user">user</option>
              </select>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={async () => {
                  const created = await createUser();
                  if (created) setShowCreateUserModal(false);
                }}
                disabled={creatingUser}
              >
                {creatingUser ? "Creating..." : "Create User"}
              </button>
              <button type="button" className={styles.rejectButton} onClick={() => setShowCreateUserModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
