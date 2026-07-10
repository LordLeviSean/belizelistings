import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { permanentlyDeleteUserViaApi } from "../lib/userPermanentDelete";
import DeleteUserModal from "./DeleteUserModal";
import { clearAllFavoritesForListing } from "../lib/favorites";
import { traceAction } from "../lib/trace";
import { useToast } from "./ui/ToastProvider";
import { fetchAllProfileRows } from "../lib/profileSelectContract";
import { isMissingColumnError } from "../lib/supabaseCompat";
import { getLifecycleLabel, getModerationStatus } from "../constants/operationalModel";
import { getLifecycleStatus } from "../utils/canonicalListing";
import { applyListingLifecycleAction } from "../utils/ownershipAttribution";
import { OWNERSHIP_ACTIONS } from "../constants/ownershipModel";
import { normalizeUsername, validateUsernameCandidate } from "../lib/usernameRules";
import { MODAL_TYPES, useModalController } from "@/hooks/useModalController";
import {
  omitRouterQueryParam,
  shouldOpenCreateUserModal,
} from "@/lib/adminDashboardQuery";
import styles from "../styles/Dashboard.module.css";
import mu from "./ManageUsersPanel.module.css";
import { formatProfileDisplayLabel } from "../lib/profileDisplayName";

function listingOwnerProfileId(listing) {
  return String(listing?.user_id || listing?.agent_id || "").trim();
}

async function loadListingsForProfileId(supabaseClient, profileId) {
  const pid = String(profileId).trim();
  const selectAttempts = [
    "id, user_id, agent_id, status, lifecycle_status, moderation_status",
    "id, user_id, status, lifecycle_status, moderation_status",
    "id, user_id, agent_id, status",
    "id, user_id, status",
  ];
  for (const columns of selectAttempts) {
    const { data, error } = await supabaseClient
      .from("listings")
      .select(columns)
      .or(`user_id.eq.${pid},agent_id.eq.${pid}`);
    if (!error) return data || [];
    if (!isMissingColumnError(error)) {
      console.error("[manage-users-panel] listings query failed", error);
      return [];
    }
  }
  return [];
}

