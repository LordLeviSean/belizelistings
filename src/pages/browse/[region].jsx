import React, { useEffect, useMemo, useState, useLayoutEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import filterBarStyles from "../../components/FilterBar.module.css";
import ListingCard from "../../components/ListingCard";
import SiteNav from "../../components/SiteNav";
import { fetchApprovedListingsWithImages } from "../../lib/listingQueries";
import { filterListings } from "../../utils/filterListings";
import useFavorites from "../../hooks/useFavorites";

import styles from "../../styles/HomeMapFirst.module.css";

/** URL segment → canonical display district (matches `listing.district` when normalized). */
const REGION_SLUG_TO_DISTRICT_LABEL = {
  corozal: "Corozal",
  "orange-walk": "Orange Walk",
  belize: "Belize",
  cayo: "Cayo",
  "stann-creek": "Stann Creek",
  toledo: "Toledo",
  "ambergris-caye": "Ambergris Caye",
  "caye-caulker": "Caye Caulker",
};

const VALID_REGION_SLUGS = new Set(Object.keys(REGION_SLUG_TO_DISTRICT_LABEL));

const LISTING_TYPE_OPTIONS = [
  { label: "All", value: "all" },
  { label: "For Sale", value: "for-sale" },
  { label: "For Rent", value: "rent" },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Price · low to high", value: "price-asc" },
  { label: "Price · high to low", value: "price-desc" },
];

function qv(v) {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default function BrowseRegionPage() {
  const router = useRouter();
  const { region: regionParam } = router.query;
  const { isFavorite, isBusy, toggleFavorite, isAuthenticated } = useFavorites();

  const [listingsData, setListingsData] = useState([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [listingType, setListingType] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const regionSlug =
    typeof regionParam === "string"
      ? regionParam
      : Array.isArray(regionParam)
        ? regionParam[0] ?? ""
        : "";

  const regionLabel = regionSlug ? REGION_SLUG_TO_DISTRICT_LABEL[regionSlug] : undefined;
  const isValidRegion = Boolean(regionSlug && VALID_REGION_SLUGS.has(regionSlug));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingListings(true);
      const { data } = await fetchApprovedListingsWithImages();
      if (cancelled) return;
      const normalizedListings = (data || []).map((l) => ({
        ...l,
        id: String(l.id ?? ""),
        images: Array.isArray(l.images) ? l.images : [],
      }));
      setListingsData(normalizedListings);
      setLoadingListings(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (!router.isReady || !regionSlug) return;
    const status = qv(router.query.status);
    const sort = qv(router.query.sort);
    queueMicrotask(() => {
      if (status === "for-sale" || status === "rent") {
        setListingType(status);
      } else if (status === "all") {
        setListingType("all");
      }
      if (sort === "newest" || sort === "price-asc" || sort === "price-desc") {
        setSortBy(sort);
      }
    });
  }, [router.isReady, router.query.status, router.query.sort, regionSlug]);

  const baseFiltered = useMemo(() => {
    if (!isValidRegion || !regionLabel) return [];
    return filterListings(listingsData, {
      district: regionLabel,
      status: listingType,
    });
  }, [listingsData, isValidRegion, regionLabel, listingType]);

  const filteredListings = useMemo(() => {
    const rows = [...baseFiltered];
    if (sortBy === "price-asc") {
      return rows.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }
    if (sortBy === "price-desc") {
      return rows.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    return rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [baseFiltered, sortBy]);

  const districtAllRows = useMemo(() => {
    if (!isValidRegion || !regionLabel) return [];
    return filterListings(listingsData, { district: regionLabel, status: "all" });
  }, [listingsData, isValidRegion, regionLabel]);

  const marketMix = useMemo(() => {
    const forSale = districtAllRows.filter((l) => l.listing_type === "for-sale").length;
    const forRent = districtAllRows.filter((l) => l.listing_type === "rent").length;
    return { forSale, forRent };
  }, [districtAllRows]);

  const syncFiltersToUrl = (nextType, nextSort) => {
    const q = {};
    if (nextType !== "all") q.status = nextType;
    if (nextSort !== "newest") q.sort = nextSort;
    void router.replace({ pathname: `/browse/${regionSlug}`, query: q }, undefined, {
      shallow: true,
      scroll: false,
    });
  };

  if (!router.isReady) {
    return null;
  }

  if (regionSlug && !isValidRegion) {
    return (
      <>
        <Head>
          <title>Region not found | Belize Listings</title>
        </Head>
        <div className={styles.page}>
          <SiteNav active="browse" />
          <main className={styles.listPane} style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.25rem" }}>
            <h1>Region not found</h1>
            <p>This browse route does not exist.</p>
            <p>
              <Link href="/">Return home</Link>
            </p>
          </main>
        </div>
      </>
    );
  }

  if (!regionSlug) {
    return null;
  }

  const n = filteredListings.length;
  const listLead = `${n} active ${n === 1 ? "listing" : "listings"}`;
  const listMeta = `${marketMix.forSale} for sale · ${marketMix.forRent} rentals in this district`;

  return (
    <>
      <Head>
        <title>{`${regionLabel} · Inventory | Belize Listings`}</title>
      </Head>
      <div className={`${styles.page} browse-region-page`}>
        <SiteNav active="browse" />

        <main
          className={styles.listPane}
          style={{ maxWidth: 900, margin: "0 auto", width: "100%", padding: "1.25rem 1.25rem 2.5rem" }}
        >
          <div className={styles.listPaneHeader}>
            <p style={{ marginBottom: "0.5rem" }}>
              <Link href="/" style={{ color: "var(--text-secondary)" }}>
                ← Map & exploration
              </Link>
            </p>
            <h1 className={styles.listPaneTitle}>{regionLabel}</h1>
            <p className={styles.listPaneLead} aria-live="polite">
              {loadingListings ? "Loading…" : listLead}
            </p>
            {!loadingListings ? <p className={styles.listPaneMeta}>{listMeta}</p> : null}

            <div
              className={filterBarStyles.statusToggle}
              role="tablist"
              aria-label="Listing type"
              style={{ marginTop: 12, marginBottom: 10, width: "100%", justifyContent: "stretch" }}
            >
              {LISTING_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={listingType === option.value}
                  className={`${filterBarStyles.toggleButton} ${
                    listingType === option.value ? filterBarStyles.toggleButtonActive : ""
                  }`}
                  style={{ flex: "1 1 0", minWidth: 0 }}
                  onClick={() => {
                    setListingType(option.value);
                    syncFiltersToUrl(option.value, sortBy);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className={styles.browseSortLabel} htmlFor="browse-region-sort">
              Sort
            </label>
            <select
              id="browse-region-sort"
              className={styles.browseSortSelect}
              value={sortBy}
              onChange={(e) => {
                const v = e.target.value;
                setSortBy(v);
                syncFiltersToUrl(listingType, v);
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {loadingListings ? (
            <p style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>Loading listings…</p>
          ) : filteredListings.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No listings match these filters in {regionLabel}.</p>
              <p style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setListingType("all");
                    setSortBy("newest");
                    syncFiltersToUrl("all", "newest");
                  }}
                >
                  Reset filters
                </button>
                {" · "}
                <Link href="/">Explore map</Link>
              </p>
            </div>
          ) : (
            <div className={`${styles.listings} safeFlexCol`}>
              {filteredListings.map((listing) => (
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
        </main>
      </div>
    </>
  );
}
