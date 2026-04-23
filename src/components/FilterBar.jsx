import styles from "./FilterBar.module.css";

const MIN_PRICE_OPTIONS = [
  { label: "Any Price", value: "" },
  { label: "500+", value: "500" },
  { label: "1,000+", value: "1000" },
  { label: "5,000+", value: "5000" },
  { label: "50,000+", value: "50000" },
  { label: "100,000+", value: "100000" },
  { label: "250,000+", value: "250000" },
];

const MAX_PRICE_OPTIONS = [
  { label: "Any max", value: "" },
  { label: "Under 100k", value: "100000" },
  { label: "Under 300k", value: "300000" },
  { label: "Under 500k", value: "500000" },
  { label: "Under 1M", value: "1000000" },
  { label: "Under 2M", value: "2000000" },
];

const BED_BATH_OPTIONS = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "2+", value: "2" },
  { label: "3+", value: "3" },
  { label: "4+", value: "4" },
  { label: "5+", value: "5" },
];

export default function FilterBar({
  listingType,
  setListingType,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  beds,
  setBeds,
  baths,
  setBaths,
}) {
  return (
    <div className={styles.filterBar} role="region" aria-label="Listing filters">
      <div className={styles.statusToggle} role="tablist" aria-label="Listing type">
        {[
          { label: "All", value: "all" },
          { label: "For Sale", value: "for-sale" },
          { label: "For Rent", value: "rent" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={listingType === option.value}
            className={`${styles.toggleButton} ${
              listingType === option.value ? styles.toggleButtonActive : ""
            }`}
            onClick={() => setListingType(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={styles.filterGroup}>
        <select value={minPrice} onChange={(e) => setMinPrice(e.target.value)}>
          {MIN_PRICE_OPTIONS.map((option) => (
            <option key={option.value || "min-any"} value={option.value}>
              Min: {option.label}
            </option>
          ))}
        </select>

        <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}>
          {MAX_PRICE_OPTIONS.map((option) => (
            <option key={option.value || "max-any"} value={option.value}>
              Max: {option.label}
            </option>
          ))}
        </select>

        <select value={beds} onChange={(e) => setBeds(e.target.value)}>
          {BED_BATH_OPTIONS.map((option) => (
            <option key={option.value || "bed-any"} value={option.value}>
              Beds: {option.label}
            </option>
          ))}
        </select>

        <select value={baths} onChange={(e) => setBaths(e.target.value)}>
          {BED_BATH_OPTIONS.map((option) => (
            <option key={option.value || "bath-any"} value={option.value}>
              Baths: {option.label}
            </option>
          ))}
        </select>
      </div>

      <button type="button" className={styles.moreFiltersButton}>
        <span aria-hidden="true">⚙</span>
        <span>More Filters</span>
      </button>
    </div>
  );
}
