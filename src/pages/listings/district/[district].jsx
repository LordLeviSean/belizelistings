import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { fetchApprovedListingsWithImages } from "../../../lib/listingQueries";
import { filterListings } from "../../../utils/filterListings";
import useScrollMemory from "../../../hooks/useScrollMemory";
import useSavedSearches from "../../../hooks/useSavedSearches";
import { cleanQuery } from "../../../utils/queryStringify";
import { normalizeRouterQueryToFilters } from "../../../utils/savedSearchUtils";
import ListingCard from "../../../components/ListingCard";
import useFavorites from "../../../hooks/useFavorites";
import styles from "../../../styles/District.module.css";
import backStyles from "../../../styles/BackNav.module.css";

function qv(v) {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

const formatDistrict = (district) =>
  district
    ?.split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const updateQuery = (router, district, updates) => {
  const next = { ...router.query, ...updates };
  Object.keys(next).forEach((k) => {
    if (next[k] === "" || next[k] == null) delete next[k];
  });
  router.replace(
    {
      pathname: `/listings/district/${district}`,
      query: next,
    },
    undefined,
    { shallow: true, scroll: false }
  );
};

export default function DistrictListings() {
  const router = useRouter();
  const { district, status } = router.query;
  const { saveSearch } = useSavedSearches();
  const { isFavorite, isBusy, toggleFavorite, isAuthenticated } = useFavorites();
  const [listingsData, setListingsData] = useState([]);
  const [saveUiSaved, setSaveUiSaved] = useState(false);

  const districtSlugForScroll =
    typeof district === "string" ? district : Array.isArray(district) ? district[0] : "";

  useScrollMemory({
    mode: "district",
    router,
    districtSlug: districtSlugForScroll,
  });

  useEffect(() => {
    if (!saveUiSaved) return;
    const t = window.setTimeout(() => setSaveUiSaved(false), 2000);
    return () => window.clearTimeout(t);
  }, [saveUiSaved]);

  useEffect(() => {
    if (!district) return;
    let cancelled = false;
    (async () => {
      const { data } = await fetchApprovedListingsWithImages();
      if (!cancelled) setListingsData(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [district]);

  if (!router.isReady || !district) return null;

  const districtSlug = typeof district === "string" ? district : district[0];

  const filtered = filterListings(listingsData, {
    district: districtSlug,
    status: status || "all",
  });

  const districtLabel = formatDistrict(districtSlug);

  const handleBackToHome = () => {
    const s = qv(router.query.status);
    router.push({
      pathname: "/",
      query: cleanQuery({
        status: s && s !== "all" ? s : undefined,
        minPrice: qv(router.query.minPrice) || undefined,
        maxPrice: qv(router.query.maxPrice) || undefined,
        beds: qv(router.query.beds) || undefined,
        baths: qv(router.query.baths) || undefined,
      }),
    });
  };

  const handleSaveSearch = () => {
    const filters = normalizeRouterQueryToFilters(router.query);
    saveSearch(filters);
    setSaveUiSaved(true);
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <button type="button" className={backStyles.backSubtle} onClick={handleBackToHome}>
          ← Back to Browse
        </button>

        <div className={styles.header}>
          <h1>{districtLabel} District</h1>
          <p>{filtered.length} properties available</p>
        </div>

        <div className={styles.saveSearchRow}>
          <button
            type="button"
            disabled={saveUiSaved}
            className={`${styles.saveSearchBtn} ${saveUiSaved ? styles.saveSearchBtnSaved : ""}`}
            onClick={handleSaveSearch}
          >
            {saveUiSaved
              ? "Search saved — you'll be notified of new listings"
              : "Save Search"}
          </button>
        </div>

        <div className={styles.status}>
          {["all", "for-sale", "rent"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() =>
                updateQuery(router, districtSlug, {
                  status: type === "all" ? undefined : type,
                })
              }
              className={`${styles.statusBtn} ${(status || "all") === type ? styles.active : ""}`}
            >
              {type === "all"
                ? "All"
                : type === "for-sale"
                  ? "For Sale"
                  : "For Rent"}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className={styles.empty}>
            <h3>No listings found</h3>
            <p>Try adjusting your filters</p>
          </div>
        )}

        <div className={styles.listWrap}>
          <div className={styles.list}>
            {filtered.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                showFavoriteButton={isAuthenticated}
                isFavorited={isFavorite(listing.id)}
                favoriteBusy={isBusy(listing.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
