import {
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import {
  Bath,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  Heart,
  House,
  Search,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  MapPin,
} from "lucide-react";
import BelizeMap from "../components/BelizeMap";
import AmbientPalmBackdrop from "../components/AmbientPalmBackdrop";
import SiteNav from "../components/SiteNav";
import HomeAdvancedFiltersModal from "../components/HomeAdvancedFiltersModal";
import useFavorites from "../hooks/useFavorites";
import { BELIZE_MAP_REGION_CONFIG, BELIZE_MAP_REGION_ORDER } from "../constants/belizeMapRegions";
import { fetchApprovedListingsWithImages } from "../lib/listingQueries";
import { filterListings } from "../utils/filterListings";
import useSeaFlowMode from "../hooks/useSeaFlowMode";
import { useFavoriteSignupPrompt } from "../components/FavoriteSignupPromptProvider";

import styles from "../styles/HomeMapFirst.module.css";
import favoriteStyles from "../styles/FavoriteButton.module.css";

const FEATURED_COUNT = 12;

function formatPrice(price, currency) {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return "Price on request";
  return `${numericPrice.toLocaleString()} ${currency || ""}`.trim();
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

function detectListingBadge(listing) {
  return getListingMarketKind(listing) === "rent" ? "FOR RENT" : "FOR SALE";
}

/** Live filter for Recent only — mirrors search semantics without routing. */
function listingMatchesHaystack(listing, qNorm) {
  if (!qNorm) return true;
  const district = BELIZE_MAP_REGION_CONFIG[listing?.district]?.label || listing?.district || "";
  const haystack = `${listing?.title || ""} ${district} ${listing?.property_type || ""} ${listing?.status || ""} ${listing?.price || ""}`;
  return haystack.toLowerCase().includes(qNorm);
}

export default function HomePage() {
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);
  const [listingsData, setListingsData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchSubmitting, setSearchSubmitting] = useState(false);
  const [carouselIndexById, setCarouselIndexById] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const featuredScrollRef = useRef(null);
  const featuredPausedRef = useRef(false);
  const { enabled: seaFlowModeEnabled } = useSeaFlowMode();
  const { isFavorite, toggleFavorite, isBusy, isAuthenticated } = useFavorites();
  const openFavoriteSignupPrompt = useFavoriteSignupPrompt();

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

  const activeListings = useMemo(
    () => listingsData.filter((listing) => listing?.status !== "sold"),
    [listingsData]
  );

  const saleCount = useMemo(
    () => activeListings.filter((listing) => getListingMarketKind(listing) === "sale").length,
    [activeListings]
  );

  const rentCount = useMemo(
    () => activeListings.filter((listing) => getListingMarketKind(listing) === "rent").length,
    [activeListings]
  );

  const sortedNewest = useMemo(() => {
    return [...listingsData].sort((a, b) => {
      const aTime = new Date(a?.created_at || a?.inserted_at || a?.updated_at || 0).getTime();
      const bTime = new Date(b?.created_at || b?.inserted_at || b?.updated_at || 0).getTime();
      return bTime - aTime;
    });
  }, [listingsData]);

  const featuredListings = useMemo(
    () => sortedNewest.slice(0, FEATURED_COUNT),
    [sortedNewest]
  );

  const featuredIdSet = useMemo(
    () => new Set(featuredListings.map((l) => l.id)),
    [featuredListings]
  );

  const recentPool = useMemo(
    () => sortedNewest.filter((l) => !featuredIdSet.has(l.id)).slice(0, 48),
    [sortedNewest, featuredIdSet]
  );

  const searchNorm = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  const recentFiltered = useMemo(
    () => recentPool.filter((listing) => listingMatchesHaystack(listing, searchNorm)),
    [recentPool, searchNorm]
  );

  const featuredLoop = useMemo(() => {
    if (featuredListings.length === 0) return [];
    if (featuredListings.length === 1) return featuredListings;
    return [...featuredListings, ...featuredListings];
  }, [featuredListings]);

  const shiftCarousel = useCallback((listingId, totalImages, direction) => {
    if (!listingId || totalImages <= 1) return;
    setCarouselIndexById((prev) => {
      const current = Number(prev[listingId] || 0);
      const next = (current + direction + totalImages) % totalImages;
      return { ...prev, [listingId]: next };
    });
  }, []);

  const handleSearchSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      const q = searchTerm.trim();
      if (!q) return;
      setSearchSubmitting(true);
      try {
        await router.push(`/search?q=${encodeURIComponent(q)}`);
      } finally {
        setSearchSubmitting(false);
      }
    },
    [router, searchTerm]
  );

  useEffect(() => {
    const el = featuredScrollRef.current;
    if (!el || featuredLoop.length < 2) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let raf = 0;
    const speed = 0.088;
    const step = () => {
      const node = featuredScrollRef.current;
      if (node && !featuredPausedRef.current) {
        const half = node.scrollWidth / 2;
        if (half > 4) {
          node.scrollLeft += speed;
          if (node.scrollLeft >= half - 1) node.scrollLeft = 0;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [featuredLoop.length]);

  const renderListingCard = useCallback(
    (listing, imageSizes) => {
      const listingImages = (listing?.images || [])
        .map((item) => (typeof item === "string" ? item : item?.image_url))
        .filter(Boolean)
        .filter((img) => !String(img).toLowerCase().includes("map"));
      const imageCount = listingImages.length;
      const activeIndex = imageCount ? Number(carouselIndexById[listing.id] || 0) % imageCount : 0;
      const imageUrl = imageCount ? listingImages[activeIndex] : "/placeholder.jpg";
      const district =
        BELIZE_MAP_REGION_CONFIG[listing?.district]?.label || listing?.district || "Belize";
      const status = detectListingBadge(listing);
      const favorited = isFavorite(listing.id);
      const favoriteBusy = isBusy(listing.id);

      return (
        <Link href={`/listing/${listing.id}`} className={styles.propertyCard}>
          <div className={styles.propertyMedia}>
            <Image
              src={imageUrl}
              alt={listing?.title || "Listing"}
              fill
              sizes={imageSizes}
            />
            <span className={styles.propertyBadge}>{status}</span>
            <span className={styles.propertyFavoriteWrap}>
              <button
                type="button"
                className={`${favoriteStyles.favoriteButton} ${
                  favorited ? favoriteStyles.favoriteButtonActive : ""
                }`}
                aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={favorited}
                disabled={favoriteBusy}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!isAuthenticated) {
                    openFavoriteSignupPrompt();
                    return;
                  }
                  void toggleFavorite(listing.id);
                }}
              >
                <Heart fill={favorited ? "currentColor" : "none"} />
              </button>
            </span>
            {imageCount > 1 ? (
              <>
                <button
                  type="button"
                  className={`${styles.propertyArrowBtn} ${styles.propertyArrowLeft}`}
                  aria-label="Show previous image"
                  onClick={(event) => {
                    event.preventDefault();
                    shiftCarousel(listing.id, imageCount, -1);
                  }}
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  className={`${styles.propertyArrowBtn} ${styles.propertyArrowRight}`}
                  aria-label="Show next image"
                  onClick={(event) => {
                    event.preventDefault();
                    shiftCarousel(listing.id, imageCount, 1);
                  }}
                >
                  <ChevronRight />
                </button>
              </>
            ) : null}
            {imageCount > 1 ? (
              <div className={styles.carouselDots} aria-hidden="true">
                {listingImages.map((_, dotIndex) => (
                  <button
                    type="button"
                    key={`${listing.id}-dot-${dotIndex}`}
                    className={`${styles.carouselDot} ${
                      dotIndex === activeIndex ? styles.carouselDotActive : ""
                    }`}
                    onClick={(event) => {
                      event.preventDefault();
                      setCarouselIndexById((prev) => ({ ...prev, [listing.id]: dotIndex }));
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
          <div className={styles.propertyBody}>
            <h4>{listing?.title || "Belize Property"}</h4>
            <p className={styles.propertyPrice}>{formatPrice(listing?.price, listing?.currency || "BZD")}</p>
            <p className={styles.propertyMeta}>
              <span>
                <BedDouble /> {listing?.beds || 0} bd
              </span>
              <span>
                <Bath /> {listing?.baths || 0} ba
              </span>
              <span>
                <MapPin /> {district}
              </span>
            </p>
          </div>
        </Link>
      );
    },
    [
      carouselIndexById,
      isAuthenticated,
      isBusy,
      isFavorite,
      openFavoriteSignupPrompt,
      shiftCarousel,
      toggleFavorite,
    ]
  );

  if (!router.isReady || !hydrated) {
    return null;
  }

  return (
    <div className={`${styles.page} home-map-page-root`}>
      <AmbientPalmBackdrop />
      <SiteNav active="browse" />

      <main className={styles.pageMain}>
        <section className={styles.heroSection}>
          <div className={styles.heroLeft}>
            <p className={styles.heroKicker}>EXPLORE. INVEST. THRIVE.</p>
            <h1 className={styles.heroHeadline}>Belize&apos;s Living Property Map</h1>
            <p className={styles.heroSubtext}>
              Discover real estate opportunities across Belize. Interactive. Intelligent. Always up
              to date.
            </p>

            <form
              className={`${styles.searchShell} ${searchSubmitting ? styles.searchShellSubmitting : ""}`}
              onSubmit={handleSearchSubmit}
            >
              <span className={styles.searchIcon} aria-hidden="true">
                <Search />
              </span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={styles.searchInput}
                type="search"
                placeholder="Narrows Recently added · Enter opens dedicated search…"
                aria-label="Filter recently added listings; Enter runs full search"
                enterKeyHint="search"
              />
              <button
                className={styles.searchFilterBtn}
                type="button"
                aria-label="Open advanced filters"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal />
              </button>
            </form>

            <div className={styles.statGrid}>
              <article className={styles.statCard}>
                <span className={styles.statIcon} aria-hidden="true">
                  <House />
                </span>
                <p className={styles.statValue}>{activeListings.length}</p>
                <p className={styles.statLabel}>Active Listings</p>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statIcon} aria-hidden="true">
                  <Tag />
                </span>
                <p className={styles.statValue}>{saleCount}</p>
                <p className={styles.statLabel}>For Sale</p>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statIcon} aria-hidden="true">
                  <Search />
                </span>
                <p className={styles.statValue}>{rentCount}</p>
                <p className={styles.statLabel}>For Rent</p>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statIcon} aria-hidden="true">
                  <TrendingUp />
                </span>
                <p className={styles.statValue}>100%</p>
                <p className={styles.statLabel}>Real-time Data</p>
              </article>
            </div>
          </div>

          <div className={styles.heroRight}>
            <section className={`${styles.mapPane} home-map-pane`}>
              <div className={styles.mapPaneBackdrop} aria-hidden />
              {seaFlowModeEnabled ? (
                <div className={styles.mapPaneSeaFlowLayers} aria-hidden />
              ) : null}
              <div className={styles.mapPaneMapWrap}>
                <BelizeMap districtListingCounts={districtListingCounts} />
              </div>
            </section>
          </div>
        </section>

        {featuredLoop.length ? (
          <section
            className={styles.featuredSection}
            aria-label="Featured listings"
            onMouseEnter={() => {
              featuredPausedRef.current = true;
            }}
            onMouseLeave={() => {
              featuredPausedRef.current = false;
            }}
          >
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle}>Featured listings</h2>
              <p className={styles.sectionSubtitle}>Curated band · twelve newest arrivals, ambient drift</p>
            </div>
            <div className={styles.featuredCarouselViewport} ref={featuredScrollRef}>
              <div className={styles.featuredCarouselTrack}>
                {featuredLoop.map((listing, idx) => (
                  <div key={`${listing.id}-${idx}`} className={styles.featuredCarouselItem}>
                    {renderListingCard(listing, "(max-width: 760px) 82vw, 296px")}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className={styles.communitySection}>
          <article className={styles.communityCard}>
            <p className={styles.communityKicker}>Built for Belize</p>
            <h3>Join a growing community of agents and property owners</h3>
            <p>List smarter. Sell faster. Manage better.</p>
            <div className={styles.communityActions}>
              <Link className={styles.communityPrimaryBtn} href="/login?signup=1">
                Create Free Account
              </Link>
              <Link className={styles.communitySecondaryBtn} href="/about">
                Learn More
              </Link>
            </div>
          </article>

          <div className={styles.recentPanel}>
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle}>Recently added</h2>
              <p className={styles.sectionSubtitle}>
                {searchNorm
                  ? `Filtered locally · ${recentFiltered.length} match${recentFiltered.length === 1 ? "" : "es"}`
                  : "Live pool below featured · reacts to the field above"}
              </p>
            </div>
            <div className={styles.recentGrid}>
              {recentFiltered.length === 0 ? (
                <div className={styles.recentEmptyState} role="status">
                  <p className={styles.recentEmptyKicker}>
                    {recentPool.length === 0 ? "Ledger cadence" : "Filtered view"}
                  </p>
                  <p className={styles.recentEmptyTitle}>
                    {recentPool.length === 0 ? "Quiet for the moment." : "No local matches."}
                  </p>
                  <p className={styles.recentEmptyBody}>
                    {recentPool.length === 0
                      ? "Approved listings appear here first. The map and featured band remain live—nothing is missing."
                      : "Ease the phrase above, use advanced filters, or browse the featured band above for curated arrivals."}
                  </p>
                  <div className={styles.recentEmptyGhost} aria-hidden />
                </div>
              ) : (
                recentFiltered.map((listing) => (
                  <div key={listing.id} className={styles.recentGridItem}>
                    {renderListingCard(listing, "(max-width: 760px) 100vw, 33vw")}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      <HomeAdvancedFiltersModal isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  );
}
