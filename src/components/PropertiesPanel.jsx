import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "@/styles/Dashboard.module.css";

const INITIAL_FORM = {
  name: "",
  address: "",
  district: "",
  property_type: "",
};

export default function PropertiesPanel({ userId }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [properties, setProperties] = useState([]);

  const loadProperties = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("properties")
      .select("id,name,address,district,property_type,units(id,status)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[properties-panel] load error", error);
      setLoading(false);
      return;
    }

    setProperties(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const propertyCards = useMemo(() => {
    return properties.map((property) => {
      const units = Array.isArray(property.units) ? property.units : [];
      const vacantUnits = units.filter((unit) => String(unit?.status || "").toLowerCase() === "vacant").length;
      return {
        ...property,
        unitsCount: units.length,
        vacantUnitsCount: vacantUnits,
      };
    });
  }, [properties]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!userId || saving) return;
    if (!form.name.trim()) {
      showToast({ type: "error", message: "Property name is required" });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      name: form.name.trim(),
      address: form.address.trim() || null,
      district: form.district.trim().toLowerCase() || null,
      property_type: form.property_type.trim().toLowerCase() || null,
    };
    const { error } = await supabase.from("properties").insert(payload);
    if (error) {
      console.error("[properties-panel] create error", error);
      showToast({ type: "error", message: "Unable to create property" });
      setSaving(false);
      return;
    }
    setForm(INITIAL_FORM);
    setShowCreate(false);
    await loadProperties();
    showToast({ type: "success", message: "Property created" });
    setSaving(false);
  };

  return (
    <div className={styles.pendingGrid}>
      <div className={styles.adminActionRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setShowCreate((prev) => !prev)}
        >
          {showCreate ? "Close" : "+ Create Property"}
        </button>
      </div>

      {showCreate ? (
        <form className={styles.card} style={{ display: "grid", gap: 10 }} onSubmit={handleCreate}>
          <input
            className={styles.input}
            placeholder="Property name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className={styles.input}
            placeholder="Address"
            value={form.address}
            onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
          />
          <input
            className={styles.input}
            placeholder="District"
            value={form.district}
            onChange={(event) => setForm((prev) => ({ ...prev, district: event.target.value }))}
          />
          <select
            className={styles.select}
            value={form.property_type}
            onChange={(event) => setForm((prev) => ({ ...prev, property_type: event.target.value }))}
          >
            <option value="">Select property type</option>
            <option value="house">house</option>
            <option value="apartment">apartment</option>
            <option value="commercial">commercial</option>
            <option value="mixed">mixed</option>
          </select>
          <button type="submit" className={styles.primaryButton} disabled={saving}>
            {saving ? "Creating..." : "Create Property"}
          </button>
        </form>
      ) : null}

      {loading ? (
        <div className={styles.pendingGrid}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 110 }} />
          ))}
        </div>
      ) : null}

      {!loading && propertyCards.length === 0 ? (
        <p className={styles.muted}>No properties yet. Create one to manage units.</p>
      ) : null}

      {!loading &&
        propertyCards.map((property) => (
          <div key={property.id} className={styles.card} style={{ display: "grid", gap: 8 }}>
            <h3 style={{ margin: 0 }}>{property.name}</h3>
            <p className={styles.muted}>{property.address || "No address provided"}</p>
            <p className={styles.pendingSubtle}>
              Units: {property.unitsCount} · Vacant: {property.vacantUnitsCount}
            </p>
            <div className={styles.adminActionRow}>
              <button
                type="button"
                className={styles.dashboardLink}
                onClick={() => router.push(`/dashboard/operator/property/${property.id}`)}
              >
                View Units
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => router.push(`/dashboard/operator/property/${property.id}?openAdd=1`)}
              >
                Add Unit
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
