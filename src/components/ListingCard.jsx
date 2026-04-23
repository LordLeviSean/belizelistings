import { useState } from "react";
import Link from "next/link";
import styles from "./ListingCard.module.css";

const districtLabel = (district) =>
  district
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export default function ListingCard({ listing }) {
  const imageUrl = listing?.images?.[0]?.image_url || "/placeholder.png";
  const [loadFailed, setLoadFailed] = useState(false);
  const imageSrc = loadFailed ? "/placeholder.png" : imageUrl;
  const showImage = Boolean(imageSrc);
  const isLand = listing.beds === 0 && listing.baths === 0 && listing.garage === 0;

  return (
    <Link href={`/listing/${listing.id}`} className={styles.card} aria-label={`View ${listing.title}`}>
      <div className={`${styles.image} ${!showImage ? styles.imagePlaceholder : ""}`} aria-hidden="true">
        {showImage ? (
          <img
            src={imageSrc}
            alt=""
            className={styles.imageTag}
            onError={() => {
              if (imageSrc !== "/placeholder.png") setLoadFailed(true);
            }}
          />
        ) : (
          <div className={styles.noImage}>NO PHOTO</div>
        )}
      </div>
      <div className={styles.content}>
        <p className={styles.price}>
          {listing.price.toLocaleString()} {listing.currency}
        </p>
        <p className={styles.meta}>{isLand ? "Land Property" : `${listing.beds} bd · ${listing.baths} ba`}</p>
        <p className={styles.location}>{districtLabel(listing.district)}</p>
      </div>
    </Link>
  );
}
