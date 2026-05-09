import { useCountUp } from "../hooks/useCountUp";
import styles from "../styles/Dashboard.module.css";

function StatCard({ label, value, variant, sublabel }) {
  const animated = useCountUp(value);
  return (
    <div className={`${styles.operationalStatCard} ${styles[`operationalStat${variant}`] || ""}`} role="group" aria-label={label}>
      <div className={styles.operationalStatAccent} aria-hidden />
      <p className={styles.operationalStatLabel}>{label}</p>
      <p className={styles.operationalStatValue}>{animated}</p>
      {sublabel ? <p className={styles.operationalStatSub}>{sublabel}</p> : null}
    </div>
  );
}

export default function AdminOperationalStats({ total, pending, approved, rejected, archived, users }) {
  return (
    <div className={styles.operationalStatsShell}>
      <div className={styles.operationalStatsGrid}>
        <StatCard label="Total Listings" value={total} variant="Total" sublabel="Pending + Approved + Rejected + Archived" />
        <StatCard label="Pending Review" value={pending} variant="Pending" />
        <StatCard label="Approved" value={approved} variant="Approved" />
        <StatCard label="Rejected" value={rejected} variant="Rejected" />
        <StatCard label="Archived" value={archived} variant="Archived" />
        <StatCard label="Users" value={users} variant="Users" />
      </div>
    </div>
  );
}
