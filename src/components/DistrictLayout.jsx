import { useState } from "react";
import { ChevronUp, SlidersHorizontal } from "lucide-react";
import { shouldShowFilterSummary } from "../lib/filterBarMobile";
import { formatDistrictInventorySummary } from "../lib/districtInventorySummary";
import styles from "../styles/District.module.css";
import PremiumEmptyState from "./ui/PremiumEmptyState";

export default function DistrictLayout({
  districtLabel,
  districtCaption,
  districtStats,
  filteredCount,
  totalInDistrict,
  hasActiveFilters = false,
  status,
  onStatusChange,
  propertyType,
  onPropertyTypeChange,
  priceBucket,
  onPriceBucketChange,
  bedrooms,
  onBedroomsChange,
  bathrooms,
  onBathroomsChange,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  onResetFilters,
  sortBy,
  onSortChange,
  renderListings,
  renderAdvancedFilters,
  onBrowseAll,
}) {
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const showFilterSummary = shouldShowFilterSummary(filtersExpanded);
  const inventorySummary = formatDistrictInventorySummary({
    filtered: filteredCount,
    total: totalInDistrict ?? filteredCount,
    hasActiveFilters,
  });
  const resultLabel = inventorySummary;

  return (
    <>
      <section className={styles.districtHeroBand} aria-label="District overview">
        <div className={styles.districtTitleBlock}>
          <h1 className={styles.districtTitle}>{districtLabel}</h1>
          {districtCaption ? <p className={styles.districtCaption}>{districtCaption}</p> : null}
        </div>
        <p className={styles.districtResultSummary} aria-live="polite">
          {inventorySummary}
        </p>
        {districtStats ? <p className={styles.districtStats}>{districtStats}</p> : null}
      </section>

      <section className={styles.filterBarShell}>
        <svg width="0" height="0" className={styles.filterGradientDefs} aria-hidden="true">
          <defs>
            <linearGradient id="blDistrictFilterCollapseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#89cdbd" />
              <stop offset="38%" stopColor="#89b7db" />
              <stop offset="68%" stopColor="#9fb3d9" />
              <stop offset="100%" stopColor="#d8c27b" />
            </linearGradient>
          </defs>
        </svg>

        {showFilterSummary ? (
          <div className={styles.filterSummary} role="region" aria-label="District filters summary">
            <p className={styles.filterSummaryResults}>{resultLabel}</p>
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
          className={`${styles.filterPanel} ${showFilterSummary ? styles.filterPanelHidden : ""}`}
          role="region"
          aria-label="District listing filters"
        >
          <button
            type="button"
            className={styles.collapseFiltersBtn}
            onClick={() => setFiltersExpanded(false)}
            aria-label="Hide filters"
          >
            <ChevronUp
              size={16}
              strokeWidth={2.5}
              stroke="url(#blDistrictFilterCollapseGradient)"
              aria-hidden="true"
            />
          </button>

          <div className={styles.filterRowGrid}>
            <div className={styles.filterSelectWrap}>
              <label className={styles.filterLabel} htmlFor="district-status-filter">
                Status
              </label>
              <select
                id="district-status-filter"
                className={styles.filterSelect}
                value={status || "all"}
                onChange={(event) => onStatusChange(event.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="for-sale">For Sale</option>
                <option value="rent">For Rent</option>
              </select>
            </div>

            <div className={styles.filterSelectWrap}>
              <label className={styles.filterLabel} htmlFor="district-type-filter">
                Type
              </label>
              <select
                id="district-type-filter"
                className={styles.filterSelect}
                value={propertyType}
                onChange={(event) => onPropertyTypeChange(event.target.value)}
              >
                <option value="all">All Types</option>
                <option value="house">House</option>
                <option value="condo">Condo</option>
                <option value="land">Land</option>
                <option value="apartment">Apartment</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            <div className={styles.filterSelectWrap}>
              <label className={styles.filterLabel} htmlFor="district-price-filter">
                Price
              </label>
              <select
                id="district-price-filter"
                className={styles.filterSelect}
                value={priceBucket}
                onChange={(event) => onPriceBucketChange(event.target.value)}
              >
                <option value="any">Any Price</option>
                <option value="0-100000">Up to 100,000</option>
                <option value="100000-300000">100,000 - 300,000</option>
                <option value="300000-700000">300,000 - 700,000</option>
                <option value="700000-999999999">700,000+</option>
              </select>
            </div>

            <div className={styles.filterSelectWrap}>
              <label className={styles.filterLabel} htmlFor="district-beds-filter">
                Bedrooms
              </label>
              <select
                id="district-beds-filter"
                className={styles.filterSelect}
                value={bedrooms}
                onChange={(event) => onBedroomsChange(event.target.value)}
              >
                <option value="any">Any</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
              </select>
            </div>

            <div className={styles.filterSelectWrap}>
              <label className={styles.filterLabel} htmlFor="district-baths-filter">
                Bathrooms
              </label>
              <select
                id="district-baths-filter"
                className={styles.filterSelect}
                value={bathrooms}
                onChange={(event) => onBathroomsChange(event.target.value)}
              >
                <option value="any">Any</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
              </select>
            </div>
            <div className={styles.filterSelectWrap}>
              <label className={styles.filterLabel} htmlFor="district-sort">
                Sort By
              </label>
              <select id="district-sort" className={styles.filterSelect} value={sortBy} onChange={onSortChange}>
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          <div className={styles.filterInventoryMeta}>
            <div className={styles.resultCount} aria-live="polite">
              <span className={styles.resultCountLabel}>{inventorySummary}</span>
            </div>
            <button
              type="button"
              className={styles.moreFiltersBtn}
              onClick={onToggleAdvancedFilters}
              aria-expanded={showAdvancedFilters}
              id="district-more-filters-trigger"
            >
              More Filters
            </button>
          </div>

          {!showFilterSummary && showAdvancedFilters ? (
            <div
              className={styles.advancedFilterPanel}
              id="district-advanced-filters"
              role="region"
              aria-labelledby="district-more-filters-trigger"
            >
              {renderAdvancedFilters?.()}
              <button type="button" className={styles.resetFiltersBtn} onClick={onResetFilters}>
                Reset All
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {filteredCount === 0 ? (
        <PremiumEmptyState
          variant="district"
          primary={{ label: "Browse all listings", onClick: onBrowseAll }}
        />
      ) : null}

      {renderListings()}

      {filteredCount > 0 ? (
        <section className={styles.inventoryEndCap} aria-label="Inventory continuation">
          <p>More verified inventory arriving soon.</p>
        </section>
      ) : null}
    </>
  );
}
