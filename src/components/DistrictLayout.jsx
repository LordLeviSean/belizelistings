import Link from "next/link";
import styles from "../styles/District.module.css";

export default function DistrictLayout({
  districtLabel,
  filteredCount,
  saveUiSaved,
  onSaveSearch,
  avgPriceLabel,
  typeMixLabel,
  insightLine,
  sortBy,
  onSortChange,
  status,
  onStatusChange,
  featuredListing,
  featuredTag,
  renderListings,
  nearbyDistricts,
  getDistrictCount,
  formatDistrict,
  onNavigateDistrict,
  onBrowseAll,
}) {
  return (
    <>
      <div className={styles.hero}>
        <div className={styles.header}>
          <div>
            <h1>{districtLabel} District</h1>
            <p>{filteredCount} properties available</p>
          </div>
          <button
            type="button"
            disabled={saveUiSaved}
            className={`${styles.saveSearchBtn} ${saveUiSaved ? styles.saveSearchBtnSaved : ""}`}
            onClick={onSaveSearch}
          >
            {saveUiSaved ? "Search saved" : "Save Search"}
          </button>
        </div>
        <div className={styles.quickStats}>
          <span className={styles.statPill}>{avgPriceLabel}</span>
          <span className={styles.statPill}>Listings: {filteredCount}</span>
          <span className={styles.statPill}>{typeMixLabel}</span>
          <span className={styles.statPill}>{insightLine}</span>
        </div>
        <div className={styles.sortRow}>
          <label className={styles.sortLabel} htmlFor="district-sort">
            Sort
          </label>
          <select id="district-sort" className={styles.sortSelect} value={sortBy} onChange={onSortChange}>
            <option value="newest">Newest</option>
            <option value="price-asc">Price Low to High</option>
            <option value="price-desc">Price High to Low</option>
          </select>
        </div>
        <div className={styles.miniMapPreview}>
          <div className={styles.miniMapGlow} />
          <p>Area Snapshot</p>
          <strong>{districtLabel} District</strong>
          <span className={styles.miniMapTrend}>Demand is active in this area</span>
        </div>
      </div>

      <div className={styles.status}>
        {["all", "for-sale", "rent"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onStatusChange(type)}
            className={`${styles.statusBtn} ${(status || "all") === type ? styles.active : ""}`}
          >
            {type === "all" ? "All" : type === "for-sale" ? "For Sale" : "For Rent"}
          </button>
        ))}
      </div>

      {filteredCount === 0 ? (
        <div className={styles.empty}>
          <h3>No listings found in this district</h3>
          <p>Try adjusting filters or explore nearby areas</p>
          <button type="button" className={styles.emptyCta} onClick={onBrowseAll}>
            Browse All Listings
          </button>
        </div>
      ) : null}

      {featuredListing ? (
        <div className={styles.featuredWrap}>
          <Link href={`/listing/${featuredListing.id}`} className={styles.featuredCard}>
            <span className={styles.featuredLabel}>{featuredTag}</span>
            <div className={styles.featuredInner}>
              <div className={styles.featuredImage}>
                <img
                  src={featuredListing.images?.[0]?.image_url || "/placeholder.jpg"}
                  alt={featuredListing.title || "Featured listing"}
                />
              </div>
              <div className={styles.featuredInfo}>
                <h3>{featuredListing.title || "Untitled listing"}</h3>
                <p className={styles.featuredPrice}>
                  {Number(featuredListing.price || 0).toLocaleString()} {featuredListing.currency || "BZD"}
                </p>
                <p className={styles.featuredMeta}>
                  {featuredListing.beds || 0} bd · {featuredListing.baths || 0} ba · {districtLabel}
                </p>
              </div>
            </div>
          </Link>
        </div>
      ) : null}

      {renderListings()}

      <div className={styles.nearbyWrap}>
        <h3>Explore Nearby Districts</h3>
        <div className={styles.nearbyPills}>
          {nearbyDistricts.map((slug) => {
            const label = formatDistrict(slug);
            const count = getDistrictCount(slug);
            return (
              <button key={slug} type="button" className={styles.statPill} onClick={() => onNavigateDistrict(slug)}>
                {label} ({count})
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
