import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Bath, BedDouble, Heart, MapPin, ShieldCheck } from "lucide-react";
import { IMAGE_QUALITY_CARD } from "@/constants/imageQuality";
import ListingMediaImage from "./listing/ListingMediaImage";
import ShareListingIconButton from "./ShareListingIconButton";
import homeStyles from "../styles/HomeMapFirst.module.css";
import favoriteStyles from "../styles/FavoriteButton.module.css";
import { BELIZE_MAP_REGION_CONFIG } from "../constants/belizeMapRegions";
import { formatListingLocation } from "@/lib/geography/formatListingLocation";
import { getRegionCaption, getRegionLabel, normalizeRegionSlug } from "../constants/geographyLayer";
import { getListingRegionSlug, getLifecycleStatus } from "../utils/canonicalListing";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";
import { normalizeListingImageEntry } from "../utils/listingImage";
import { isLandInventoryListing } from "../utils/listingPresentation";
import { isListingCardVerified } from "../utils/listingVerification";
import LandParcelGlyph from "./icons/LandParcelGlyph";

/**
 * Canonical BelizeListings listing card — single source of truth for all browse surfaces.
 * Optional `?debugCardHits=1`: mounts prev/next hit-zone buttons on single-image cards too
 * (ghost / non-interactive) for layout inspection in DevTools.
 */

/** Horizontal distance (px) to count as a gallery swipe vs. a tap-through to the listing. */
const SWIPE_MIN_PX = 44;
/** Ignore swipes that are mostly vertical (scrolling the page). */
const SWIPE_MAX_VERTICAL_PX = 72;

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
  const lc = getLifecycleStatus(listing);
  if (lc === LISTING_LIFECYCLE.RECENTLY_SOLD || lc === LISTING_LIFECYCLE.SOLD) {
    return "RECENTLY SOLD";
  }
  if (lc === LISTING_LIFECYCLE.RECENTLY_RENTED || lc === LISTING_LIFECYCLE.RENTED) {
    return "RECENTLY RENTED";
  }
  return getListingMarketKind(listing) === "rent" ? "FOR RENT" : "FOR SALE";
}

function districtLabel(district = "") {
  const normalized = normalizeRegionSlug(district);
  return BELIZE_MAP_REGION_CONFIG[normalized]?.label || getRegionLabel(normalized);
}

