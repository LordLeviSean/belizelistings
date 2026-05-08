import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/router";
import { X } from "lucide-react";
import { getSelectableRegions } from "../constants/geographyLayer";
import styles from "./HomeAdvancedFiltersModal.module.css";

const DISTRICT_ENTRIES = getSelectableRegions();

export default function HomeAdvancedFiltersModal({ isOpen, onClose }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [districtSlug, setDistrictSlug] = useState("");
  const [market, setMarket] = useState("all");

  const handleApply = useCallback(() => {
    const params = new URLSearchParams();
    const q = keyword.trim();
    if (q) params.set("q", q);
    if (districtSlug) params.set("district", districtSlug);
    if (market && market !== "all") params.set("market", market);
    const qs = params.toString();
    void router.push(qs ? `/search?${qs}` : "/search");
    onClose();
  }, [router, keyword, districtSlug, market, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="presentation">
      <button type="button" className={styles.backdrop} aria-label="Close filters" onClick={onClose} />
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
        <p className={styles.dialogHint}>Filter by geography and market intent. Keywords combine with text search.</p>
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
        <label className={styles.field}>
          <span className={styles.label}>Region</span>
          <select
            className={styles.select}
            value={districtSlug}
            onChange={(e) => setDistrictSlug(e.target.value)}
          >
            <option value="">All regions</option>
            {DISTRICT_ENTRIES.map((region) => (
              <option key={region.id} value={region.slug}>
                {region.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className={styles.field}>
          <legend className={styles.label}>Market</legend>
          <div className={styles.radioRow}>
            <label className={styles.radio}>
              <input
                type="radio"
                name="market-home"
                checked={market === "all"}
                onChange={() => setMarket("all")}
              />{" "}
              All
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name="market-home"
                checked={market === "sale"}
                onChange={() => setMarket("sale")}
              />{" "}
              For sale
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name="market-home"
                checked={market === "rent"}
                onChange={() => setMarket("rent")}
              />{" "}
              For rent
            </label>
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
