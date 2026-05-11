import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/router";
import SiteNav from "../components/SiteNav";
import ListingCard from "../components/ListingCard";
import {
  getRegionByAny,
  getRegionLabel,
  isChildRegion,
  normalizeRegionSlug,
} from "../constants/geographyLayer";
import { fetchApprovedListingsWithImages } from "../lib/listingQueries";
import useFavorites from "../hooks/useFavorites";
import { useFavoriteSignupPrompt } from "../components/FavoriteSignupPromptProvider";
import { getListingRegionSlug } from "../utils/canonicalListing";
import styles from "../styles/SearchResults.module.css";
import PremiumEmptyState from "../components/ui/PremiumEmptyState";

function listingMatchesQuery(listing, query) {
  const district = getRegionLabel(getListingRegionSlug(listing));
  const haystack = `${listing?.title || ""} ${district} ${listing?.property_type || ""} ${listing?.status || ""} ${listing?.price || ""}`;
  return haystack.toLowerCase().includes(query.toLowerCase());
}

function listingMatchesDistrictSlug(listing, slug) {
  if (!slug) return true;
  const listingRegion = normalizeRegionSlug(getListingRegionSlug(listing));
  const routeRegion = normalizeRegionSlug(slug);
  return listingRegion === routeRegion || isChildRegion(listingRegion, routeRegion);
}

function getListingMarketSignals(listing) {
  return [
    listing?.listing_type,
    listing?.market_type,
    listing?.listing_status,
    listing?.status,
    listing?.category,
  ]
    .map((value) => String(value || "").toLowerCase().trim())
    .filter(Boolean)
    .join(" ");
}

function getListingMarketKind(listing) {
  const signals = getListingMarketSignals(listing);
  if (/(rent|rental|lease|for-rent|for rent)/.test(signals)) return "rent";
  if (/(sale|sell|for-sale|for sale)/.test(signals)) return "sale";
  return "sale";
}

function listingMatchesMarket(listing, market) {
  if (!market || market === "all") return true;
  const kind = getListingMarketKind(listing);
  if (market === "rent") return kind === "rent";
  if (market === "sale") return kind === "sale";
  return true;
}

export default function SearchPage() {
  const router = useRouter();
  const { isFavorite, isBusy, toggleFavorite, isAuthenticated } = useFavorites();
  const openFavoriteSignupPrompt = useFavoriteSignupPrompt();
  const [loading, setLoading] = useState(true);
  const [allListings, setAllListings] = useState([]);

  function handleFavoriteClick(listingId) {
    if (!isAuthenticated) {
      openFavoriteSignupPrompt();
      return;
    }
    void toggleFavorite(listingId);
  }

  const query = useMemo(
    () => String(router.query?.q || router.query?.query || "").trim(),
    [router.query]
  );

  const districtSlug = useMemo(
    () => (router.isReady ? String(router.query?.district ?? "").trim() : ""),
    [router.isReady, router.query?.district]
  );

  const marketParam = useMemo(
    () => (router.isReady ? String(router.query?.market ?? "").toLowerCase().trim() : ""),
    [router.isReady, router.query?.market]
  );
  const subregionParam = useMemo(
    () => (router.isReady ? String(router.query?.subregion ?? "").toLowerCase().trim() : ""),
    [router.isReady, router.query?.subregion]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await fetchApprovedListingsWithImages();
      if (cancelled) return;
      const normalized = (data || []).map((listing) => ({
        ...listing,
        id: String(listing.id ?? ""),
        images: Array.isArray(listing.images) ? listing.images : [],
      }));
      setAllListings(normalized);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredListings = useMemo(() => {
    const normalizedDistrict = normalizeRegionSlug(districtSlug);
    const normalizedSubregion = normalizeRegionSlug(subregionParam);
    const useSubregionFilter =
      normalizedSubregion &&
      getRegionByAny(normalizedSubregion) &&
      isChildRegion(normalizedSubregion, normalizedDistrict);
    return allListings.filter((listing) => {
      if (!listingMatchesDistrictSlug(listing, districtSlug)) return false;
      if (useSubregionFilter && normalizeRegionSlug(listing?.district) !== normalizedSubregion) return false;
      if (!listingMatchesMarket(listing, marketParam || "all")) return false;
      if (!query) return true;
      return listingMatchesQuery(listing, query);
    });
  }, [allListings, query, districtSlug, marketParam, subregionParam]);

  return (
    <div className={styles.page}>
      <SiteNav active="browse" />
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Search Results</h1>
          <p>
            {loading
              ? "Loading listings..."
              : `${filteredListings.length} result${filteredListings.length === 1 ? "" : "s"}${query ? ` for "${query}"` : ""}${districtSlug ? " · filtered by region" : ""}${subregionParam ? " · filtered by subregion" : ""}${marketParam ? " · filtered by market" : ""}`}
          </p>
        </header>

        <section className={styles.grid}>
          {loading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className={styles.skeleton} />
              ))
            : null}
          {!loading && filteredListings.length === 0 ? (
            <PremiumEmptyState
              variant="search"
              className={styles.searchEmpty}
              primary={{ label: "Explore from homepage", href: "/" }}
              secondary={{
                label: "Clear filters & terms",
                onClick: () => {
                  void router.push({ pathname: "/search", query: {} });
                },
              }}
            />
          ) : null}
          {!loading &&
            filteredListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                showFavoriteButton
                isFavorited={isFavorite(listing.id)}
                favoriteBusy={isBusy(listing.id)}
                onToggleFavorite={handleFavoriteClick}
              />
            ))}
        </section>
      </main>
    </div>
  );
}
