import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/router";
import { X } from "lucide-react";
import GeographyDiscoveryFilters from "./geography/GeographyDiscoveryFilters";
import { buildSearchRouterQuery } from "../lib/searchFilters";
import styles from "./HomeAdvancedFiltersModal.module.css";

const MARKET_OPTIONS = [
  { label: "All", value: "all" },
  { label: "For Sale", value: "sale" },
  { label: "For Rent", value: "rent" },
];

export default function HomeAdvancedFiltersModal({ isOpen, onClose }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [geography, setGeography] = useState({
    mapRegion: "",
    district: "",
    communityId: "",
    localityId: "",
  });
  const [market, setMarket] = useState("all");

  const handleApply = useCallback(() => {
    const qs = buildSearchRouterQuery({
      q: keyword.trim(),
      district: geography.district || geography.mapRegion,
      subregion: "",
      mapRegion: geography.mapRegion,
      communityId: geography.communityId,
      localityId: geography.localityId,
      market,
      minPrice: "",
      maxPrice: "",
      beds: "",
      baths: "",
      propertyType: "",
      verifiedOnly: false,
      sort: "newest",
    });
    const queryString = new URLSearchParams(qs).toString();
    void router.push(queryString ? `/search?${queryString}` : "/search");
    onClose();
  }, [router, keyword, geography, market, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const prevOverscroll = document.body.style.overscrollBehavior;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      document.body.style.overscrollBehavior = prevOverscroll;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-advanced-filters-title"
      >
        <div className={styles.dialogHeader}>
          <h2 id="home-advanced-filters-title" className={styles.dialogTitle}>
            Refine listings
          </h2>
          <button type="button" className={styles.iconClose} onClick={onClose} aria-label="Close">
            <X strokeWidth={1.85} size={18} />
          </button>
        </div>
        <p className={styles.dialogHint}>
          Filter by district, community, and locality. Keywords combine with text search.
        </p>
        <label className={styles.field}>
          <span className={styles.label}>Keywords</span>
          <input
            type="text"
            className={styles.input}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Neighborhood, type, waterfront…"
          />
        </label>
        <GeographyDiscoveryFilters value={geography} onChange={setGeography} />
        <fieldset className={styles.field}>
          <legend className={styles.label}>Market</legend>
          <div className={styles.segmentedControl} role="tablist" aria-label="Market type">
            {MARKET_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={market === option.value}
                className={`${styles.segmentBtn} ${market === option.value ? styles.segmentBtnActive : ""}`}
                onClick={() => setMarket(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleApply}>
            View results
          </button>
        </div>
      </div>
    </div>
  );
}
