import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import SiteNav from "../components/SiteNav";
import ListingCard from "../components/ListingCard";
import FilterBar from "../components/FilterBar";
import { fetchApprovedListingsWithImages } from "../lib/listingQueries";
import useFavorites from "../hooks/useFavorites";
import { useFavoriteSignupPrompt } from "../components/FavoriteSignupPromptProvider";
import {
  applySearchFilters,
  buildSearchRouterQuery,
  getActiveFilterChips,
  getDefaultSearchFilters,
  hasActiveSearchFilters,
  parseSearchFiltersFromQuery,
  removeFilterChip,
  sortSearchResults,
} from "../lib/searchFilters";
import styles from "../styles/SearchResults.module.css";
import PremiumEmptyState from "../components/ui/PremiumEmptyState";
import BackButton from "../components/BackButton";

const QUERY_DEBOUNCE_MS = 320;

export default function SearchPage() {
  const router = useRouter();
  const { isFavorite, isBusy, toggleFavorite, isAuthenticated } = useFavorites();
  const openFavoriteSignupPrompt = useFavoriteSignupPrompt();
  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [allListings, setAllListings] = useState([]);
  const [draftQuery, setDraftQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const filters = useMemo(
    () => parseSearchFiltersFromQuery(router.query, { isReady: router.isReady }),
    [router.query, router.isReady]
  );

  const activeChips = useMemo(() => getActiveFilterChips(filters), [filters]);

  const handleFavoriteClick = useCallback(
    (listingId) => {
      if (!isAuthenticated) {
        openFavoriteSignupPrompt();
        return;
      }
      void toggleFavorite(listingId);
    },
    [isAuthenticated, openFavoriteSignupPrompt, toggleFavorite]
  );

  useEffect(() => {
    if (router.isReady) setDraftQuery(filters.q);
  }, [router.isReady, filters.q]);

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

  const replaceFilters = useCallback(
    (nextFilters) => {
      void router.replace(
        { pathname: "/search", query: buildSearchRouterQuery(nextFilters) },
        undefined,
        { shallow: true, scroll: false }
      );
    },
    [router]
  );

  const patchFilters = useCallback(
    (patch) => {
      replaceFilters({ ...filters, ...patch });
    },
    [filters, replaceFilters]
  );

  const scheduleQuerySync = useCallback(
    (value) => {
      setDraftQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        patchFilters({ q: value.trim() });
      }, QUERY_DEBOUNCE_MS);
    },
    [patchFilters]
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const handleSearchSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      patchFilters({ q: draftQuery.trim() });
      searchInputRef.current?.blur();
    },
    [draftQuery, patchFilters]
  );

  const handleResetFilters = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDraftQuery("");
    setShowAdvanced(false);
    replaceFilters(getDefaultSearchFilters());
  }, [replaceFilters]);

  const handleRemoveChip = useCallback(
    (chipKey) => {
      const next = removeFilterChip(filters, chipKey);
      if (chipKey === "q") setDraftQuery("");
      replaceFilters(next);
    },
    [filters, replaceFilters]
  );

  const listingType = useMemo(() => {
    if (filters.market === "sale") return "for-sale";
    if (filters.market === "rent") return "rent";
    return "all";
  }, [filters.market]);

  const filteredListings = useMemo(() => {
    if (!router.isReady || loading) return [];
    const filtered = applySearchFilters(allListings, filters);
    return sortSearchResults(filtered, filters.sort);
  }, [allListings, filters, loading, router.isReady]);

  return (
    <div className={styles.page}>
      <SiteNav active="browse" />
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Search Results</h1>
          <BackButton label="Back" className={styles.backButton} />
        </header>

        <FilterBar
          query={draftQuery}
          onQueryChange={scheduleQuerySync}
          onSearchSubmit={handleSearchSubmit}
          searchInputRef={searchInputRef}
          listingType={listingType}
          onListingTypeChange={(value) => {
            const market = value === "for-sale" ? "sale" : value === "rent" ? "rent" : "all";
            patchFilters({ market });
          }}
          minPrice={filters.minPrice}
          onMinPriceChange={(value) => patchFilters({ minPrice: value })}
          maxPrice={filters.maxPrice}
          onMaxPriceChange={(value) => patchFilters({ maxPrice: value })}
          beds={filters.beds}
          onBedsChange={(value) => patchFilters({ beds: value })}
          baths={filters.baths}
          onBathsChange={(value) => patchFilters({ baths: value })}
          sortBy={filters.sort}
          onSortChange={(value) => patchFilters({ sort: value })}
          propertyType={filters.propertyType}
          onPropertyTypeChange={(value) => patchFilters({ propertyType: value })}
          verifiedOnly={filters.verifiedOnly}
          onVerifiedOnlyChange={(value) => patchFilters({ verifiedOnly: value })}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
          onResetFilters={hasActiveSearchFilters(filters) ? handleResetFilters : undefined}
          resultCount={loading ? undefined : filteredListings.length}
          activeChips={activeChips}
          onRemoveChip={handleRemoveChip}
          geographyFilters={{
            mapRegion: filters.mapRegion,
            district: filters.district,
            communityId: filters.communityId,
            localityId: filters.localityId,
          }}
          onGeographyFiltersChange={(patch) => patchFilters(patch)}
        />

        <section className={styles.grid} aria-busy={loading}>
          {loading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className={styles.skeleton} aria-hidden="true" />
              ))
            : null}
          {!loading && filteredListings.length === 0 ? (
            <PremiumEmptyState
              variant="search"
              className={styles.searchEmpty}
              title="0 Results"
              description=""
              primary={{ label: "Explore the Map", href: "/" }}
              secondary={
                hasActiveSearchFilters(filters)
                  ? {
                      label: "Reset Filters",
                      onClick: handleResetFilters,
                    }
                  : undefined
              }
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
                imageSizes="(max-width: 760px) 100vw, (max-width: 980px) 50vw, 33vw"
              />
            ))}
        </section>
      </main>
    </div>
  );
}
