import opStyles from "./OperationalIntel.module.css";

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString();
}

export default function ListingPerformanceStrip({ performance }) {
  if (!performance) return null;
  const { views, favorites, inquiries, lastUpdatedLabel, freshnessPulse } = performance;
  const pulseClass =
    freshnessPulse === "high"
      ? opStyles.pulseHigh
      : freshnessPulse === "steady"
        ? opStyles.pulseSteady
        : opStyles.pulseQuiet;

  return (
    <div className={opStyles.performanceStrip} aria-label="Listing signals">
      <span>
        Views <strong>{fmt(views)}</strong>
      </span>
      <span>
        Saves <strong>{fmt(favorites)}</strong>
      </span>
      <span>
        Inquiries <strong>{fmt(inquiries)}</strong>
      </span>
      <span className={pulseClass}>{lastUpdatedLabel || "—"}</span>
    </div>
  );
}