export default function ManageUsersPanel({ onAction, profilesRevision = 0 }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [listingsByUserId, setListingsByUserId] = useState({});
  const [listingsLoadingId, setListingsLoadingId] = useState("");
  const [actionKey, setActionKey] = useState("");
  const [roleUpdatingId, setRoleUpdatingId] = useState("");
  const [newUser, setNewUser] = useState({ email: "", username: "", password: "", role: "user" });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserMessage, setCreateUserMessage] = useState("");
  const [modalFieldError, setModalFieldError] = useState("");
  const modal = useModalController();
  const deleteTarget =
    modal.isModalOpen(MODAL_TYPES.ADMIN_ACTION) &&
    modal.activeModal?.payload?.action === "delete-user"
      ? modal.activeModal.payload.user
      : null;
  const showCreateUserModal =
    modal.isModalOpen(MODAL_TYPES.SYSTEM) &&
    modal.activeModal?.payload?.action === "create-user";
  const [roleUnlocked, setRoleUnlocked] = useState({});
  const [listingsUnlocked, setListingsUnlocked] = useState({});
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const listingsUnlockedRef = useRef({});

  useEffect(() => {
    listingsUnlockedRef.current = listingsUnlocked;
  }, [listingsUnlocked]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const { data: usersData, error: usersError } = await fetchAllProfileRows(supabase);
    if (usersError) {
      console.error("[manage-users-panel] profiles load error", usersError);
    }
    setUsers(usersData || []);
    setUsersLoading(false);
  }, []);

  const fetchListingsForUser = useCallback(async (userId) => {
    const id = String(userId);
    setListingsLoadingId(id);
    const rows = await loadListingsForProfileId(supabase, id);
    setListingsByUserId((prev) => ({ ...prev, [id]: rows }));
    setListingsLoadingId("");
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers, profilesRevision]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setCurrentUserId(String(data?.user?.id || ""));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let debounceL;
    const channel = supabase
      .channel("admin-manage-users-listings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings" },
        () => {
          clearTimeout(debounceL);
          debounceL = setTimeout(() => {
            const unlocked = listingsUnlockedRef.current;
            const ids = Object.keys(unlocked).filter((k) => unlocked[k]);
            for (const uid of ids) {
              void fetchListingsForUser(uid);
            }
          }, 420);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceL);
      supabase.removeChannel(channel);
    };
  }, [fetchListingsForUser]);

  const listingBuckets = useMemo(() => {
    const byUser = {};
    for (const [uid, rows] of Object.entries(listingsByUserId)) {
      byUser[uid] = rows || [];
    }
    return byUser;
  }, [listingsByUserId]);

  const isRoleUnlocked = (userId) => !!roleUnlocked[String(userId)];
  const isListingsUnlocked = (userId) => !!listingsUnlocked[String(userId)];

  const updateRole = async (userId, newRole) => {
    if (!isRoleUnlocked(userId)) return;
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
    await loadUsers();
    onAction?.("Updated user role");
    showToast({ type: "success", message: "Role updated" });
    setRoleUpdatingId("");
  };

  const updateListingStatus = async (userId, listingId, status) => {
    if (!isListingsUnlocked(userId)) return;
    setActionKey(`${listingId}:${status}`);
    traceAction({
      type: "admin_userpanel_update_listing_status",
      payload: { listingId, status },
    });
    const action =
      status === "approved" ? OWNERSHIP_ACTIONS.APPROVE : OWNERSHIP_ACTIONS.REJECT;
    const { error } = await applyListingLifecycleAction(supabase, {
      listingId,
      action,
      extraUpdates: {
        status: getModerationStatus(status === "approved" ? "approved" : "rejected"),
      },
    });
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
    await fetchListingsForUser(userId);
    await loadUsers();
    onAction?.(`Updated listing to ${status}`);
    showToast({ type: "success", message: `Listing ${status}` });
    setActionKey("");
  };

  const deleteListing = async (userId, listingId) => {
    if (!isListingsUnlocked(userId)) return;
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
    await fetchListingsForUser(userId);
    await loadUsers();
    onAction?.("Deleted listing from user panel");
    showToast({ type: "info", message: "Listing deleted" });
    setActionKey("");
  };

  const createUser = async () => {
    setModalFieldError("");
    if (!newUser.email.trim() || !newUser.password.trim()) {
      setCreateUserMessage("Email and password are required.");
      return false;
    }
    const uCheck = validateUsernameCandidate(newUser.username);
    if (!uCheck.ok) {
      setModalFieldError(uCheck.message);
      return false;
    }
    const norm = uCheck.username;
    const dupLocal = users.some((u) => normalizeUsername(u.username) === norm);
    if (dupLocal) {
      setModalFieldError("That username is already taken.");
      return false;
    }

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
        body: JSON.stringify({
          email: newUser.email.trim(),
          username: norm,
          password: newUser.password,
          role: newUser.role,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setCreateUserMessage(payload?.error || "Unable to create user");
        return false;
      }
      setCreateUserMessage("User created successfully");
      setNewUser({ email: "", username: "", password: "", role: "user" });
      await loadUsers();
      onAction?.("Created new user");
      showToast({ type: "success", message: "User created" });
      return true;
    } catch (error) {
      setCreateUserMessage(error.message || "Unable to create user");
      return false;
    } finally {
      setCreatingUser(false);
    }
  };

  const openCreateModal = () => {
    setModalFieldError("");
    setCreateUserMessage("");
    modal.closeAllModals();
    modal.openModal(MODAL_TYPES.SYSTEM, { action: "create-user" });
  };

  useEffect(() => {
    if (!shouldOpenCreateUserModal(router.query.action)) return;
    openCreateModal();
    const nextQuery = omitRouterQueryParam(router.query, "action");
    void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }, [router.query.action]);

  const unlockListings = (userId) => {
    const id = String(userId);
    setListingsUnlocked((prev) => ({ ...prev, [id]: true }));
    void fetchListingsForUser(id);
  };

  const permanentlyDeleteUser = async ({ reason = "" } = {}) => {
    if (!deleteTarget?.id || !isRoleUnlocked(deleteTarget.id)) return;
    setDeleteBusy(true);
    traceAction({
      type: "admin_permanent_delete_user",
      payload: { userId: deleteTarget.id },
    });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const result = await permanentlyDeleteUserViaApi({
        userId: deleteTarget.id,
        reason,
        accessToken: token,
      });
      traceAction({
        type: "admin_permanent_delete_user_result",
        payload: { userId: deleteTarget.id },
        result: { ok: result.ok, error: result.error?.message ?? null },
      });
      if (!result.ok) {
        if (result.dataRemoved) {
          const removedId = String(deleteTarget.id);
          setUsers((prev) => prev.filter((row) => String(row.id) !== removedId));
          setListingsByUserId((prev) => {
            const next = { ...prev };
            delete next[removedId];
            return next;
          });
          setRoleUnlocked((prev) => {
            const next = { ...prev };
            delete next[removedId];
            return next;
          });
          setListingsUnlocked((prev) => {
            const next = { ...prev };
            delete next[removedId];
            return next;
          });
          await loadUsers();
          onAction?.("Permanently deleted user (auth cleanup pending)");
        }
        showToast({
          type: "error",
          message: result.error?.message || "Unable to permanently delete user",
        });
        if (result.dataRemoved) {
          modal.closeModal(MODAL_TYPES.ADMIN_ACTION);
        }
        setDeleteBusy(false);
        return;
      }
      const removedId = String(deleteTarget.id);
      setUsers((prev) => prev.filter((row) => String(row.id) !== removedId));
      setListingsByUserId((prev) => {
        const next = { ...prev };
        delete next[removedId];
        return next;
      });
      setRoleUnlocked((prev) => {
        const next = { ...prev };
        delete next[removedId];
        return next;
      });
      setListingsUnlocked((prev) => {
        const next = { ...prev };
        delete next[removedId];
        return next;
      });
      await loadUsers();
      onAction?.("Permanently deleted user");
      showToast({ type: "success", message: "User permanently deleted" });
      modal.closeModal(MODAL_TYPES.ADMIN_ACTION);
    } catch (error) {
      console.error("[manage-users-panel] permanent user delete error", error);
      showToast({
        type: "error",
        message: error?.message || "Unable to permanently delete user",
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  const lockListings = (userId) => {
    const id = String(userId);
    setListingsUnlocked((prev) => ({ ...prev, [id]: false }));
    setListingsByUserId((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  if (usersLoading && users.length === 0) {
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
        <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
          + Create User
        </button>
        {createUserMessage ? <p className={styles.muted} style={{ marginTop: 8 }}>{createUserMessage}</p> : null}
      </div>
      {users.map((user) => {
        const uid = String(user.id);
        const userListings = listingBuckets[uid] || [];
        const approved = userListings.filter((l) => getLifecycleStatus(l) === "approved").length;
        const pending = userListings.filter((l) => getLifecycleStatus(l) === "pending").length;
        const rejected = userListings.filter((l) => getLifecycleStatus(l) === "rejected").length;
        const archived = userListings.filter((l) => getLifecycleStatus(l) === "archived").length;
        const roleOk = isRoleUnlocked(user.id);
        const listOk = isListingsUnlocked(user.id);
        const isSelf = currentUserId && uid === currentUserId;
        const isAdminUser = String(user.role || "").toLowerCase() === "admin";
        const canDeleteUser = roleOk && !isSelf && !isAdminUser;
        const displayUsername = formatProfileDisplayLabel({
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          id: user.id,
        });

        return (
          <div key={user.id} className={`${styles.card} ${mu.userCard}`}>
            <div className={mu.userGrid}>
              <div>
                <span className={mu.th}>Username</span>
                <p className={mu.cellMuted} style={{ margin: 0, fontWeight: 650 }}>{displayUsername}</p>
              </div>
              <div>
                <span className={mu.th}>Email</span>
                <p className={mu.cellMuted} style={{ margin: 0 }}>{user.email || "—"}</p>
              </div>
              <div className={mu.roleCell}>
                <span className={mu.th}>Role</span>
                <div className={roleOk ? "" : mu.roleMuted}>
                  <select
                    className={styles.select}
                    style={{ width: "100%", maxWidth: 200 }}
                    value={user.role || "user"}
                    disabled={!roleOk || roleUpdatingId === uid}
                    onChange={(e) => updateRole(user.id, e.target.value)}
                  >
                    <option value="admin">Admin</option>
                    <option value="agent">Agent</option>
                    <option value="user">User</option>
                  </select>
                </div>
                {roleUpdatingId === uid ? (
                  <p className={styles.muted} style={{ marginTop: 6 }}>Processing…</p>
                ) : null}
              </div>
              <div>
                <span className={mu.th}>Status</span>
                <p className={mu.cellMuted} style={{ margin: 0 }}>Active</p>
              </div>
              <div className={mu.unlockCol}>
                <span className={mu.th}>Role controls</span>
                {roleOk ? (
                  <>
                    <p className={mu.warnStrip}>Unlocked — role changes apply immediately.</p>
                    <button
                      type="button"
                      className={mu.relockBtn}
                      onClick={() => setRoleUnlocked((p) => ({ ...p, [uid]: false }))}
                    >
                      Lock role controls
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={mu.unlockBtn}
                    onClick={() => setRoleUnlocked((p) => ({ ...p, [uid]: true }))}
                  >
                    Unlock role controls
                  </button>
                )}
              </div>
              <div className={mu.unlockCol}>
                <span className={mu.th}>Listings</span>
                {listOk ? (
                  <>
                    <p className={mu.warnStrip}>Unlocked — inventory loaded for this account.</p>
                    <button type="button" className={mu.relockBtn} onClick={() => lockListings(user.id)}>
                      Lock listings
                    </button>
                  </>
                ) : (
                  <button type="button" className={mu.unlockBtn} onClick={() => unlockListings(user.id)}>
                    Unlock listings
                  </button>
                )}
              </div>
            </div>

            {roleOk ? (
              <div className={mu.dangerSection}>
                <p className={mu.dangerHeading}>Danger Zone</p>
                <button
                  type="button"
                  className={mu.deleteUserBtn}
                  disabled={!canDeleteUser || deleteBusy}
                  onClick={() => {
                    modal.closeAllModals();
                    modal.openModal(MODAL_TYPES.ADMIN_ACTION, {
                      action: "delete-user",
                      user,
                    });
                  }}
                  title={
                    isSelf
                      ? "You cannot delete your own account"
                      : isAdminUser
                        ? "Admin accounts cannot be deleted here"
                        : "Permanently delete this user"
                  }
                >
                  <Trash2 size={15} aria-hidden />
                  Delete User
                </button>
              </div>
            ) : null}

            {listOk ? (
              <div className={mu.listingsPanel}>
                <div className={mu.accordionHead}>
                  <p className={styles.muted} style={{ margin: 0 }}>
                    {listingsLoadingId === uid
                      ? "Loading listings…"
                      : `Total: ${userListings.length} · Approved: ${approved} · Pending: ${pending} · Rejected: ${rejected} · Archived: ${archived}`}
                  </p>
                </div>
                {userListings.length > 0 ? (
                  <div className={mu.listingStack}>
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
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className={styles.approveButton}
                            disabled={
                              actionKey === `${listing.id}:approved` ||
                              actionKey === `${listing.id}:rejected` ||
                              actionKey === `${listing.id}:delete`
                            }
                            onClick={() => updateListingStatus(user.id, listing.id, "approved")}
                          >
                            {actionKey === `${listing.id}:approved` ? "Processing…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            className={styles.rejectButton}
                            disabled={
                              actionKey === `${listing.id}:approved` ||
                              actionKey === `${listing.id}:rejected` ||
                              actionKey === `${listing.id}:delete`
                            }
                            onClick={() => updateListingStatus(user.id, listing.id, "rejected")}
                          >
                            {actionKey === `${listing.id}:rejected` ? "Processing…" : "Reject"}
                          </button>
                          <button
                            type="button"
                            className={styles.deleteListingButton}
                            disabled={
                              actionKey === `${listing.id}:approved` ||
                              actionKey === `${listing.id}:rejected` ||
                              actionKey === `${listing.id}:delete`
                            }
                            onClick={() => deleteListing(user.id, listing.id)}
                          >
                            {actionKey === `${listing.id}:delete` ? "Processing…" : "Delete"}
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
                ) : listingsLoadingId !== uid ? (
                  <p className={mu.listingsSummary}>No listings for this profile in the linked owner columns.</p>
                ) : null}
              </div>
            ) : (
              <p className={mu.listingsSummary}>
                Listings stay unloaded until you unlock — reduces load and accidental edits.
              </p>
            )}
          </div>
        );
      })}
      <DeleteUserModal
        open={Boolean(deleteTarget)}
        user={deleteTarget}
        busy={deleteBusy}
        onClose={() => {
          if (!deleteBusy) modal.closeModal(MODAL_TYPES.ADMIN_ACTION);
        }}
        onConfirm={permanentlyDeleteUser}
      />
      {showCreateUserModal ? (
        <div className={styles.modalBackdrop} onClick={() => modal.closeModal(MODAL_TYPES.SYSTEM)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className={styles.sectionTitle}>Create User</h3>
            <div className={styles.modalForm}>
              <input
                className={styles.input}
                placeholder="Email"
                type="email"
                autoComplete="off"
                value={newUser.email}
                onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
              />
              <input
                className={styles.input}
                placeholder="Username"
                autoComplete="off"
                value={newUser.username}
                onChange={(event) => setNewUser((prev) => ({ ...prev, username: event.target.value }))}
              />
              {modalFieldError ? <p className={mu.fieldError}>{modalFieldError}</p> : null}
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
                  if (created) modal.closeModal(MODAL_TYPES.SYSTEM);
                }}
                disabled={creatingUser}
              >
                {creatingUser ? "Creating…" : "Create User"}
              </button>
              <button type="button" className={styles.rejectButton} onClick={() => modal.closeModal(MODAL_TYPES.SYSTEM)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
