import { getRelativeTimeLabel } from "../utils/trustSignals";
import styles from "./AgentOperationalStrip.module.css";

export default function AgentOperationalStrip({ snapshot }) {
  if (!snapshot) return null;

  const chips = [];
  if (snapshot.hasVerifiedIdentity) chips.push({ label: "Verified", tone: "verified" });
  if (snapshot.lifecycleCounts?.active > 0) {
    chips.push({ label: `${snapshot.lifecycleCounts.active} Active`, tone: "" });
  }
  if (snapshot.lifecycleCounts?.closed > 0) {
    chips.push({ label: `${snapshot.lifecycleCounts.closed} Closed`, tone: "tx" });
  }
  if (snapshot.verifiedClosings > 0) {
    chips.push({ label: `${snapshot.verifiedClosings} Verified Closings`, tone: "verified" });
  }
  if (snapshot.recentlyActive && snapshot.lastActivityAt) {
    chips.push({ label: `Recently Active (${getRelativeTimeLabel(snapshot.lastActivityAt)})`, tone: "fresh" });
  }
  if (snapshot.lifecycleCounts?.pending > 0) {
    chips.push({ label: `${snapshot.lifecycleCounts.pending} Pending Review`, tone: "pending" });
  }
  if (snapshot.freshnessConsistency >= 0.65 && snapshot.lifecycleCounts?.active > 0) {
    chips.push({ label: "Fresh Inventory", tone: "fresh" });
  }
  if (snapshot.brokerageAffiliated) {
    chips.push({ label: "Brokerage Affiliated", tone: "" });
  }

  return (
    <div className={styles.strip}>
      {chips.slice(0, 4).map((chip) => (
        <span key={chip.label} className={`${styles.chip} ${chip.tone ? styles[chip.tone] : ""}`}>
          {chip.label}
        </span>
      ))}
    </div>
  );
}
