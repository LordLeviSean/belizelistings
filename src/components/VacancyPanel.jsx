import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "@/styles/Dashboard.module.css";

function computeVacancy(unit) {
  const now = new Date();
  const rent = Number(unit.rent_amount || 0);
  const isVacant = String(unit.status || "").toLowerCase() === "vacant";
  const vacantSinceDate = unit.vacant_since ? new Date(unit.vacant_since) : null;
  let daysVacant = 0;
  if (isVacant && vacantSinceDate && !Number.isNaN(vacantSinceDate.getTime())) {
    const diffMs = now.getTime() - vacantSinceDate.getTime();
    daysVacant = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }
  const dailyLoss = isVacant ? rent / 30 : 0;
  const totalLoss = isVacant ? dailyLoss * daysVacant : 0;
  return { daysVacant, dailyLoss, totalLoss };
}

function severityClass(daysVacant) {
  if (daysVacant >= 45) return styles.vacancySevere;
  if (daysVacant >= 20) return styles.vacancyMedium;
  return styles.vacancyLow;
}

export default function VacancyPanel({ userId }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("units")
        .select("id,name,rent_amount,status,vacant_since,property:properties(name,user_id)")
        .eq("status", "vacant")
        .order("vacant_since", { ascending: true });
      if (error) {
        console.error("[vacancy-panel] load error", error);
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
        return;
      }
      const filtered = (data || []).filter((unit) => unit?.property?.user_id === userId);
      if (!cancelled) {
        setRows(filtered);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const computedRows = useMemo(() => {
    return rows.map((unit) => ({
      ...unit,
      ...computeVacancy(unit),
      propertyName: unit?.property?.name || "Unknown property",
    }));
  }, [rows]);

  const monthSummary = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonthElapsed = Math.max(1, Math.floor((now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const totalVacantUnits = computedRows.length;
    const totalVacancyLoss = computedRows.reduce((sum, row) => {
      const overlapDays = Math.min(row.daysVacant, daysInMonthElapsed);
      return sum + row.dailyLoss * overlapDays;
    }, 0);
    return { totalVacantUnits, totalVacancyLoss };
  }, [computedRows]);

  if (loading) {
    return (
      <div className={styles.pendingGrid}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={`${styles.card} skeleton`} style={{ minHeight: 110 }} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.pendingGrid}>
      <div className={styles.statsGrid} style={{ marginTop: 0 }}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Total Vacancy Loss (This Month)</p>
          <p className={styles.statValue}>{Number(monthSummary.totalVacancyLoss || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Total Vacant Units</p>
          <p className={styles.statValue}>{monthSummary.totalVacantUnits}</p>
        </div>
      </div>

      <div className={styles.listingsTable}>
        <div className={styles.listingsHeaderRow} style={{ gridTemplateColumns: "1fr 1fr 120px 120px 140px" }}>
          <span>Property Name</span>
          <span>Unit Name</span>
          <span>Vacant Days</span>
          <span>Daily Loss</span>
          <span>Total Loss</span>
        </div>
        {computedRows.map((row) => (
          <div
            key={row.id}
            className={`${styles.listingsRow} ${severityClass(row.daysVacant)}`}
            style={{ gridTemplateColumns: "1fr 1fr 120px 120px 140px" }}
          >
            <p className={styles.muted}>{row.propertyName}</p>
            <p className={styles.muted}>{row.name || "Unnamed unit"}</p>
            <p className={styles.muted}>{row.daysVacant}</p>
            <p className={styles.muted}>{Number(row.dailyLoss || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            <p className={styles.muted}>{Number(row.totalLoss || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
        ))}
        {computedRows.length === 0 ? <p className={styles.muted}>No vacant units right now.</p> : null}
      </div>
    </div>
  );
}
