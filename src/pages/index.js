import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  House,
  Key,
  Search,
  SlidersHorizontal,
  Tag,
  TrendingUp,
} from "lucide-react";
import BelizeMap from "../components/BelizeMap";
import SiteNav from "../components/SiteNav";
import ListingCard from "../components/ListingCard";
import PremiumEmptyState from "../components/ui/PremiumEmptyState";
import useFavorites from "../hooks/useFavorites";
import { BELIZE_MAP_REGION_CONFIG, BELIZE_MAP_REGION_ORDER } from "../constants/belizeMapRegions";
import { getRegionLabel } from "../constants/geographyLayer";
import { fetchApprovedListingsWithImages } from "../lib/listingQueries";
import { filterListings } from "../utils/filterListings";
import { getLifecycleStatus, getListingRegionSlug, isListingActivelyAvailable } from "../utils/canonicalListing";
import { useFavoriteSignupPrompt } from "../components/FavoriteSignupPromptProvider";
import useAuth from "../hooks/useAuth";
import useRoleAccess from "../hooks/useRoleAccess";
import useUserRole from "../hooks/useUserRole";
import GeographicUpdateModal from "../components/home/GeographicUpdateModal";
import HomeMapAwakensTransition, {
  useHomeLoadingTransitionGate,
} from "../components/home/HomeMapAwakensTransition";
import {
  evaluateHomePageReadiness,
  GEO_UPDATE_MODAL_DELAY_MS,
  HOME_READINESS_INITIAL,
} from "../lib/homePageReadiness";
import { isGeographicUpdateModalEligible } from "../lib/geography/geographicUpdateLaunch";
import { supabase } from "../lib/supabaseClient";

import styles from "../styles/HomeMapFirst.module.css";

const HomeAdvancedFiltersModal = dynamic(
  () => import("../components/HomeAdvancedFiltersModal"),
  { ssr: false }
);

