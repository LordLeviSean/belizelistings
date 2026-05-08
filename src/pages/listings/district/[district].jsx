import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import { fetchApprovedListingsWithImages } from "../../../lib/listingQueries";
import { filterListings } from "../../../utils/filterListings";
import useScrollMemory from "../../../hooks/useScrollMemory";
import useSavedSearches from "../../../hooks/useSavedSearches";
import { normalizeRouterQueryToFilters } from "../../../utils/savedSearchUtils";
import BackButton from "../../../components/BackButton";
import Breadcrumbs from "../../../components/Breadcrumbs";
import ListingCard from "../../../components/ListingCard";
import DistrictLayout from "../../../components/DistrictLayout";
import useFavorites from "../../../hooks/useFavorites";
import { useFavoriteSignupPrompt } from "../../../components/FavoriteSignupPromptProvider";
import styles from "../../../styles/District.module.css";

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
  const openFavoriteSignupPrompt = useFavoriteSignupPrompt();

  function handleFavoriteClick(listingId) {
    if (!isAuthenticated) {
      openFavoriteSignupPrompt();
      return;
    }
    void toggleFavorite(listingId);
  }
  const [listingsData, setListingsData] = useState([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [saveUiSaved, setSaveUiSaved] = useState(false);
  const [sortBy, setSortBy] = useState("newest");

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
      setLoadingListings(true);
      const { data } = await fetchApprovedListingsWithImages();
      if (!cancelled) {
        const normalizedListings = (data || []).map((l) => ({
          ...l,
          id: String(l.id ?? ""),
          images: Array.isArray(l.images) ? l.images : [],
        }));
        setListingsData(normalizedListings);
        setLoadingListings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [district]);

  const districtSlug = typeof district === "string" ? district : district?.[0] || "";

  const filteredBase = filterListings(listingsData, {
    district: districtSlug,
    status: status || "all",
  });
  const filtered = useMemo(() => {
    const rows = [...filteredBase];
    if (sortBy === "price-asc") {
      return rows.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }
    if (sortBy === "price-desc") {
      return rows.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    return rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [filteredBase, sortBy]);

  const districtLabel = formatDistrict(districtSlug);
  const featuredListing = filtered[0] || null;
  const remainingListings = filtered.slice(1);
  const nearbyDistricts = ["belize", "cayo", "stann-creek", "corozal", "orange-walk", "toledo"];
  const featuredLabels = ["🔥 Hot Listing", "💰 Best Value", "⭐ Recently Added"];
  const avgPriceLabel = useMemo(() => {
    const withPrice = filtered.filter((l) => Number.isFinite(Number(l.price)));
    if (!withPrice.length) return "Avg Price: N/A";
    const avg = withPrice.reduce((sum, l) => sum + Number(l.price), 0) / withPrice.length;
    return `Avg Price: ${Math.round(avg).toLocaleString()} BZD`;
  }, [filtered]);
  const typeMixLabel = useMemo(() => {
    const land = filtered.filter((l) => Number(l.beds) === 0 && Number(l.baths) === 0).length;
    const homes = Math.max(0, filtered.length - land);
    return `Type Mix: ${homes} homes / ${land} land`;
  }, [filtered]);
  const insightLine = useMemo(() => {
    if (filtered.length >= 8) return "↑ Prices trending up";
    if (filtered.length >= 4) return "High demand area";
    return "Market opportunities available";
  }, [filtered.length]);

  const handleSaveSearch = () => {
    const filters = normalizeRouterQueryToFilters(router.query);
    saveSearch(filters);
    setSaveUiSaved(true);
  };
  const getDistrictCount = (slug) =>
    listingsData.filter((l) => String(l.district || "").toLowerCase() === slug).length;

  if (!router.isReady || !district) return null;

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <Breadcrumbs />
        <BackButton label="Back to Browse" />

        <DistrictLayout
          districtLabel={districtLabel}
          filteredCount={filtered.length}
          saveUiSaved={saveUiSaved}
          onSaveSearch={handleSaveSearch}
          avgPriceLabel={avgPriceLabel}
          typeMixLabel={typeMixLabel}
          insightLine={insightLine}
          sortBy={sortBy}
          onSortChange={(event) => setSortBy(event.target.value)}
          status={status}
          onStatusChange={(type) =>
            updateQuery(router, districtSlug, {
              status: type === "all" ? undefined : type,
            })
          }
          featuredListing={featuredListing}
          featuredTag={featuredLabels[filtered.length % featuredLabels.length]}
          renderListings={() => (
            <div className={styles.listWrap}>
              {loadingListings ? (
                <div className={styles.list}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className={`${styles.listItem} skeleton`} style={{ height: 102 }} />
                  ))}
                </div>
              ) : (
                <div className={styles.list}>
                  {remainingListings.map((listing) => (
                    <div key={listing.id} className={styles.listItem}>
                      <ListingCard
                        listing={listing}
                        showFavoriteButton
                        isFavorited={isFavorite(listing.id)}
                        favoriteBusy={isBusy(listing.id)}
                        onToggleFavorite={handleFavoriteClick}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          nearbyDistricts={nearbyDistricts}
          getDistrictCount={getDistrictCount}
          formatDistrict={formatDistrict}
          onNavigateDistrict={(slug) => router.push(`/listings/district/${slug}`)}
          onBrowseAll={() => router.push("/")}
        />
      </div>
    </div>
  );
}
