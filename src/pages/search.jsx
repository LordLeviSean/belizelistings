import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/router";
import SiteNav from "../components/SiteNav";
import ListingCard from "../components/ListingCard";
import { BELIZE_MAP_REGION_CONFIG } from "../constants/belizeMapRegions";
import { fetchApprovedListingsWithImages } from "../lib/listingQueries";
import useFavorites from "../hooks/useFavorites";
import { useFavoriteSignupPrompt } from "../components/FavoriteSignupPromptProvider";
import styles from "../styles/SearchResults.module.css";

function listingMatchesQuery(listing, query) {
  const district = BELIZE_MAP_REGION_CONFIG[listing?.district]?.label || listing?.district || "";
  const haystack = `${listing?.title || ""} ${district} ${listing?.property_type || ""} ${listing?.status || ""} ${listing?.price || ""}`;
  return haystack.toLowerCase().includes(query.toLowerCase());
}

function listingMatchesDistrictSlug(listing, slug) {
  if (!slug) return true;
  const cfg = BELIZE_MAP_REGION_CONFIG[listing?.district];
  return cfg?.slug === slug;
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
    return allListings.filter((listing) => {
      if (!listingMatchesDistrictSlug(listing, districtSlug)) return false;
      if (!listingMatchesMarket(listing, marketParam || "all")) return false;
      if (!query) return true;
      return listingMatchesQuery(listing, query);
    });
  }, [allListings, query, districtSlug, marketParam]);

  return (
    <div className={styles.page}>
      <SiteNav active="browse" />
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Search Results</h1>
          <p>
            {loading
              ? "Loading listings..."
              : `${filteredListings.length} result${filteredListings.length === 1 ? "" : "s"}${query ? ` for "${query}"` : ""}${districtSlug ? " · filtered by district" : ""}${marketParam ? " · filtered by market" : ""}`}
          </p>
        </header>

        <section className={styles.grid}>
          {loading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className={styles.skeleton} />
              ))
            : filteredListings.map((listing) => (
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
