import { useState } from "react";
import styles from "./ListingThumb.module.css";

/**
 * Card thumbnail: shows first valid image or centered "NO PHOTO".
 * @param {{ width?: number, height?: number }} [size] — pixel dimensions for the thumb box
 */
export default function ListingThumb({ listing, size = { width: 140, height: 100 } }) {
  const [failed, setFailed] = useState(false);
  const imageSrc = listing?.images?.[0]?.image_url || "/placeholder.png";
  const finalImageSrc = failed ? "/placeholder.png" : imageSrc;
  const showImage = Boolean(finalImageSrc);

  return (
    <div
      className={styles.thumb}
      style={{ width: size.width, height: size.height }}
    >
      {showImage ? (
        <img
          src={finalImageSrc}
          alt=""
          className={styles.thumbImg}
          onError={() => {
            if (finalImageSrc !== "/placeholder.png") setFailed(true);
          }}
        />
      ) : (
        <div className={styles.noPhoto}>NO PHOTO</div>
      )}
    </div>
  );
}
