import { useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/router";

import BelizeMap from "../components/BelizeMap";
import FilterBar from "../components/FilterBar";
import ListingCard from "../components/ListingCard";
import SiteNav from "../components/SiteNav";
import { fetchApprovedListingsWithImages } from "../lib/listingQueries";
import { filterListings } from "../utils/filterListings";
import { cleanQuery, stableStringifyQuery } from "../utils/queryStringify";
import useScrollMemory from "../hooks/useScrollMemory";

import styles from "../styles/HomeMapFirst.module.css";

function qv(v) {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function homeQueryFromRouter(query) {
  const status = qv(query.status);
  return cleanQuery({
    status: status && status !== "all" ? status : undefined,
    minPrice: qv(query.minPrice) || undefined,
    maxPrice: qv(query.maxPrice) || undefined,
    beds: qv(query.beds) || undefined,
    baths: qv(query.baths) || undefined,
  });
}

function homeQueryFromState(listingType, minPrice, maxPrice, beds, baths) {
  return cleanQuery({
    status: listingType !== "all" ? listingType : undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    beds: beds || undefined,
    baths: baths || undefined,
  });
}

export default function HomePage() {
  const router = useRouter();
  const listRef = useRef(null);

  const [hydrated, setHydrated] = useState(false);
  const [listingsData, setListingsData] = useState([]);
  const [listingType, setListingType] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await fetchApprovedListingsWithImages();
      if (!cancelled) setListingsData(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const queryKey = useMemo(
    () => (router.isReady ? stableStringifyQuery(router.query) : ""),
    [router.isReady, router.query]
  );

  useLayoutEffect(() => {
    if (!router.isReady) return;
    const q = router.query;
    queueMicrotask(() => {
      setListingType(qv(q.status) || "all");
      setMinPrice(String(qv(q.minPrice) ?? ""));
      setMaxPrice(String(qv(q.maxPrice) ?? ""));
      setBeds(String(qv(q.beds) ?? ""));
      setBaths(String(qv(q.baths) ?? ""));
      setHydrated(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey mirrors serialized router.query
  }, [router.isReady, queryKey]);

  useEffect(() => {
    if (!router.isReady || !hydrated) return;
    const next = homeQueryFromState(listingType, minPrice, maxPrice, beds, baths);
    const cur = homeQueryFromRouter(router.query);
    if (stableStringifyQuery(next) !== stableStringifyQuery(cur)) {
      router.replace({ pathname: "/", query: next }, undefined, { shallow: true });
    }
  }, [listingType, minPrice, maxPrice, beds, baths, router.isReady, hydrated, queryKey, router]);

  const filteredListings = useMemo(() => {
    return filterListings(listingsData, {
      status: listingType,
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      beds: beds ? Number(beds) : null,
      baths: baths ? Number(baths) : null,
    });
  }, [listingsData, listingType, minPrice, maxPrice, beds, baths]);

  useScrollMemory({
    mode: "home",
    router,
    listRef,
    listDependency: filteredListings.length,
  });

  const resetFilters = () => {
    setListingType("all");
    setMinPrice("");
    setMaxPrice("");
    setBeds("");
    setBaths("");
  };

  if (!router.isReady || !hydrated) {
    return null;
  }

  return (
    <div className={styles.page}>
      <SiteNav active="browse" />

      <div className={`${styles.filterSection} safeFlexRow`}>
        <div className={styles.filterBarWrap}>
          <FilterBar
            listingType={listingType}
            setListingType={setListingType}
            minPrice={minPrice}
            setMinPrice={setMinPrice}
            maxPrice={maxPrice}
            setMaxPrice={setMaxPrice}
            beds={beds}
            setBeds={setBeds}
            baths={baths}
            setBaths={setBaths}
          />
        </div>
      </div>

      <main className={styles.mainSplit}>
        <section className={styles.mapPane}>
          <BelizeMap
            listings={filteredListings}
            listingType={listingType}
            minPrice={minPrice}
            maxPrice={maxPrice}
            beds={beds}
            baths={baths}
          />
        </section>

        <aside className={`${styles.listPane} safeFlexCol`}>
          <div className={styles.listPaneHeader}>
            <h1 className={styles.listTitle}>Available Listings</h1>
            <p className={styles.listCount} aria-live="polite">
              {filteredListings.length} homes
            </p>
          </div>

          {filteredListings.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No listings match these filters.</p>
              <button type="button" onClick={resetFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <div ref={listRef} className={`${styles.listings} safeFlexCol`}>
              {filteredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </aside>
      </main>

      <footer className={styles.footer}>© 2026 BelizeListings.bz — Blake & Co.</footer>
    </div>
  );
}
