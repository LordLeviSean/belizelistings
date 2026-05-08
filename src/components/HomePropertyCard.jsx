import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bath, BedDouble, ChevronLeft, ChevronRight, Heart, MapPin } from "lucide-react";
import homeStyles from "../styles/HomeMapFirst.module.css";
import favoriteStyles from "../styles/FavoriteButton.module.css";
import { BELIZE_MAP_REGION_CONFIG } from "../constants/belizeMapRegions";
import { getRegionCaption, getRegionLabel, normalizeRegionSlug } from "../constants/geographyLayer";
import { getListingRegionSlug } from "../utils/canonicalListing";

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
  showFavoriteButton = false,
  isFavorited = false,
  favoriteBusy = false,
  onFavoriteClick,
  carouselIndex,
  onCarouselIndexChange,
}) {
  const [localCarouselIndex, setLocalCarouselIndex] = useState(0);
  const swipeStartX = useRef(0);

  const listingImages = useMemo(
    () =>
      (listing?.images || [])
        .map((item) => (typeof item === "string" ? item : item?.image_url))
        .filter(Boolean)
        .filter((img) => !String(img).toLowerCase().includes("map")),
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

  return (
    <Link
      href={`/listing/${listing.id}`}
      className={homeStyles.propertyCard}
      aria-label={`View ${listing?.title || "Belize property"}`}
    >
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
        <Image src={imageUrl} alt={listing?.title || "Listing"} fill sizes={imageSizes} />

        <span
          className={`${homeStyles.propertyBadge} ${
            isRentBadge ? homeStyles.propertyBadgeRent : homeStyles.propertyBadgeSale
          }`}
        >
          {status}
        </span>

        {showFavoriteButton ? (
          <span className={homeStyles.propertyFavoriteWrap}>
            <button
              type="button"
              className={`${favoriteStyles.favoriteButton} ${
                isFavorited ? favoriteStyles.favoriteButtonActive : ""
              }`}
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
        <p className={homeStyles.propertyMeta}>
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
        {districtCaption ? <p className={homeStyles.propertyRegionCaption}>{districtCaption}</p> : null}
      </div>
    </Link>
  );
}

