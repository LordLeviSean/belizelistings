import {
  LISTING_MARKET_FILTER_OPTIONS,
  normalizeListingMarketFilterValue,
} from "@/lib/listingMarketFilterOptions";
import styles from "./ListingMarketFilter.module.css";

/**
 * Canonical segmented market filter — shared by search FilterBar, homepage modal,
 * and public agent profile listing sections.
 */
export default function ListingMarketFilter({
  value = "all",
  onChange,
  ariaLabel = "Listing market filter",
  fullWidth = false,
  className = "",
}) {
  const normalizedValue = normalizeListingMarketFilterValue(value);

  return (
    <div
      className={`${styles.track} ${fullWidth ? styles.fullWidth : ""} ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {LISTING_MARKET_FILTER_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={normalizedValue === option.value}
          className={`${styles.button} ${
            normalizedValue === option.value ? styles.buttonActive : ""
          }`}
          onClick={() => onChange?.(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
