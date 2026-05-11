import Link from "next/link";
import { Heart } from "lucide-react";
import ListingMediaImage from "./listing/ListingMediaImage";
import ShareListingIconButton from "./ShareListingIconButton";
import styles from "./ListingCard.module.css";
import favoriteStyles from "../styles/FavoriteButton.module.css";
import { getRegionCaption, getRegionLabel } from "../constants/geographyLayer";
import { getListingRegionSlug } from "../utils/canonicalListing";
import { normalizeListingImageEntry } from "../utils/listingImage";
import { isLandInventoryListing } from "../utils/listingPresentation";
import LandParcelGlyph from "./icons/LandParcelGlyph";

function districtLabel(district = "") {
  return getRegionLabel(district);
}

function formatPrice(price, currency) {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return "Price on request";
  return `${numericPrice.toLocaleString()} ${currency || ""}`.trim();
}

export default function ListingCard({
  listing,
  showFavoriteButton = false,
  showShareButton = true,
  isFavorited = false,
  favoriteSurface = "default",
  onToggleFavorite,
  favoriteBusy = false,
}) {
  const firstImage = listing?.images?.[0];
  const preferredImage = typeof firstImage === "string" ? firstImage : firstImage?.image_url;
  const imageUrl =
    preferredImage && !String(preferredImage).toLowerCase().includes("map")
      ? preferredImage
      : "/placeholder.jpg";
  const isLand = isLandInventoryListing(listing);
  const regionSlug = getListingRegionSlug(listing) || "unknown";
  const regionLabel = districtLabel(regionSlug);
  const regionCaption = getRegionCaption(regionSlug);

  return (
    <div>
      <Link
        href={`/listing/${listing.id}`}
        className={`listingCard ${styles.card} ${isLand ? styles.cardLand : ""}`}
        aria-label={`View ${listing.title || "listing"}`}
      >
        <div className={`${styles.inner} safeFlexRow`}>
          <div className={`${styles.thumb} listingCardThumbHover`} aria-hidden="true">
            <ListingMediaImage src={imageUrl} alt="" fill sizes="78px" hoverZoom />
          </div>
          <div className={`${styles.info} safeFlexCol`}>
            <div className={styles.titleRow}>
              <h3 className={styles.title}>{listing.title || "Untitled listing"}</h3>
              {showFavoriteButton || showShareButton ? (
                <div className={styles.cardActions}>
                  {showFavoriteButton ? (
                    <button
                      type="button"
                      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                      aria-pressed={isFavorited}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleFavorite?.(listing.id);
                      }}
                      disabled={favoriteBusy}
                      className={[
                        favoriteStyles.favoriteButton,
                        isFavorited ? favoriteStyles.favoriteButtonActive : "",
                        favoriteSurface === "saved" ? favoriteStyles.favoriteButtonWarm : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Heart fill={isFavorited ? "currentColor" : "none"} />
                    </button>
                  ) : null}
                  {showShareButton ? (
                    <ShareListingIconButton
                      listingId={listing.id}
                      title={listing.title}
                      surface={favoriteSurface === "saved" ? "saved" : "default"}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className={styles.price}>{formatPrice(listing.price, listing.currency)}</p>
            <p className={`${styles.meta} ${isLand ? styles.metaLand : ""}`}>
              {isLand ? (
                <span className={styles.metaLandRow}>
                  <LandParcelGlyph className={styles.metaGlyph} />
                  <span>Land</span>
                  <span className={styles.metaSep} aria-hidden>
                    ·
                  </span>
                  <span>{regionLabel}</span>
                </span>
              ) : (
                <>
                  {listing.beds} bd · {listing.baths} ba · {regionLabel}
                </>
              )}
            </p>
            {regionCaption ? <p className={styles.regionCaption}>{regionCaption}</p> : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
