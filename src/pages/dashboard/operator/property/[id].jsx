import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import SiteNav from "@/components/SiteNav";
import BackButton from "@/components/BackButton";
import Breadcrumbs from "@/components/Breadcrumbs";
import useUserRole from "@/hooks/useUserRole";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "@/styles/Dashboard.module.css";

const INITIAL_UNIT_FORM = {
  name: "",
  rent_amount: "",
  status: "vacant",
  vacant_since: "",
};

function formatCurrency(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PropertyUnitsPage() {
  const router = useRouter();
  const { id, openAdd } = router.query;
  const { user, role, loading: roleLoading } = useUserRole();
  const { showToast } = useToast();
  const [property, setProperty] = useState(null);
  const [units, setUnits] = useState([]);
  const [unitListingMap, setUnitListingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState("");
  const [unitForm, setUnitForm] = useState(INITIAL_UNIT_FORM);

  const loadData = async () => {
    if (!id || !user?.id) return;
    setLoading(true);
    const [{ data: propertyRow, error: propertyError }, { data: unitRows, error: unitsError }] = await Promise.all([
      supabase.from("properties").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
      supabase.from("units").select("*").eq("property_id", id).order("created_at", { ascending: false }),
    ]);

    if (propertyError || !propertyRow) {
      setLoading(false);
      setProperty(null);
      setUnits([]);
      return;
    }
    if (unitsError) {
      console.error("[property-units] load units error", unitsError);
    }

    const unitIds = (unitRows || []).map((unit) => unit.id).filter(Boolean);
    let listingRows = [];
    if (unitIds.length > 0) {
      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select("id,unit_id,status,created_at")
        .in("unit_id", unitIds)
        .order("created_at", { ascending: false });
      if (listingsError) {
        console.error("[property-units] load linked listings error", listingsError);
      } else {
        listingRows = listingsData || [];
      }
    }
    const nextUnitListingMap = {};
    for (const listing of listingRows) {
      const key = String(listing.unit_id || "");
      if (!key || nextUnitListingMap[key]) continue;
      nextUnitListingMap[key] = String(listing.status || "").toLowerCase();
    }

    setProperty(propertyRow);
    setUnits(unitRows || []);
    setUnitListingMap(nextUnitListingMap);
    setLoading(false);
  };

  useEffect(() => {
    if (roleLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role !== "agent") {
      router.replace("/dashboard");
      return;
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, user?.id, role, id]);

  useEffect(() => {
    if (openAdd === "1") {
      setShowAddModal(true);
    }
  }, [openAdd]);

  const unitRows = useMemo(() => {
    const now = new Date();
    return units.map((unit) => {
      const isVacant = String(unit.status || "").toLowerCase() === "vacant";
      const rent = Number(unit.rent_amount || 0);
      const vacantSinceDate = unit.vacant_since ? new Date(unit.vacant_since) : null;
      let daysVacant = 0;
      if (isVacant && vacantSinceDate && !Number.isNaN(vacantSinceDate.getTime())) {
        const ms = now.getTime() - vacantSinceDate.getTime();
        daysVacant = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
      }
      const dailyLoss = isVacant ? rent / 30 : 0;
      const totalLoss = isVacant ? dailyLoss * daysVacant : 0;
      return {
        ...unit,
        isVacant,
        daysVacant,
        totalLoss,
        listingStatus: unitListingMap[String(unit.id || "")] || "none",
      };
    });
  }, [units, unitListingMap]);

  const resetForm = () => {
    setUnitForm(INITIAL_UNIT_FORM);
    setEditingUnitId("");
  };

  const openEdit = (unit) => {
    setEditingUnitId(String(unit.id));
    setUnitForm({
      name: unit.name || "",
      rent_amount: String(unit.rent_amount ?? ""),
      status: unit.status || "vacant",
      vacant_since: unit.vacant_since ? String(unit.vacant_since).slice(0, 10) : "",
    });
    setShowAddModal(true);
  };

  const saveUnit = async () => {
    if (!id) return;
    if (!unitForm.name.trim()) {
      showToast({ type: "error", message: "Unit name is required" });
      return;
    }
    setActionKey(editingUnitId ? `${editingUnitId}:save` : "create");
    const payload = {
      property_id: id,
      name: unitForm.name.trim(),
      rent_amount: Number(unitForm.rent_amount || 0),
      status: unitForm.status || "vacant",
      vacant_since: unitForm.status === "vacant" ? (unitForm.vacant_since || null) : null,
    };

    let error = null;
    if (editingUnitId) {
      ({ error } = await supabase.from("units").update(payload).eq("id", editingUnitId));
    } else {
      ({ error } = await supabase.from("units").insert(payload));
    }

    if (error) {
      console.error("[property-units] save unit error", error);
      showToast({ type: "error", message: "Unable to save unit" });
      setActionKey("");
      return;
    }
    await loadData();
    showToast({ type: "success", message: editingUnitId ? "Unit updated" : "Unit added" });
    setActionKey("");
    setShowAddModal(false);
    resetForm();
  };

  const deleteUnit = async (unitId) => {
    const { data: linkedListings, error: linkedError } = await supabase
      .from("listings")
      .select("id,status")
      .eq("unit_id", unitId)
      .neq("status", "archived");
    if (linkedError) {
      console.error("[property-units] linked listings check error", linkedError);
      showToast({ type: "error", message: "Unable to validate linked listings" });
      return;
    }
    if ((linkedListings || []).length > 0) {
      showToast({ type: "error", message: "Archive linked listings before deleting this unit" });
      return;
    }

    setActionKey(`${unitId}:delete`);
    const { error } = await supabase.from("units").delete().eq("id", unitId);
    if (error) {
      console.error("[property-units] delete unit error", error);
      showToast({ type: "error", message: "Unable to delete unit" });
      setActionKey("");
      return;
    }
    await loadData();
    showToast({ type: "info", message: "Unit deleted" });
    setActionKey("");
  };

  const toggleUnitOccupancy = async (unit) => {
    const unitId = String(unit.id);
    const isCurrentlyOccupied = String(unit.status || "").toLowerCase() === "occupied";
    const nextStatus = isCurrentlyOccupied ? "vacant" : "occupied";
    const nextVacantSince = nextStatus === "vacant" ? new Date().toISOString() : null;

    const previousUnits = units;
    setActionKey(`${unitId}:toggle`);
    setUnits((prev) =>
      prev.map((row) =>
        String(row.id) === unitId
          ? {
              ...row,
              status: nextStatus,
              vacant_since: nextVacantSince,
            }
          : row
      )
    );

    const { error } = await supabase
      .from("units")
      .update({
        status: nextStatus,
        vacant_since: nextVacantSince,
      })
      .eq("id", unitId);

    if (error) {
      console.error("[property-units] toggle occupancy error", error);
      setUnits(previousUnits);
      showToast({ type: "error", message: "Unable to update unit status" });
      setActionKey("");
      return;
    }

    showToast({ type: "success", message: nextStatus === "occupied" ? "Unit marked occupied" : "Unit marked vacant" });
    setActionKey("");
  };

  const startCreateListing = async (unit) => {
    if (!property?.id) return;
    setActionKey(`${unit.id}:create`);
    const { data, error } = await supabase
      .from("listings")
      .select("id")
      .eq("unit_id", unit.id)
      .in("status", ["pending", "approved"])
      .limit(1);

    if (error) {
      console.error("[property-units] active listing check error", error);
      showToast({ type: "error", message: "Unable to validate listing state" });
      setActionKey("");
      return;
    }

    if ((data || []).length > 0) {
      showToast({ type: "error", message: "This unit already has an active listing" });
      setActionKey("");
      return;
    }

    await router.push({
      pathname: "/dashboard/create",
      query: {
        listing_type: "rent",
        price: String(unit.rent_amount ?? ""),
        district: String(property.district || ""),
        property_type: String(property.property_type || ""),
        propertyId: String(property.id || ""),
        unitId: String(unit.id || ""),
      },
    });
    setActionKey("");
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <p className={styles.muted}>Loading units...</p>
        </main>
      </div>
    );
  }

  if (!property) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <BackButton fallback="/dashboard/agent" />
          <p className={styles.muted}>Property not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <div className={styles.adminWrapper}>
          <Breadcrumbs />
          <BackButton fallback="/dashboard/agent" />
          <h1 className={styles.title}>{property.name} · Units</h1>
          <p className={styles.muted}>{property.address || "No address provided"}</p>

          <div className={styles.adminActionRow} style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
            >
              Add Unit
            </button>
          </div>

          <div className={styles.listingsTable}>
            <div className={styles.listingsHeaderRow} style={{ gridTemplateColumns: "1.2fr 120px 120px 120px 140px 1fr" }}>
              <span>Unit Name</span>
              <span>Rent</span>
              <span>Status</span>
              <span>Vacant Days</span>
              <span>Loss</span>
              <span>Actions</span>
            </div>
            {unitRows.map((unit) => (
              <div
                key={unit.id}
                className={styles.listingsRow}
                style={{ gridTemplateColumns: "1.2fr 120px 120px 120px 140px 1fr" }}
              >
                <p className={styles.muted}>{unit.name || "Unnamed unit"}</p>
                <p className={styles.muted}>{formatCurrency(unit.rent_amount)} BZD</p>
                <span className={`${styles.statusBadge} ${styles[`status${String(unit.status || "").charAt(0).toUpperCase()}${String(unit.status || "").slice(1)}`]}`}>
                  {unit.status || "vacant"}
                </span>
                <span
                  className={`${styles.statusBadge} ${
                    unit.listingStatus === "approved"
                      ? styles.statusApproved
                      : unit.listingStatus === "pending"
                        ? styles.statusPending
                        : unit.listingStatus === "archived"
                          ? styles.statusArchived
                          : styles.statusDraft
                  }`}
                >
                  {unit.listingStatus === "approved"
                    ? "Listed (Approved)"
                    : unit.listingStatus === "pending"
                      ? "Pending Review"
                      : unit.listingStatus === "archived"
                        ? "Archived"
                        : "No Listing"}
                </span>
                <p className={styles.muted}>{unit.isVacant ? unit.daysVacant : "-"}</p>
                <p className={styles.muted}>{unit.isVacant ? `${formatCurrency(unit.totalLoss)} BZD` : "-"}</p>
                <div className={styles.adminActionRow}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => startCreateListing(unit)}
                    disabled={actionKey !== ""}
                  >
                    {actionKey === `${unit.id}:create` ? "Checking..." : "Create Listing"}
                  </button>
                  <button
                    type="button"
                    className={styles.approveButton}
                    onClick={() => toggleUnitOccupancy(unit)}
                    disabled={actionKey !== ""}
                  >
                    {actionKey === `${unit.id}:toggle`
                      ? "Updating..."
                      : unit.isVacant
                        ? "Mark Occupied"
                        : "Mark Vacant"}
                  </button>
                  <button
                    type="button"
                    className={styles.dashboardLink}
                    onClick={() => openEdit(unit)}
                    disabled={actionKey !== ""}
                  >
                    Edit Unit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteListingButton}
                    onClick={() => deleteUnit(unit.id)}
                    disabled={actionKey === `${unit.id}:delete`}
                  >
                    {actionKey === `${unit.id}:delete` ? "Deleting..." : "Delete Unit"}
                  </button>
                </div>
              </div>
            ))}
            {unitRows.length === 0 ? <p className={styles.muted}>No units yet.</p> : null}
          </div>
        </div>
      </main>

      {showAddModal ? (
        <div className={styles.modalBackdrop} onClick={() => {
          setShowAddModal(false);
          resetForm();
        }}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className={styles.sectionTitle}>{editingUnitId ? "Edit Unit" : "Add Unit"}</h3>
            <div className={styles.modalForm}>
              <input
                className={styles.input}
                placeholder="Unit Name"
                value={unitForm.name}
                onChange={(event) => setUnitForm((prev) => ({ ...prev, name: event.target.value }))}
              />
              <input
                className={styles.input}
                placeholder="Rent Amount"
                value={unitForm.rent_amount}
                onChange={(event) => setUnitForm((prev) => ({ ...prev, rent_amount: event.target.value }))}
              />
              <select
                className={styles.select}
                value={unitForm.status}
                onChange={(event) => setUnitForm((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="vacant">vacant</option>
                <option value="occupied">occupied</option>
              </select>
              {unitForm.status === "vacant" ? (
                <input
                  className={styles.input}
                  type="date"
                  value={unitForm.vacant_since}
                  onChange={(event) => setUnitForm((prev) => ({ ...prev, vacant_since: event.target.value }))}
                />
              ) : null}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.approveButton} onClick={saveUnit} disabled={actionKey !== ""}>
                {actionKey && actionKey.endsWith(":save") ? "Saving..." : editingUnitId ? "Save Changes" : "Add Unit"}
              </button>
              <button
                type="button"
                className={styles.rejectButton}
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
