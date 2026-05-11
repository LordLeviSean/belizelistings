import opStyles from "./OperationalIntel.module.css";

export default function OperationalWarningChips({ warnings = [], max = 4 }) {
  const slice = warnings.slice(0, max);
  if (!slice.length) return null;
  return (
    <div className={opStyles.warningRow}>
      {slice.map((w) => (
        <span
          key={w.code}
          className={`${opStyles.warningChip} ${
            w.severity === "critical" ? opStyles.warningChipCritical : opStyles.warningChipAttention
          }`}
        >
          {w.label}
        </span>
      ))}
    </div>
  );
}
