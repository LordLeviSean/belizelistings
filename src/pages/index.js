import { useMemo, useState, useEffect, useLayoutEffect, useCallback } from "react";
import { useRouter } from "next/router";
import BelizeMap from "../components/BelizeMap";
import SiteNav from "../components/SiteNav";
import { BELIZE_MAP_REGION_CONFIG, BELIZE_MAP_REGION_ORDER } from "../constants/belizeMapRegions";
import { fetchApprovedListingsWithImages } from "../lib/listingQueries";
import { filterListings } from "../utils/filterListings";
import useSeaFlowMode from "../hooks/useSeaFlowMode";

import styles from "../styles/HomeMapFirst.module.css";

export default function HomePage() {
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);
  const [listingsData, setListingsData] = useState([]);
  const { enabled: seaFlowModeEnabled } = useSeaFlowMode();

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

  if (!router.isReady || !hydrated) {
    return null;
  }

  return (
    <div className={`${styles.page} home-map-page-root`}>
      <SiteNav active="browse" />

      <main className={styles.mainSplit}>
        <section
          className={`${styles.mapPane} home-map-pane ${
            seaFlowModeEnabled ? styles.mapPaneSeaFlow : ""
          }`}
        >
          <BelizeMap districtListingCounts={districtListingCounts} />
        </section>
      </main>
    </div>
  );
}
