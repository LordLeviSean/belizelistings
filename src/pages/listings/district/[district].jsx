import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import { fetchApprovedListingsWithImages } from "../../../lib/listingQueries";
import { filterListings } from "../../../utils/filterListings";
import useScrollMemory from "../../../hooks/useScrollMemory";
import BackButton from "../../../components/BackButton";
import DistrictLayout from "../../../components/DistrictLayout";
import useFavorites from "../../../hooks/useFavorites";
import { useFavoriteSignupPrompt } from "../../../components/FavoriteSignupPromptProvider";
import HomePropertyCard from "../../../components/HomePropertyCard";
import SiteNav from "../../../components/SiteNav";
import {
  getRegionCaption,
  getRegionByAny,
  getRegionLabel,
  isChildRegion,
  normalizeRegionSlug,
} from "../../../constants/geographyLayer";
import { getListingRegionSlug } from "../../../utils/canonicalListing";
import styles from "../../../styles/District.module.css";

const formatDistrict = (district) => getRegionLabel(district);

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
  const { district, status, subregion } = router.query;
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
  const [sortBy, setSortBy] = useState("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [propertyType, setPropertyType] = useState("all");
  const [priceBucket, setPriceBucket] = useState("any");
  const [bedrooms, setBedrooms] = useState("any");
  const [bathrooms, setBathrooms] = useState("any");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [featureFilter, setFeatureFilter] = useState("any");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [amenities, setAmenities] = useState("any");
  const [furnishing, setFurnishing] = useState("any");
  const [landSize, setLandSize] = useState("any");
  const [interiorSize, setInteriorSize] = useState("any");
  const [yearBuilt, setYearBuilt] = useState("any");
  const [parking, setParking] = useState("any");
  const [viewType, setViewType] = useState("any");
  const [lotWidth, setLotWidth] = useState("any");
  const [lotDepth, setLotDepth] = useState("any");
  const [agentOrAgency, setAgentOrAgency] = useState("");
  const [listingId, setListingId] = useState("");

  const districtSlugForScroll =
    typeof district === "string" ? district : Array.isArray(district) ? district[0] : "";

  useScrollMemory({
    mode: "district",
    router,
    districtSlug: districtSlugForScroll,
  });

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
  const subregionSlug = typeof subregion === "string" ? subregion : subregion?.[0] || "";
  const normalizedDistrictSlug = normalizeRegionSlug(districtSlug);
  const normalizedSubregionSlug = normalizeRegionSlug(subregionSlug);
  const validSubregionFilter =
    normalizedSubregionSlug &&
    getRegionByAny(normalizedSubregionSlug) &&
    isChildRegion(normalizedSubregionSlug, normalizedDistrictSlug)
      ? normalizedSubregionSlug
      : "";

  const listingMatchesRouteRegion = (listing) => {
    const listingSlug = normalizeRegionSlug(getListingRegionSlug(listing));
    const routeSlug = normalizedDistrictSlug;
    const subSlug = validSubregionFilter;
    if (!listingSlug || !routeSlug) return false;
    if (subSlug) return listingSlug === subSlug;
    if (listingSlug === routeSlug) return true;
    return isChildRegion(listingSlug, routeSlug);
  };

  const filteredByDistrictAndStatus = filterListings(listingsData, {
    status: status || "all",
  }).filter((listing) => listingMatchesRouteRegion(listing));

  const filteredBase = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const [minPrice, maxPrice] =
      priceBucket === "any"
        ? [0, Number.POSITIVE_INFINITY]
        : priceBucket.split("-").map((value) => Number(value || 0));
    const minBeds = bedrooms === "any" ? 0 : Number(bedrooms || 0);
    const minBaths = bathrooms === "any" ? 0 : Number(bathrooms || 0);

    return filteredByDistrictAndStatus.filter((listing) => {
      const price = Number(listing?.price || 0);
      const beds = Number(listing?.beds || 0);
      const baths = Number(listing?.baths || 0);
      const typeValue = String(
        listing?.property_type || listing?.listing_type || listing?.type || ""
      ).toLowerCase();
      const titleValue = String(listing?.title || "").toLowerCase();
      const districtValue = String(getListingRegionSlug(listing) || "").toLowerCase();
      const featureText = String(
        listing?.features || listing?.amenities || listing?.description || ""
      ).toLowerCase();
      const furnishedText = String(listing?.furnishing || listing?.furnished || "").toLowerCase();
      const viewText = String(listing?.view || "").toLowerCase();
      const parkingText = String(listing?.parking || "").toLowerCase();
      const agentText = String(
        `${listing?.agent_name || ""} ${listing?.agency_name || ""} ${listing?.agent || ""}`
      ).toLowerCase();
      const idText = String(listing?.id || "").toLowerCase();
      const year = Number(listing?.year_built || listing?.yearBuilt || 0);
      const lotWidthValue = Number(listing?.lot_width || 0);
      const lotDepthValue = Number(listing?.lot_depth || 0);
      const landSizeValue = Number(listing?.land_size || 0);
      const interiorSizeValue = Number(listing?.interior_size || 0);
      const haystack = `${titleValue} ${districtValue} ${typeValue}`.trim();

      if (q && !haystack.includes(q)) return false;
      if (propertyType !== "all" && !typeValue.includes(propertyType)) return false;
      if (price < minPrice || price > maxPrice) return false;
      if (beds < minBeds) return false;
      if (baths < minBaths) return false;
      if (verifiedOnly && !listing?.verified && !listing?.is_verified) return false;
      if (featureFilter !== "any" && !featureText.includes(featureFilter)) return false;
      if (amenities !== "any" && !featureText.includes(amenities)) return false;
      if (furnishing !== "any" && !furnishedText.includes(furnishing)) return false;
      if (parking !== "any" && !parkingText.includes(parking)) return false;
      if (viewType !== "any" && !viewText.includes(viewType)) return false;
      if (agentOrAgency.trim() && !agentText.includes(agentOrAgency.trim().toLowerCase())) return false;
      if (listingId.trim() && !idText.includes(listingId.trim().toLowerCase())) return false;
      if (yearBuilt === "new" && year < 2018) return false;
      if (yearBuilt === "mid" && (year < 2000 || year >= 2018)) return false;
      if (yearBuilt === "classic" && year >= 2000) return false;
      if (landSize === "small" && landSizeValue >= 5000) return false;
      if (landSize === "medium" && (landSizeValue < 5000 || landSizeValue > 15000)) return false;
      if (landSize === "large" && landSizeValue <= 15000) return false;
      if (interiorSize === "compact" && interiorSizeValue >= 1200) return false;
      if (interiorSize === "spacious" && (interiorSizeValue < 1200 || interiorSizeValue > 2600))
        return false;
      if (interiorSize === "estate" && interiorSizeValue <= 2600) return false;
      if (lotWidth === "narrow" && lotWidthValue >= 40) return false;
      if (lotWidth === "standard" && (lotWidthValue < 40 || lotWidthValue > 90)) return false;
      if (lotWidth === "wide" && lotWidthValue <= 90) return false;
      if (lotDepth === "shallow" && lotDepthValue >= 80) return false;
      if (lotDepth === "standard" && (lotDepthValue < 80 || lotDepthValue > 140)) return false;
      if (lotDepth === "deep" && lotDepthValue <= 140) return false;
      return true;
    });
  }, [
    agentOrAgency,
    bathrooms,
    bedrooms,
    featureFilter,
    amenities,
    furnishing,
    filteredByDistrictAndStatus,
    interiorSize,
    landSize,
    listingId,
    lotDepth,
    lotWidth,
    parking,
    priceBucket,
    propertyType,
    searchTerm,
    viewType,
    verifiedOnly,
    yearBuilt,
  ]);
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

  const activeRegionForHeader = validSubregionFilter || normalizedDistrictSlug;
  const districtLabel = formatDistrict(activeRegionForHeader);
  const districtCaption = getRegionCaption(activeRegionForHeader);
  const remainingListings = filtered;

  if (!router.isReady || !district) return null;

  return (
    <div className={styles.page}>
      <SiteNav active="browse" />
      <div className={styles.wrapper}>
        <BackButton label="Back" className={styles.backButton} />

        <DistrictLayout
          districtLabel={districtLabel}
          districtCaption={districtCaption}
          filteredCount={filtered.length}
          sortBy={sortBy}
          onSortChange={(event) => setSortBy(event.target.value)}
          status={status}
          onStatusChange={(nextStatus) =>
            updateQuery(router, districtSlug, {
              status: nextStatus === "all" ? undefined : nextStatus,
            })
          }
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          propertyType={propertyType}
          onPropertyTypeChange={setPropertyType}
          priceBucket={priceBucket}
          onPriceBucketChange={setPriceBucket}
          bedrooms={bedrooms}
          onBedroomsChange={setBedrooms}
          bathrooms={bathrooms}
          onBathroomsChange={setBathrooms}
          showAdvancedFilters={showAdvancedFilters}
          onToggleAdvancedFilters={() => setShowAdvancedFilters((prev) => !prev)}
          onResetFilters={() => {
            setSearchTerm("");
            setPropertyType("all");
            setPriceBucket("any");
            setBedrooms("any");
            setBathrooms("any");
            setFeatureFilter("any");
            setAmenities("any");
            setFurnishing("any");
            setLandSize("any");
            setInteriorSize("any");
            setYearBuilt("any");
            setParking("any");
            setViewType("any");
            setLotWidth("any");
            setLotDepth("any");
            setAgentOrAgency("");
            setListingId("");
            setVerifiedOnly(false);
            setShowAdvancedFilters(false);
          }}
          renderAdvancedFilters={() => (
            <div className={styles.advancedFiltersGrid}>
              <label className={styles.advancedFilterItem}>
                <span>Amenities</span>
                <select value={amenities} onChange={(event) => setAmenities(event.target.value)}>
                  <option value="any">Any</option>
                  <option value="gym">Gym</option>
                  <option value="security">Security</option>
                  <option value="dock">Dock</option>
                  <option value="garden">Garden</option>
                </select>
              </label>
              <label className={styles.advancedFilterItem}>
                <span>View</span>
                <select value={viewType} onChange={(event) => setViewType(event.target.value)}>
                  <option value="any">Any</option>
                  <option value="sea">Sea</option>
                  <option value="lagoon">Lagoon</option>
                  <option value="mountain">Mountain</option>
                </select>
              </label>
              <label className={styles.advancedFilterItem}>
                <span>Furnishing</span>
                <select value={furnishing} onChange={(event) => setFurnishing(event.target.value)}>
                  <option value="any">Any</option>
                  <option value="furnished">Furnished</option>
                  <option value="semi">Semi-furnished</option>
                  <option value="unfurnished">Unfurnished</option>
                </select>
              </label>
              <label className={styles.advancedFilterItem}>
                <span>Land Size</span>
                <select value={landSize} onChange={(event) => setLandSize(event.target.value)}>
                  <option value="any">Any</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>
              <label className={styles.advancedFilterItem}>
                <span>Interior Size</span>
                <select value={interiorSize} onChange={(event) => setInteriorSize(event.target.value)}>
                  <option value="any">Any</option>
                  <option value="compact">Compact</option>
                  <option value="spacious">Spacious</option>
                  <option value="estate">Estate</option>
                </select>
              </label>
              <label className={styles.advancedFilterItem}>
                <span>Year Built</span>
                <select value={yearBuilt} onChange={(event) => setYearBuilt(event.target.value)}>
                  <option value="any">Any</option>
                  <option value="new">2018+</option>
                  <option value="mid">2000-2017</option>
                  <option value="classic">Pre-2000</option>
                </select>
              </label>
              <label className={styles.advancedFilterItem}>
                <span>Parking</span>
                <select value={parking} onChange={(event) => setParking(event.target.value)}>
                  <option value="any">Any</option>
                  <option value="garage">Garage</option>
                  <option value="carport">Carport</option>
                  <option value="street">Street</option>
                </select>
              </label>
              <label className={styles.advancedFilterItem}>
                <span>Waterfront</span>
                <select value={featureFilter} onChange={(event) => setFeatureFilter(event.target.value)}>
                  <option value="any">Any</option>
                  <option value="waterfront">Yes</option>
                  <option value="non-waterfront">No</option>
                </select>
              </label>
              <label className={styles.advancedFilterItem}>
                <span>Agent / Agency</span>
                <input
                  type="text"
                  value={agentOrAgency}
                  onChange={(event) => setAgentOrAgency(event.target.value)}
                  placeholder="Any"
                />
              </label>
              <label className={styles.advancedFilterItem}>
                <span>Lot Width</span>
                <select value={lotWidth} onChange={(event) => setLotWidth(event.target.value)}>
                  <option value="any">Any</option>
                  <option value="narrow">Narrow</option>
                  <option value="standard">Standard</option>
                  <option value="wide">Wide</option>
                </select>
              </label>
              <label className={styles.advancedFilterItem}>
                <span>Lot Depth</span>
                <select value={lotDepth} onChange={(event) => setLotDepth(event.target.value)}>
                  <option value="any">Any</option>
                  <option value="shallow">Shallow</option>
                  <option value="standard">Standard</option>
                  <option value="deep">Deep</option>
                </select>
              </label>
              <label className={styles.advancedFilterItem}>
                <span>Listing ID</span>
                <input
                  type="text"
                  value={listingId}
                  onChange={(event) => setListingId(event.target.value)}
                  placeholder="Any"
                />
              </label>
              <label className={styles.advancedFilterItemCheck}>
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(event) => setVerifiedOnly(event.target.checked)}
                />
                <span>Verified listings only</span>
              </label>
            </div>
          )}
          renderListings={() => (
            <div className={styles.listWrap}>
              {loadingListings ? (
                <div className={styles.listingsGrid} aria-busy="true">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className={`${styles.gridItem} ${styles.cardSkeleton} skeleton`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.listingsGrid}>
                  {remainingListings.map((listing) => (
                    <div key={listing.id} className={styles.gridItem}>
                      <HomePropertyCard
                        listing={listing}
                        showFavoriteButton
                        isFavorited={isFavorite(listing.id)}
                        favoriteBusy={isBusy(listing.id)}
                        onFavoriteClick={handleFavoriteClick}
                        imageSizes="(max-width: 760px) 100vw, (max-width: 980px) 50vw, 33vw"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          onBrowseAll={() => router.push("/")}
        />
      </div>
    </div>
  );
}
