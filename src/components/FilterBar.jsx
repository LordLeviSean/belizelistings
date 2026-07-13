import { useId, useState } from "react";
import GeographyDiscoveryFilters from "./geography/GeographyDiscoveryFilters";
import { ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";
import {
  PROPERTY_TYPE_OPTIONS,
  SEARCH_SORT_OPTIONS,
} from "../lib/searchFilters";
import { shouldShowFilterSummary } from "../lib/filterBarMobile";
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
  query = "",
  onQueryChange,
  onSearchSubmit,
  searchInputRef,
  listingType = "all",
  onListingTypeChange,
  minPrice = "",
  onMinPriceChange,
  maxPrice = "",
  onMaxPriceChange,
  beds = "",
  onBedsChange,
  baths = "",
  onBathsChange,
  sortBy = "newest",
  onSortChange,
  propertyType = "",
  onPropertyTypeChange,
  verifiedOnly = false,
  onVerifiedOnlyChange,
  showAdvanced = false,
  onToggleAdvanced,
  onResetFilters,
  resultCount,
  activeChips = [],
  onRemoveChip,
  geographyFilters,
  onGeographyFiltersChange,
}) {
  const advancedPanelId = useId();
  const marketValue = listingType === "for-sale" ? "for-sale" : listingType;
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const showFilterSummary = shouldShowFilterSummary(filtersExpanded);

  const resultLabel =
    typeof resultCount === "number"
      ? `${resultCount} ${resultCount === 1 ? "Result" : "Results"}`
      : null;

  return (
    <div className={styles.filterShell}>
      <svg width="0" height="0" className={styles.filterGradientDefs} aria-hidden="true">
        <defs>
          <linearGradient id="blFilterCollapseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#89cdbd" />
            <stop offset="38%" stopColor="#89b7db" />
            <stop offset="68%" stopColor="#9fb3d9" />
            <stop offset="100%" stopColor="#d8c27b" />
          </linearGradient>
        </defs>
      </svg>

      {showFilterSummary ? (
        <div className={styles.filterSummary} role="region" aria-label="Listing filters summary">
          {resultLabel ? (
            <p className={styles.filterSummaryResults}>{resultLabel}</p>
          ) : (
            <span className={styles.filterSummaryResults} aria-hidden="true" />
          )}
          <button
            type="button"
            className={styles.showFiltersBtn}
            aria-expanded={filtersExpanded}
            onClick={() => setFiltersExpanded(true)}
          >
            <SlidersHorizontal size={15} strokeWidth={2} aria-hidden="true" />
            Show Filters
          </button>
        </div>
      ) : null}

      <div
        className={`${styles.filterBar} ${showFilterSummary ? styles.filterBarHidden : ""}`}
        role="region"
        aria-label="Listing filters"
      >
        <button
          type="button"
          className={styles.collapseFiltersBtn}
          onClick={() => setFiltersExpanded(false)}
          aria-label="Hide filters"
        >
          <ChevronUp size={16} strokeWidth={2.5} stroke="url(#blFilterCollapseGradient)" aria-hidden="true" />
        </button>

        <form className={styles.searchGroup} onSubmit={onSearchSubmit}>
          <label className={styles.searchInputWrap} htmlFor="search-filter-query">
            <span className={styles.searchIcon} aria-hidden="true">
              <Search size={16} strokeWidth={2} />
            </span>
            <input
              id="search-filter-query"
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => onQueryChange?.(event.target.value)}
              placeholder="District, type, or keywords…"
              aria-label="Search listings; press Enter to apply"
              enterKeyHint="search"
            />
          </label>
        </form>

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
              aria-selected={marketValue === option.value}
              className={`${styles.toggleButton} ${
                marketValue === option.value ? styles.toggleButtonActive : ""
              }`}
              onClick={() => onListingTypeChange?.(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className={styles.filterGroup}>
          <select
            aria-label="Minimum price"
            value={minPrice}
            onChange={(event) => onMinPriceChange?.(event.target.value)}
          >
            {MIN_PRICE_OPTIONS.map((option) => (
              <option key={option.value || "min-any"} value={option.value}>
                Min: {option.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Maximum price"
            value={maxPrice}
            onChange={(event) => onMaxPriceChange?.(event.target.value)}
          >
            {MAX_PRICE_OPTIONS.map((option) => (
              <option key={option.value || "max-any"} value={option.value}>
                Max: {option.label}
              </option>
            ))}
          </select>

          <select aria-label="Minimum bedrooms" value={beds} onChange={(event) => onBedsChange?.(event.target.value)}>
            {BED_BATH_OPTIONS.map((option) => (
              <option key={option.value || "bed-any"} value={option.value}>
                Beds: {option.label}
              </option>
            ))}
          </select>

          <select aria-label="Minimum bathrooms" value={baths} onChange={(event) => onBathsChange?.(event.target.value)}>
            {BED_BATH_OPTIONS.map((option) => (
              <option key={option.value || "bath-any"} value={option.value}>
                Baths: {option.label}
              </option>
            ))}
          </select>

          <select aria-label="Sort results" value={sortBy} onChange={(event) => onSortChange?.(event.target.value)}>
            {SEARCH_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Sort: {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className={styles.moreFiltersButton}
          aria-expanded={showAdvanced}
          aria-controls={advancedPanelId}
          onClick={onToggleAdvanced}
        >
          <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
          <span>More Filters</span>
        </button>

        {onResetFilters ? (
          <button type="button" className={styles.resetButton} onClick={onResetFilters}>
            Reset Filters
          </button>
        ) : null}
      </div>

      {!showFilterSummary && showAdvanced ? (
        <div className={styles.advancedPanel} id={advancedPanelId} role="region" aria-label="Advanced filters">
          <GeographyDiscoveryFilters
            value={geographyFilters || {}}
            onChange={onGeographyFiltersChange}
          />
          <label className={styles.advancedField}>
            <span className={styles.advancedLabel}>Property type</span>
            <select value={propertyType} onChange={(event) => onPropertyTypeChange?.(event.target.value)}>
              {PROPERTY_TYPE_OPTIONS.map((option) => (
                <option key={option.value || "type-all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.advancedCheck}>
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(event) => onVerifiedOnlyChange?.(event.target.checked)}
            />
            <span>Verified listings only</span>
          </label>
        </div>
      ) : null}

      {!showFilterSummary && typeof resultCount === "number" ? (
        <p className={styles.resultMeta} aria-live="polite">
          <span className={styles.resultCount}>{resultCount}</span>
          {resultCount === 1 ? " result" : " results"}
        </p>
      ) : null}

      {!showFilterSummary && activeChips.length > 0 ? (
        <div className={styles.chipRow} aria-label="Active filters">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={styles.chip}
              onClick={() => onRemoveChip?.(chip.key)}
              aria-label={`Remove filter: ${chip.label}`}
            >
              <span>{chip.label}</span>
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