const FEATURED_COUNT = 12;
const FEATURED_PREVIEW_COUNT = 4;

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
  const district = getRegionLabel(getListingRegionSlug(listing));
  const haystack = `${listing?.title || ""} ${district} ${listing?.property_type || ""} ${getLifecycleStatus(listing)} ${listing?.price || ""}`;
  return haystack.toLowerCase().includes(qNorm);
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { role } = useRoleAccess(user?.id);
  const { profile } = useUserRole();

  const [listingsData, setListingsData] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchSubmitting, setSearchSubmitting] = useState(false);
  const [carouselIndexById, setCarouselIndexById] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [geoUpdateOpen, setGeoUpdateOpen] = useState(false);
  const { showTransition, dismissTransition } = useHomeLoadingTransitionGate();
  const [homeReadySignals, setHomeReadySignals] = useState(() => ({ ...HOME_READINESS_INITIAL }));
  const [transitionComplete, setTransitionComplete] = useState(false);

  const patchReadySignal = useCallback((key, value = true) => {
    setHomeReadySignals((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const isHomeReady = useMemo(
    () => evaluateHomePageReadiness(homeReadySignals),
    [homeReadySignals]
  );

  useEffect(() => {
    patchReadySignal("shell", true);
    patchReadySignal("hero", true);
    patchReadySignal("searchReady", true);
    patchReadySignal("navInteractive", true);
  }, [patchReadySignal]);

  useEffect(() => {
    if (!showTransition) setTransitionComplete(true);
  }, [showTransition]);

  useEffect(() => {
    if (!transitionComplete) return undefined;
    const timer = window.setTimeout(() => {
      if (
        isGeographicUpdateModalEligible({
          authenticated: Boolean(user?.id),
          role,
        })
      ) {
        setGeoUpdateOpen(true);
      }
    }, GEO_UPDATE_MODAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [transitionComplete, user?.id, role]);
  const [compactSearchPlaceholder, setCompactSearchPlaceholder] = useState(false);
  const featuredScrollRef = useRef(null);
  const featuredPausedRef = useRef(false);
  const { isFavorite, toggleFavorite, isBusy, isAuthenticated } = useFavorites();
  const openFavoriteSignupPrompt = useFavoriteSignupPrompt();

  const fetchListings = useCallback(async () => {
    setListingsLoading(true);
    try {
      const { data: previewData } = await fetchApprovedListingsWithImages({
        limit: FEATURED_PREVIEW_COUNT,
      });
      const normalizedPreview = (previewData || []).map((l) => ({
        ...l,
        id: String(l.id ?? ""),
        images: Array.isArray(l.images) ? l.images : [],
      }));
      setListingsData(normalizedPreview);
      patchReadySignal("featuredListingsReady", true);

      const { data: fullData } = await fetchApprovedListingsWithImages();
      const normalizedFull = (fullData || []).map((l) => ({
        ...l,
        id: String(l.id ?? ""),
        images: Array.isArray(l.images) ? l.images : [],
      }));
      if (normalizedFull.length) setListingsData(normalizedFull);
    } catch {
      patchReadySignal("featuredListingsReady", true);
    } finally {
      setListingsLoading(false);
    }
  }, [patchReadySignal]);

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(max-width: 760px)");
    const sync = () => setCompactSearchPlaceholder(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const districtListingCounts = useMemo(() => {
    const counts = {};
    for (const id of BELIZE_MAP_REGION_ORDER) {
      const slug = BELIZE_MAP_REGION_CONFIG[id]?.slug;
      if (!slug) continue;
      counts[id] = filterListings(listingsData, {
        district: slug,
        status: "all",
      }).length;
    }
    return counts;
  }, [listingsData]);

  const activeListings = useMemo(
    () => listingsData.filter(isListingActivelyAvailable),
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
    let scrollResumeTimer = 0;
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
    const onDocumentScroll = () => {
      featuredPausedRef.current = true;
      window.clearTimeout(scrollResumeTimer);
      scrollResumeTimer = window.setTimeout(() => {
        featuredPausedRef.current = false;
      }, 180);
    };
    raf = requestAnimationFrame(step);
    window.addEventListener("scroll", onDocumentScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(scrollResumeTimer);
      window.removeEventListener("scroll", onDocumentScroll);
    };
  }, [featuredLoop.length]);

  const renderHeroMap = ({ showCaption = true } = {}) => (
    <>
      {showCaption ? <p className={styles.heroMapCaption}>Explore by district</p> : null}
      <div className={styles.mapPane}>
        <div className={styles.mapPaneMapWrap}>
          <BelizeMap
            showAmbientVeil={false}
            districtListingCounts={districtListingCounts}
            onMapReady={() => patchReadySignal("mapInitialized")}
            onDistrictClick={(slug) => router.push(`/listings/district/${slug}`)}
          />
        </div>
      </div>
    </>
  );

  const renderListingCard = useCallback(
    (listing, imageSizes, { imagePriority = false, deferImageLoad = false } = {}) => {
      return (
        <ListingCard
          listing={listing}
          imageSizes={imageSizes}
          imagePriority={imagePriority}
          deferImageLoad={deferImageLoad}
          showFavoriteButton
          isFavorited={isFavorite(listing.id)}
          favoriteBusy={isBusy(listing.id)}
          onFavoriteClick={(listingId) => {
            if (!isAuthenticated) {
              openFavoriteSignupPrompt();
              return;
            }
            void toggleFavorite(listingId);
          }}
          carouselIndex={Number(carouselIndexById[listing.id] || 0)}
          onCarouselIndexChange={(nextIndex) =>
            setCarouselIndexById((prev) => ({ ...prev, [listing.id]: nextIndex }))
          }
        />
      );
    },
    [
      carouselIndexById,
      isAuthenticated,
      isBusy,
      isFavorite,
      openFavoriteSignupPrompt,
      toggleFavorite,
    ]
  );

  return (
    <div className={`${styles.page} home-map-page-root`}>
      {showTransition ? (
        <HomeMapAwakensTransition
          ready={isHomeReady}
          onResolved={() => {
            dismissTransition();
            setTransitionComplete(true);
          }}
        />
      ) : null}
      <SiteNav active="browse" />

      <main id="home-main-content" className={styles.pageMain} tabIndex={-1}>
        <section className={styles.heroSection}>
          <div className={`${styles.heroLayout} ${styles.heroLayoutMobile}`}>
            <div className={styles.mobileHeroFlow}>
              <div className={styles.mobileMapHero} aria-label="Belize property map">
                {renderHeroMap({ showCaption: false })}
              </div>
              <p className={styles.heroKicker}>EXPLORE • INVEST • THRIVE</p>

              <div className={styles.mobileSearchWrap}>
                <form
                  className={`${styles.searchShell} ${styles.heroSearchBlock} ${searchSubmitting ? styles.searchShellSubmitting : ""}`}
                  onSubmit={handleSearchSubmit}
                  aria-label="Search listings"
                >
                  <span className={styles.searchIcon} aria-hidden="true">
                    <Search />
                  </span>
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className={styles.searchInput}
                    type="search"
                    placeholder={
                      compactSearchPlaceholder
                        ? "District, type, or lifestyle…"
                        : "Explore Belize by district, property type, or lifestyle…"
                    }
                    aria-label="Search listings; Enter opens full results"
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
              </div>

              <div className={`${styles.statGrid} ${styles.heroStatsBlock}`}>
                <article className={styles.statCard}>
                  <p className={`${styles.statValue} ${listingsLoading ? styles.statValuePending : styles.statValueLive}`}>
                    {listingsLoading ? "—" : activeListings.length}
                  </p>
                  <span className={styles.statIcon} aria-hidden="true">
                    <House />
                  </span>
                  <p className={styles.statLabel}>
                    <span className={styles.statLabelDesktop}>Active Listings</span>
                    <span className={styles.statLabelMobile}>Listings</span>
                  </p>
                </article>
                <article className={styles.statCard}>
                  <p className={`${styles.statValue} ${listingsLoading ? styles.statValuePending : styles.statValueLive}`}>
                    {listingsLoading ? "—" : saleCount}
                  </p>
                  <span className={styles.statIcon} aria-hidden="true">
                    <Tag />
                  </span>
                  <p className={styles.statLabel}>For Sale</p>
                </article>
                <article className={styles.statCard}>
                  <p className={`${styles.statValue} ${listingsLoading ? styles.statValuePending : styles.statValueLive}`}>
                    {listingsLoading ? "—" : rentCount}
                  </p>
                  <span className={styles.statIcon} aria-hidden="true">
                    <Key />
                  </span>
                  <p className={styles.statLabel}>For Rent</p>
                </article>
                <article className={styles.statCard}>
                  <p className={styles.statValue}>100%</p>
                  <span className={styles.statIcon} aria-hidden="true">
                    <TrendingUp />
                  </span>
                  <p className={styles.statLabel}>
                    <span className={styles.statLabelDesktop}>Real-time Data</span>
                    <span className={styles.statLabelMobile}>Live Data</span>
                  </p>
                </article>
              </div>
            </div>

            <div className={styles.heroLeft}>
              <div className={styles.heroCopyBlock}>
                <p className={styles.heroKicker}>EXPLORE • INVEST • THRIVE</p>
                <h1 className={styles.heroHeadline}>Belize&apos;s Living Property Map</h1>
                <p className={styles.heroTrustLine}>
                  Verified listings. Real agents. One national property map.
                </p>
                <p className={styles.heroSubtext}>
                  Discover real estate opportunities across Belize. Interactive. Intelligent.
                  Always up to date.
                </p>
              </div>

              <form
                className={`${styles.searchShell} ${styles.heroSearchBlock} ${searchSubmitting ? styles.searchShellSubmitting : ""}`}
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
                  placeholder={
                    compactSearchPlaceholder
                      ? "District, type, or lifestyle…"
                      : "Explore Belize by district, property type, or lifestyle…"
                  }
                  aria-label="Search listings; Enter opens full results"
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

              <div className={`${styles.statGrid} ${styles.heroStatsBlock}`}>
                <article className={styles.statCard}>
                  <span className={styles.statIcon} aria-hidden="true">
                    <House />
                  </span>
                  <p className={`${styles.statValue} ${listingsLoading ? styles.statValuePending : styles.statValueLive}`}>
                    {listingsLoading ? "—" : activeListings.length}
                  </p>
                  <p className={styles.statLabel}>
                    <span className={styles.statLabelDesktop}>Active Listings</span>
                    <span className={styles.statLabelMobile}>Listings</span>
                  </p>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statIcon} aria-hidden="true">
                    <Tag />
                  </span>
                  <p className={`${styles.statValue} ${listingsLoading ? styles.statValuePending : styles.statValueLive}`}>
                    {listingsLoading ? "—" : saleCount}
                  </p>
                  <p className={styles.statLabel}>For Sale</p>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statIcon} aria-hidden="true">
                    <Key />
                  </span>
                  <p className={`${styles.statValue} ${listingsLoading ? styles.statValuePending : styles.statValueLive}`}>
                    {listingsLoading ? "—" : rentCount}
                  </p>
                  <p className={styles.statLabel}>For Rent</p>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statIcon} aria-hidden="true">
                    <TrendingUp />
                  </span>
                  <p className={styles.statValue}>100%</p>
                  <p className={styles.statLabel}>
                    <span className={styles.statLabelDesktop}>Real-time Data</span>
                    <span className={styles.statLabelMobile}>Live Data</span>
                  </p>
                </article>
              </div>
            </div>

            <div className={`${styles.heroRight} ${styles.heroMapDesktop}`}>{renderHeroMap()}</div>
          </div>
        </section>

        {listingsLoading ? (
          <section className={styles.featuredSection} aria-busy="true" aria-label="Loading featured listings">
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle}>Featured listings</h2>
            </div>
            <div className={styles.featuredLoadingRow}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className={`${styles.featuredCarouselItem} ${styles.cardSkeleton} skeleton`}
                  aria-hidden="true"
                />
              ))}
            </div>
          </section>
        ) : featuredLoop.length ? (
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
            </div>
            <div className={styles.featuredCarouselViewport} ref={featuredScrollRef}>
              <div className={styles.featuredCarouselTrack}>
                {featuredLoop.map((listing, idx) => (
                  <div key={`${listing.id}-${idx}`} className={styles.featuredCarouselItem}>
                    {renderListingCard(listing, "(max-width: 760px) 82vw, 296px", {
                      imagePriority: idx < 2,
                      deferImageLoad: idx >= 3,
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.featuredSection} aria-label="Featured listings">
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle}>Featured listings</h2>
            </div>
            <PremiumEmptyState
              variant="listings"
              compact
              className={styles.featuredEmptyState}
              title="Quiet for the moment"
              description="Approved listings appear in this band first. The map stays live — explore by district while inventory lands."
            />
          </section>
        )}

        <section className={styles.communitySection}>
          <article className={styles.communityCard}>
            <p className={styles.communityKicker}>Built for Belize</p>
            <h3>Join a growing community of agents and property owners</h3>
            <p>List smarter. Sell faster. Manage better.</p>
            <div className={styles.communityActions}>
              <Link className={styles.communityPrimaryBtn} href="/login?signup=1">
                Create Free Account
              </Link>
              <Link className={styles.communitySecondaryBtn} href="/learn-more">
                Learn More
              </Link>
            </div>
          </article>

          {listingsLoading ? (
            <div className={styles.recentPanel}>
              <div className={styles.sectionTitleRow}>
                <h2 className={styles.sectionTitle}>Recently added</h2>
              </div>
              <div className={styles.recentGrid} aria-busy="true" aria-label="Loading recent listings">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className={`${styles.recentGridItem} ${styles.cardSkeleton} skeleton`}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          ) : recentPool.length > 0 ? (
            <div className={styles.recentPanel}>
              <div className={styles.sectionTitleRow}>
                <h2 className={styles.sectionTitle}>Recently added</h2>
                {searchNorm ? (
                  <p className={styles.sectionSubtitle}>
                    {`Filtered locally · ${recentFiltered.length} match${recentFiltered.length === 1 ? "" : "es"}`}
                  </p>
                ) : null}
              </div>
              <div className={styles.recentGrid}>
                {recentFiltered.length === 0 ? (
                  <PremiumEmptyState
                    variant="search"
                    compact
                    className={styles.recentEmptyState}
                    title="No local matches"
                    description="Ease the search phrase above or browse featured listings for curated arrivals."
                  />
                ) : (
                  recentFiltered.map((listing) => (
                    <div key={listing.id} className={styles.recentGridItem}>
                      {renderListingCard(listing, "(max-width: 760px) 100vw, 33vw")}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <HomeAdvancedFiltersModal isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} />
      <GeographicUpdateModal
        open={geoUpdateOpen}
        onClose={() => setGeoUpdateOpen(false)}
        user={user}
        role={role}
        supabase={supabase}
      />
    </div>
  );
}
