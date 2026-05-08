import styles from "../styles/District.module.css";

export default function DistrictLayout({
  districtLabel,
  districtCaption,
  filteredCount,
  status,
  onStatusChange,
  searchTerm,
  onSearchTermChange,
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
  return (
    <>
      <section className={styles.districtTitleBlock}>
        <h1 className={styles.districtTitle}>{districtLabel}</h1>
        {districtCaption ? <p className={styles.districtCaption}>{districtCaption}</p> : null}
      </section>

      <section className={styles.filterBarShell}>
        <div className={styles.filterRowTop}>
          <div className={styles.filterSearchWrap}>
            <input
              className={styles.filterInput}
              type="search"
              placeholder={`Search listings in ${districtLabel}...`}
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              aria-label={`Search listings in ${districtLabel}`}
            />
          </div>
          <button type="button" className={styles.clearAllBtn} onClick={onResetFilters}>
            Clear All
          </button>
          <button type="button" className={styles.moreFiltersBtn} onClick={onToggleAdvancedFilters}>
            More Filters
          </button>
        </div>

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

        {showAdvancedFilters ? (
          <div className={styles.advancedFilterPanel}>
            {renderAdvancedFilters?.()}
            <button type="button" className={styles.resetFiltersBtn} onClick={onResetFilters}>
              Reset All
            </button>
          </div>
        ) : null}

        <div className={styles.filterBarBottom}>
          <div className={styles.resultCount}>{filteredCount} Results</div>
        </div>
      </section>

      {filteredCount === 0 ? (
        <div className={styles.empty}>
          <h3>No listings found in this district</h3>
          <p>Try adjusting filters or explore nearby areas</p>
          <button type="button" className={styles.emptyCta} onClick={onBrowseAll}>
            Browse All Listings
          </button>
        </div>
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