export default function ListingCard({
  listing,
  imageSizes = "(max-width: 520px) 100vw, (max-width: 760px) 50vw, (max-width: 980px) 42vw, 400px",
  imagePriority = false,
  deferImageLoad = false,
  /** When true, no link to listing detail — Create preview & other static surfaces. */
  disableNavigation = false,
  showFavoriteButton = false,
  showShareButton = true,
  isFavorited = false,
  favoriteBusy = false,
  favoriteSurface = "default",
  onFavoriteClick,
  /** Alias for onFavoriteClick (search surface). */
  onToggleFavorite,
  carouselIndex,
  onCarouselIndexChange,
}) {
  const [localCarouselIndex, setLocalCarouselIndex] = useState(0);
  const consumeNextLinkClick = useRef(false);
  const cardRootRef = useRef(null);
  const swipePointerDown = useRef(false);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);

  const handleFavoriteClick = onFavoriteClick || onToggleFavorite;

  const [shouldLoadImage, setShouldLoadImage] = useState(imagePriority || !deferImageLoad);

  useEffect(() => {
    setShouldLoadImage(imagePriority || !deferImageLoad);
  }, [imagePriority, deferImageLoad, listing?.id]);

  useEffect(() => {
    if (!deferImageLoad || shouldLoadImage) return undefined;
    const node = cardRootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShouldLoadImage(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoadImage(true);
          observer.disconnect();
        }
      },
      { rootMargin: "260px", threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [deferImageLoad, shouldLoadImage, listing?.id]);

  const listingImages = useMemo(
    () =>
      (listing?.images || [])
        .map((item) => normalizeListingImageEntry(item))
        .filter(Boolean)
        .filter((url) => !String(url).toLowerCase().includes("map")),
    [listing?.images]
  );

  const imageCount = listingImages.length;

  const router = useRouter();
  const debugCardHits =
    router.isReady &&
    (router.query.debugCardHits === "1" ||
      String(router.query.debugCardHits || "").toLowerCase() === "true");
  const showGalleryNavZones = imageCount > 1 || debugCardHits;
  const ghostGalleryNavZones = debugCardHits && imageCount <= 1;

  const activeIndex = imageCount
    ? Number((typeof carouselIndex === "number" ? carouselIndex : localCarouselIndex) || 0) % imageCount
    : 0;

  const setActiveIndex = useCallback(
    (nextIndex) => {
      if (!imageCount) return;
      const normalized = ((nextIndex % imageCount) + imageCount) % imageCount;
      if (typeof onCarouselIndexChange === "function") {
        onCarouselIndexChange(normalized);
      } else {
        setLocalCarouselIndex(normalized);
      }
    },
    [imageCount, onCarouselIndexChange]
  );

  const shiftCarousel = useCallback(
    (direction) => {
      if (imageCount <= 1) return;
      setActiveIndex(activeIndex + direction);
    },
    [activeIndex, imageCount, setActiveIndex]
  );

  const onMediaPointerDown = useCallback(
    (event) => {
      if (imageCount <= 1) return;
      const t = event.target;
      if (t instanceof Element && t.closest("button")) return;
      swipePointerDown.current = true;
      swipeStartX.current = event.clientX;
      swipeStartY.current = event.clientY;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    },
    [imageCount]
  );

  const onMediaPointerUp = useCallback(
    (event) => {
      if (!swipePointerDown.current || imageCount <= 1) {
        swipePointerDown.current = false;
        return;
      }
      swipePointerDown.current = false;
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* ignore */
      }

      const dx = event.clientX - swipeStartX.current;
      const dy = event.clientY - swipeStartY.current;
      if (Math.abs(dy) > SWIPE_MAX_VERTICAL_PX) return;
      if (Math.abs(dx) < SWIPE_MIN_PX) return;

      consumeNextLinkClick.current = true;
      shiftCarousel(dx < 0 ? 1 : -1);
    },
    [imageCount, shiftCarousel]
  );

  const onMediaPointerCancel = useCallback(() => {
    swipePointerDown.current = false;
  }, []);

  const onLinkClickCapture = useCallback((event) => {
    if (!consumeNextLinkClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    consumeNextLinkClick.current = false;
  }, []);

  const imageUrl = imageCount ? listingImages[activeIndex] : "/placeholder.jpg";
  const status = detectListingBadge(listing);
  const isRentBadge = status === "FOR RENT";
  const isRecentlyClosedBadge = status === "RECENTLY SOLD" || status === "RECENTLY RENTED";
  const isVerified = isListingCardVerified(listing);
  const locationLabel = formatListingLocation(listing) || districtLabel(getListingRegionSlug(listing) || "belize");
  const districtCaption = listing.map_region_slug ? null : getRegionCaption(getListingRegionSlug(listing));

  const isLand = useMemo(() => isLandInventoryListing(listing), [listing]);

  const bedsN = Number(listing?.beds);
  const bathsN = Number(listing?.baths);
  const showBeds = Number.isFinite(bedsN) && bedsN > 0;
  const showBaths = Number.isFinite(bathsN) && bathsN > 0;

  const outerClass = [homeStyles.propertyCard, isLand ? homeStyles.propertyCardLand : ""]
    .filter(Boolean)
    .join(" ");

  const cardInner = (
    <>
      <div
        className={homeStyles.propertyMedia}
        role={imageCount > 1 ? "group" : undefined}
        aria-label={
          imageCount > 1
            ? `Photos for ${listing?.title || "listing"}, ${activeIndex + 1} of ${imageCount}. Swipe sideways on touch. On desktop, narrow bands on the left and right of the photo change images; the center opens the listing.`
            : undefined
        }
        onPointerDown={onMediaPointerDown}
        onPointerUp={onMediaPointerUp}
        onPointerCancel={onMediaPointerCancel}
      >
        <ListingMediaImage
          key={imageUrl}
          src={shouldLoadImage ? imageUrl : "/placeholder.jpg"}
          alt={listing?.title || "Listing"}
          fill
          sizes={imageSizes}
          priority={imagePriority && shouldLoadImage}
          hoverZoom
          quality={IMAGE_QUALITY_CARD}
        />

        {showGalleryNavZones ? (
          <>
            <button
              type="button"
              className={[
                homeStyles.cardGalleryNavHitPrev,
                ghostGalleryNavZones ? homeStyles.cardGalleryNavHitGhost : "",
              ]
                .filter(Boolean)
                .join(" ")}
              tabIndex={-1}
              aria-label="Previous photo"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                shiftCarousel(-1);
              }}
            />
            <button
              type="button"
              className={[
                homeStyles.cardGalleryNavHitNext,
                ghostGalleryNavZones ? homeStyles.cardGalleryNavHitGhost : "",
              ]
                .filter(Boolean)
                .join(" ")}
              tabIndex={-1}
              aria-label="Next photo"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                shiftCarousel(1);
              }}
            />
          </>
        ) : null}

        <div className={homeStyles.propertyBadgeStack}>
          <span
            className={`${homeStyles.propertyBadge} ${
              isRecentlyClosedBadge
                ? homeStyles.propertyBadgeRecentlyClosed
                : isRentBadge
                  ? homeStyles.propertyBadgeRent
                  : homeStyles.propertyBadgeSale
            }`}
          >
            {status}
          </span>
          <span
            className={[
              homeStyles.verificationBadge,
              isVerified ? homeStyles.verificationBadgeVerified : homeStyles.verificationBadgeUnverified,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <ShieldCheck aria-hidden="true" />
            {isVerified ? "Verified" : "Unverified"}
          </span>
        </div>

        {showFavoriteButton || showShareButton ? (
          <span className={homeStyles.propertyActionsCluster}>
            {showFavoriteButton ? (
              <button
                type="button"
                className={[
                  favoriteStyles.favoriteButton,
                  isFavorited ? favoriteStyles.favoriteButtonActive : "",
                  favoriteSurface === "saved" ? favoriteStyles.favoriteButtonWarm : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={isFavorited}
                disabled={favoriteBusy}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleFavoriteClick?.(listing.id);
                }}
              >
                <Heart fill={isFavorited ? "currentColor" : "none"} />
              </button>
            ) : null}
            {showShareButton ? (
              <ShareListingIconButton
                listingId={listing.id}
                title={listing?.title}
                surface={favoriteSurface === "saved" ? "saved" : "default"}
              />
            ) : null}
          </span>
        ) : null}

        {imageCount > 1 ? (
          <div className={homeStyles.carouselDots} aria-hidden="true">
            {listingImages.map((_, dotIndex) => (
              <span
                key={`${listing.id}-dot-${dotIndex}`}
                className={`${homeStyles.carouselDot} ${
                  dotIndex === activeIndex ? homeStyles.carouselDotActive : ""
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className={homeStyles.propertyBody}>
        <h4>{listing?.title || "Belize Property"}</h4>
        <p className={homeStyles.propertyPrice}>
          {formatPrice(listing?.price, listing?.currency || "BZD")}
        </p>
        <p className={`${homeStyles.propertyMeta} ${isLand ? homeStyles.propertyMetaLand : ""}`}>
          {isLand ? (
            <span className={homeStyles.propertyMetaLandRow}>
              <LandParcelGlyph className={homeStyles.propertyMetaLandGlyph} />
              <span>Land</span>
              <span className={homeStyles.propertyMetaLandSep} aria-hidden>
                ·
              </span>
              <MapPin />
              <span>{locationLabel}</span>
            </span>
          ) : (
            <>
              {showBeds ? (
                <span>
                  <BedDouble /> {bedsN} bd
                </span>
              ) : null}
              {showBaths ? (
                <span>
                  <Bath /> {bathsN} ba
                </span>
              ) : null}
              <span>
                <MapPin /> {locationLabel}
              </span>
            </>
          )}
        </p>
        {districtCaption ? <p className={homeStyles.propertyRegionCaption}>{districtCaption}</p> : null}
      </div>
    </>
  );

  if (disableNavigation) {
    return (
      <div
        ref={cardRootRef}
        className={outerClass}
        role="group"
        aria-label={`Preview: ${listing?.title || "Belize property"}`}
      >
        {cardInner}
      </div>
    );
  }

  return (
    <Link
      ref={cardRootRef}
      href={`/listing/${listing.id}`}
      className={outerClass}
      aria-label={`View ${listing?.title || "Belize property"}`}
      onClickCapture={onLinkClickCapture}
    >
      {cardInner}
    </Link>
  );
}
