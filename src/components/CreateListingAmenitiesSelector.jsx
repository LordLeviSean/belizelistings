import { useMemo } from "react";
import { orderedAmenityGroups, sanitizeAmenitiesArray } from "../constants/listingAmenities";
import styles from "./CreateListingAmenitiesSelector.module.css";

/**
 * Structured amenity chips for Create Listing (Step 2). Token motion + glass pills only — no MUI / system toggles.
 */
export default function CreateListingAmenitiesSelector({ value, onChange, landPrioritize = false }) {
  const selected = useMemo(() => new Set(Array.isArray(value) ? value : []), [value]);
  const groups = useMemo(() => orderedAmenityGroups(landPrioritize), [landPrioritize]);

  const toggle = (label) => {
    const next = new Set(selected);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onChange(sanitizeAmenitiesArray(Array.from(next)));
  };

  return (
    <div className={styles.wrap}>
      {groups.map((group) => (
        <fieldset key={group.id} className={styles.group}>
          <legend className={styles.groupLabel}>{group.label}</legend>
          <div className={styles.chipRow}>
            {group.items.map((label) => {
              const isOn = selected.has(label);
              return (
                <button
                  key={label}
                  type="button"
                  className={`${styles.chip} ${isOn ? styles.chipOn : ""}`}
                  aria-pressed={isOn}
                  onClick={() => toggle(label)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
