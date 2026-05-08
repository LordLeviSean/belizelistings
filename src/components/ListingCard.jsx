import Link from "next/link";
import { Heart } from "lucide-react";
import styles from "./ListingCard.module.css";
import favoriteStyles from "../styles/FavoriteButton.module.css";
import { getRegionCaption, getRegionLabel } from "../constants/geographyLayer";
import { getListingRegionSlug } from "../utils/canonicalListing";

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
  isFavorited = false,
  onToggleFavorite,
  favoriteBusy = false,
}) {
  const firstImage = listing?.images?.[0];
  const preferredImage = typeof firstImage === "string" ? firstImage : firstImage?.image_url;
  const imageUrl =
    preferredImage && !String(preferredImage).toLowerCase().includes("map")
      ? preferredImage
      : "/placeholder.jpg";
  const isLand = listing?.beds === 0 && listing?.baths === 0 && listing?.garage === 0;
  const regionSlug = getListingRegionSlug(listing) || "unknown";
  const regionLabel = districtLabel(regionSlug);
  const regionCaption = getRegionCaption(regionSlug);

  return (
    <div>
      <Link
        href={`/listing/${listing.id}`}
        className={styles.card}
        aria-label={`View ${listing.title || "listing"}`}
      >
        <div className={`${styles.inner} safeFlexRow`}>
          <div className={styles.thumb} aria-hidden="true">
            <img src={imageUrl} alt="" loading="lazy" />
          </div>
          <div className={`${styles.info} safeFlexCol`}>
            <div className={styles.titleRow}>
              <h3 className={styles.title}>{listing.title || "Untitled listing"}</h3>
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
                  className={`${favoriteStyles.favoriteButton} ${isFavorited ? favoriteStyles.favoriteButtonActive : ""}`}
                >
                  <Heart fill={isFavorited ? "currentColor" : "none"} />
                </button>
              ) : null}
            </div>
            <p className={styles.price}>{formatPrice(listing.price, listing.currency)}</p>
            <p className={styles.meta}>
              {isLand ? "Land Property" : `${listing.beds} bd · ${listing.baths} ba`}
              {" · "}
              {regionLabel}
            </p>
            {regionCaption ? <p className={styles.regionCaption}>{regionCaption}</p> : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
