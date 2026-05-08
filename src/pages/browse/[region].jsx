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
import { useFavoriteSignupPrompt } from "../../components/FavoriteSignupPromptProvider";

import styles from "../../styles/District.module.css";

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

const REGION_DESCRIPTOR = {
  corozal: "Northern borderland inventory",
  "orange-walk": "Agricultural growth corridor",
  belize: "Urban commercial hub",
  cayo: "Inland eco-estate market",
  "stann-creek": "Luxury coastal inventory",
  toledo: "Southern frontier opportunities",
  "ambergris-caye": "Island resort market",
  "caye-caulker": "Boutique island inventory",
};

const REGION_ACCENT_RGB = {
  corozal: "143, 196, 181",
  "orange-walk": "214, 198, 134",
  belize: "139, 180, 217",
  cayo: "126, 186, 134",
  "stann-creek": "135, 204, 186",
  toledo: "171, 155, 205",
  "ambergris-caye": "117, 197, 204",
  "caye-caulker": "152, 185, 222",
};

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
  const descriptor = REGION_DESCRIPTOR[regionSlug] || "Regional market inventory";
  const accentRgb = REGION_ACCENT_RGB[regionSlug] || "137, 205, 189";

  return (
    <>
      <Head>
        <title>{`${regionLabel} · Inventory | Belize Listings`}</title>
      </Head>
      <div className={`${styles.page} browse-region-page`}>
        <SiteNav active="browse" />
        <main className={styles.districtPageShell} style={{ "--district-accent-rgb": accentRgb }}>
          <section className={styles.districtHero}>
            <div className={styles.districtHeroMain}>
              <div className={styles.districtHeroLeft}>
                <div className={styles.districtHeroTopRow}>
                  <Link href="/" className={styles.districtBackLink}>
                    ← Map & exploration
                  </Link>
                  <p className={styles.districtDescriptor}>{descriptor}</p>
                </div>
                <h1 className={styles.listPaneTitle}>{regionLabel}</h1>
                <p className={styles.districtSubtitle}>Coastal district intelligence</p>
                <p className={styles.districtEditorial}>
                  A curated, map-led view of the {regionLabel} property landscape with a calmer editorial
                  browsing rhythm and atmospheric regional context.
                </p>
                <p className={styles.listPaneLead} aria-live="polite">
                  {loadingListings ? "Loading…" : listLead}
                </p>
              </div>
              <aside className={styles.districtHeroRight} aria-label={`${regionLabel} district context`}>
                <div className={styles.miniMapPreview}>
                  <img src="/maps/clean-mainland-districts.svg" alt="" className={styles.embeddedMapSilhouette} />
                  <div className={styles.miniMapGlow} />
                </div>
                {!loadingListings ? (
                  <div className={styles.districtMetaGrid}>
                    <div className={styles.districtMetaCard}>
                      <p className={styles.districtMetaLabel}>Total Inventory</p>
                      <p className={styles.districtMetaValue}>{districtAllRows.length}</p>
                    </div>
                    <div className={styles.districtMetaCard}>
                      <p className={styles.districtMetaLabel}>For Sale</p>
                      <p className={styles.districtMetaValue}>{marketMix.forSale}</p>
                    </div>
                    <div className={styles.districtMetaCard}>
                      <p className={styles.districtMetaLabel}>For Rent</p>
                      <p className={styles.districtMetaValue}>{marketMix.forRent}</p>
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </section>

          <section className={styles.listPane}>
            <div className={styles.listPaneHeader}>
              {!loadingListings ? <p className={styles.listPaneMeta}>{listMeta}</p> : null}

              <div
                className={`${filterBarStyles.statusToggle} ${styles.districtStatusToggle}`}
                role="tablist"
                aria-label="Listing type"
              >
                {LISTING_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={listingType === option.value}
                    className={`${filterBarStyles.toggleButton} ${styles.districtToggleButton} ${
                      listingType === option.value ? filterBarStyles.toggleButtonActive : ""
                    }`}
                    style={{ flex: "1 1 0", minWidth: 0, width: "100%" }}
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
                className={`${styles.browseSortSelect} ${styles.districtSortSelect}`}
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
                    showFavoriteButton
                    isFavorited={isFavorite(listing.id)}
                    favoriteBusy={isBusy(listing.id)}
                    onToggleFavorite={handleFavoriteClick}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
