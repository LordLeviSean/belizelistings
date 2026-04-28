import Link from "next/link";
import styles from "./ListingCard.module.css";

function districtLabel(district = "") {
  return String(district)
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  const imageUrl = listing?.images?.[0]?.image_url || "/placeholder.png";
  const isLand = listing?.beds === 0 && listing?.baths === 0 && listing?.garage === 0;

  return (
    <div style={{ position: "relative" }}>
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
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 2,
            border: "none",
            background: "rgba(15, 17, 19, 0.86)",
            color: isFavorited ? "#ff4d6d" : "#d7dde4",
            width: 32,
            height: 32,
            borderRadius: 999,
            cursor: favoriteBusy ? "not-allowed" : "pointer",
            fontSize: 17,
            lineHeight: 1,
          }}
        >
          {isFavorited ? "♥" : "♡"}
        </button>
      ) : null}
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
            <h3 className={styles.title}>{listing.title || "Untitled listing"}</h3>
            <p className={styles.price}>{formatPrice(listing.price, listing.currency)}</p>
            <p className={styles.meta}>
              {isLand ? "Land Property" : `${listing.beds} bd · ${listing.baths} ba`}
              {" · "}
              {districtLabel(listing.district || "Unknown")}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}
