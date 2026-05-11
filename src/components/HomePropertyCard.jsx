import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bath, BedDouble, ChevronLeft, ChevronRight, Heart, MapPin } from "lucide-react";
import ListingMediaImage from "./listing/ListingMediaImage";
import ShareListingIconButton from "./ShareListingIconButton";
import homeStyles from "../styles/HomeMapFirst.module.css";
import favoriteStyles from "../styles/FavoriteButton.module.css";
import { BELIZE_MAP_REGION_CONFIG } from "../constants/belizeMapRegions";
import { getRegionCaption, getRegionLabel, normalizeRegionSlug } from "../constants/geographyLayer";
import { getListingRegionSlug } from "../utils/canonicalListing";
import { normalizeListingImageEntry } from "../utils/listingImage";
import { isLandInventoryListing } from "../utils/listingPresentation";
import LandParcelGlyph from "./icons/LandParcelGlyph";

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

function districtLabel(district = "") {
  const normalized = normalizeRegionSlug(district);
  return BELIZE_MAP_REGION_CONFIG[normalized]?.label || getRegionLabel(normalized);
}

export default function HomePropertyCard({
  listing,
  imageSizes = "(max-width: 760px) 100vw, (max-width: 980px) 50vw, 33vw",
  imagePriority = false,
  /** When true, renders as a static preview (no link to listing detail) — create-workspace parity */
  disableNavigation = false,
  showFavoriteButton = false,
  showShareButton = true,
  isFavorited = false,
  favoriteBusy = false,
  favoriteSurface = "default",
  onFavoriteClick,
  carouselIndex,
  onCarouselIndexChange,
}) {
  const [localCarouselIndex, setLocalCarouselIndex] = useState(0);
  const swipeStartX = useRef(0);

  const listingImages = useMemo(
    () =>
      (listing?.images || [])
        .map((item) => normalizeListingImageEntry(item))
        .filter(Boolean)
        .filter((url) => !String(url).toLowerCase().includes("map")),
    [listing?.images]
  );

  const imageCount = listingImages.length;
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

  const imageUrl = imageCount ? listingImages[activeIndex] : "/placeholder.jpg";
  const status = detectListingBadge(listing);
  const isRentBadge = status === "FOR RENT";
  const canonicalRegionSlug = getListingRegionSlug(listing) || "belize";
  const district = districtLabel(canonicalRegionSlug);
  const districtCaption = getRegionCaption(canonicalRegionSlug);

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
        onTouchStart={(event) => {
          swipeStartX.current = event.changedTouches?.[0]?.clientX || 0;
        }}
        onTouchEnd={(event) => {
          const endX = event.changedTouches?.[0]?.clientX || 0;
          const deltaX = endX - swipeStartX.current;
          if (Math.abs(deltaX) < 32) return;
          shiftCarousel(deltaX < 0 ? 1 : -1);
        }}
      >
        <ListingMediaImage
          key={imageUrl}
          src={imageUrl}
          alt={listing?.title || "Listing"}
          fill
          sizes={imageSizes}
          priority={imagePriority}
          hoverZoom
        />

        <span
          className={`${homeStyles.propertyBadge} ${
            isRentBadge ? homeStyles.propertyBadgeRent : homeStyles.propertyBadgeSale
          }`}
        >
          {status}
        </span>

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
                  onFavoriteClick?.(listing.id);
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
          <>
            <button
              type="button"
              className={`${homeStyles.propertyArrowBtn} ${homeStyles.propertyArrowLeft}`}
              aria-label="Show previous image"
              onClick={(event) => {
                event.preventDefault();
                shiftCarousel(-1);
              }}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className={`${homeStyles.propertyArrowBtn} ${homeStyles.propertyArrowRight}`}
              aria-label="Show next image"
              onClick={(event) => {
                event.preventDefault();
                shiftCarousel(1);
              }}
            >
              <ChevronRight />
            </button>
          </>
        ) : null}

        {imageCount > 1 ? (
          <div className={homeStyles.carouselDots} aria-hidden="true">
            {listingImages.map((_, dotIndex) => (
              <button
                type="button"
                key={`${listing.id}-dot-${dotIndex}`}
                className={`${homeStyles.carouselDot} ${
                  dotIndex === activeIndex ? homeStyles.carouselDotActive : ""
                }`}
                onClick={(event) => {
                  event.preventDefault();
                  setActiveIndex(dotIndex);
                }}
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
              <span>{district}</span>
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
                <MapPin /> {district}
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
      href={`/listing/${listing.id}`}
      className={outerClass}
      aria-label={`View ${listing?.title || "Belize property"}`}
    >
      {cardInner}
    </Link>
  );
}

