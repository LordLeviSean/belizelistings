import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import BelizeMap from "../components/BelizeMap";
import ListingCard from "../components/ListingCard";
import SiteNav from "../components/SiteNav";
import { BELIZE_MAP_REGION_CONFIG, BELIZE_MAP_REGION_ORDER } from "../constants/belizeMapRegions";
import { fetchApprovedListingsWithImages } from "../lib/listingQueries";
import { filterListings } from "../utils/filterListings";
import useScrollMemory from "../hooks/useScrollMemory";
import useFavorites from "../hooks/useFavorites";

import styles from "../styles/HomeMapFirst.module.css";

/** Newest listings in the home sidebar (global, not district-scoped). */
const HOME_LATEST_LISTINGS_CAP = 8;

export default function HomePage() {
  const router = useRouter();
  const listRef = useRef(null);

  const [hydrated, setHydrated] = useState(false);
  const [listingsData, setListingsData] = useState([]);
  const { isFavorite, isBusy, toggleFavorite, isAuthenticated } = useFavorites();

  const fetchListings = useCallback(async () => {
    const { data } = await fetchApprovedListingsWithImages();
    const normalizedListings = (data || []).map((l) => ({
      ...l,
      id: String(l.id ?? ""),
      images: Array.isArray(l.images) ? l.images : [],
    }));
    setListingsData(normalizedListings);
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    const onRouteChangeComplete = () => {
      fetchListings();
    };
    router.events.on("routeChangeComplete", onRouteChangeComplete);
    return () => {
      router.events.off("routeChangeComplete", onRouteChangeComplete);
    };
  }, [router.events, fetchListings]);

  useLayoutEffect(() => {
    if (!router.isReady) return;
    queueMicrotask(() => setHydrated(true));
  }, [router.isReady]);

  const districtListingCounts = useMemo(() => {
    const counts = {};
    for (const id of BELIZE_MAP_REGION_ORDER) {
      const label = BELIZE_MAP_REGION_CONFIG[id]?.label;
      if (!label) continue;
      counts[id] = filterListings(listingsData, {
        district: label,
        status: "all",
      }).length;
    }
    return counts;
  }, [listingsData]);

  const approvedAll = useMemo(
    () => filterListings(listingsData, { status: "all" }),
    [listingsData]
  );

  const latestListings = useMemo(() => {
    return [...approvedAll]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, HOME_LATEST_LISTINGS_CAP);
  }, [approvedAll]);

  useScrollMemory({
    mode: "home",
    router,
    listRef,
    listDependency: latestListings.length,
  });

  if (!router.isReady || !hydrated) {
    return null;
  }

  return (
    <div className={`${styles.page} home-map-page-root`}>
      <SiteNav active="browse" />

      <main className={styles.mainSplit}>
        <section className={`${styles.mapPane} home-map-pane`}>
          <BelizeMap districtListingCounts={districtListingCounts} />
        </section>

        <aside className={`${styles.listPane} safeFlexCol`}>
          <div className={styles.listPaneHeader}>
            <h1 className={styles.listPaneTitle}>All Listings</h1>
          </div>

          {latestListings.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No active listings right now.</p>
            </div>
          ) : (
            <div ref={listRef} className={`${styles.listings} safeFlexCol`}>
              {latestListings.map((listing) => (
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
          )}
        </aside>
      </main>
    </div>
  );
}
