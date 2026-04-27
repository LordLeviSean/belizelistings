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

export default function ListingCard({ listing }) {
  const imageUrl = listing?.images?.[0]?.image_url || "/placeholder.png";
  const isLand = listing?.beds === 0 && listing?.baths === 0 && listing?.garage === 0;

  return (
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
  );
}
