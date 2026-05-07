import { useMemo, useState, useEffect, useLayoutEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import BelizeMap from "../components/BelizeMap";
import SiteNav from "../components/SiteNav";
import useFavorites from "../hooks/useFavorites";
import { BELIZE_MAP_REGION_CONFIG, BELIZE_MAP_REGION_ORDER } from "../constants/belizeMapRegions";
import { fetchApprovedListingsWithImages } from "../lib/listingQueries";
import { filterListings } from "../utils/filterListings";
import useSeaFlowMode from "../hooks/useSeaFlowMode";

import styles from "../styles/HomeMapFirst.module.css";

function formatPrice(price, currency) {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return "Price on request";
  return `${numericPrice.toLocaleString()} ${currency || ""}`.trim();
}

export default function HomePage() {
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);
  const [listingsData, setListingsData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [carouselIndexById, setCarouselIndexById] = useState({});
  const { enabled: seaFlowModeEnabled } = useSeaFlowMode();
  const { isFavorite, toggleFavorite, isBusy, isAuthenticated } = useFavorites();

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
    () => listingsData.filter((listing) => String(listing?.status || "").toLowerCase() === "sale").length,
    [listingsData]
  );

  const rentCount = useMemo(
    () => listingsData.filter((listing) => String(listing?.status || "").toLowerCase() === "rent").length,
    [listingsData]
  );

  const showcaseListings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const searched = normalizedSearch
      ? listingsData.filter((listing) => {
          const district = BELIZE_MAP_REGION_CONFIG[listing?.district]?.label || listing?.district || "";
          const haystack = `${listing?.title || ""} ${district} ${listing?.property_type || ""} ${listing?.status || ""} ${listing?.price || ""}`;
          return haystack.toLowerCase().includes(normalizedSearch);
        })
      : listingsData;
    return searched.slice(0, 8);
  }, [listingsData, searchTerm]);

  const heroListings = useMemo(() => showcaseListings.slice(0, 3), [showcaseListings]);

  const shiftCarousel = useCallback((listingId, totalImages, direction) => {
    if (!listingId || totalImages <= 1) return;
    setCarouselIndexById((prev) => {
      const current = Number(prev[listingId] || 0);
      const next = (current + direction + totalImages) % totalImages;
      return { ...prev, [listingId]: next };
    });
  }, []);

  if (!router.isReady || !hydrated) {
    return null;
  }

  return (
    <div className={`${styles.page} home-map-page-root`}>
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

            <div className={styles.searchShell}>
              <span className={styles.searchIcon} aria-hidden="true">
                🔍
              </span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={styles.searchInput}
                type="text"
                placeholder="Search by district, price, type, or keyword..."
                aria-label="Search listings"
              />
              <button className={styles.searchFilterBtn} type="button" aria-label="Open filters">
                ☰
              </button>
            </div>

            <div className={styles.statGrid}>
              <article className={styles.statCard}>
                <span className={styles.statIcon} aria-hidden="true">
                  🏠
                </span>
                <p className={styles.statValue}>{activeListings.length}</p>
                <p className={styles.statLabel}>Active Listings</p>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statIcon} aria-hidden="true">
                  🏷️
                </span>
                <p className={styles.statValue}>{saleCount}</p>
                <p className={styles.statLabel}>For Sale</p>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statIcon} aria-hidden="true">
                  🔎
                </span>
                <p className={styles.statValue}>{rentCount}</p>
                <p className={styles.statLabel}>For Rent</p>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statIcon} aria-hidden="true">
                  📈
                </span>
                <p className={styles.statValue}>100%</p>
                <p className={styles.statLabel}>Real-time Data</p>
              </article>
            </div>
          </div>

          <div className={styles.heroRight}>
            <section
              className={`${styles.mapPane} home-map-pane ${styles.mapPaneSeaFlow} ${
                seaFlowModeEnabled ? styles.mapPaneSeaFlowEnhanced : ""
              }`}
            >
              <BelizeMap districtListingCounts={districtListingCounts} />
            </section>
            <aside className={styles.floatingInfoCard}>
              <p className={styles.floatingTitle}>BELIZE</p>
              <p className={styles.floatingItalic}>A mosaic of opportunity</p>
              <p className={styles.floatingHint}>Click on any district to explore listings</p>
              <div className={styles.avatarRow} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
              <p className={styles.floatingUsers}>
                {Math.max(128, activeListings.length)}+ agents & owners already using BelizeListings
              </p>
            </aside>
          </div>
        </section>

        <section className={styles.featureStrip} aria-label="Platform features">
          <article className={styles.featureCard}>
            <span className={styles.featureIcon} aria-hidden="true">
              📋
            </span>
            <div>
              <h3>No Duplicate Listings</h3>
              <p>Every property is verified and unique.</p>
            </div>
          </article>
          <article className={styles.featureCard}>
            <span className={styles.featureIcon} aria-hidden="true">
              📊
            </span>
            <div>
              <h3>Real-time Analytics</h3>
              <p>Make smarter decisions with live market insights.</p>
            </div>
          </article>
          <article className={styles.featureCard}>
            <span className={styles.featureIcon} aria-hidden="true">
              💼
            </span>
            <div>
              <h3>Property Management</h3>
              <p>Manage your properties, tenants and performance.</p>
            </div>
          </article>
          <article className={styles.featureCard}>
            <span className={styles.featureIcon} aria-hidden="true">
              👤
            </span>
            <div>
              <h3>Owner &amp; Agent Dashboard</h3>
              <p>Powerful tools to list, manage and scale.</p>
            </div>
          </article>
        </section>

        <section className={styles.communitySection}>
          <article className={styles.communityCard}>
            <p className={styles.communityKicker}>Built for Belize</p>
            <h3>Join a growing community of agents and property owners</h3>
            <p>
              List smarter. Sell faster. Manage better.
            </p>
            <div className={styles.communityActions}>
              <Link className={styles.communityPrimaryBtn} href="/signup">
                Create Free Account
              </Link>
              <Link className={styles.communitySecondaryBtn} href="/about">
                Learn More
              </Link>
            </div>
          </article>

          <div className={styles.showcaseGrid}>
            {heroListings.map((listing) => {
              const listingImages = (listing?.images || [])
                .map((item) => (typeof item === "string" ? item : item?.image_url))
                .filter(Boolean)
                .filter((img) => !String(img).toLowerCase().includes("map"));
              const imageCount = listingImages.length;
              const activeIndex = imageCount ? Number(carouselIndexById[listing.id] || 0) % imageCount : 0;
              const imageUrl = imageCount ? listingImages[activeIndex] : "/placeholder.jpg";
              const district =
                BELIZE_MAP_REGION_CONFIG[listing?.district]?.label || listing?.district || "Belize";
              const status = String(listing?.status || "").toLowerCase() === "rent" ? "FOR RENT" : "FOR SALE";
              const favorited = isFavorite(listing.id);
              const favoriteBusy = isBusy(listing.id);

              return (
                <Link key={listing.id} href={`/listing/${listing.id}`} className={styles.propertyCard}>
                  <div className={styles.propertyMedia}>
                    <Image
                      src={imageUrl}
                      alt={listing?.title || "Listing"}
                      fill
                      sizes="(max-width: 760px) 100vw, 33vw"
                    />
                    <span className={styles.propertyBadge}>{status}</span>
                    <button
                      type="button"
                      className={`${styles.propertyFav} ${favorited ? styles.propertyFavActive : ""}`}
                      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                      aria-pressed={favorited}
                      disabled={favoriteBusy}
                      onClick={(event) => {
                        event.preventDefault();
                        if (!isAuthenticated) {
                          void router.push("/login");
                          return;
                        }
                        void toggleFavorite(listing.id);
                      }}
                    >
                      {favorited ? "♥" : "♡"}
                    </button>
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
                          ‹
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
                          ›
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
                      <span>🛏 {listing?.beds || 0} bd</span>
                      <span>🛁 {listing?.baths || 0} ba</span>
                      <span>📍 {district}</span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
