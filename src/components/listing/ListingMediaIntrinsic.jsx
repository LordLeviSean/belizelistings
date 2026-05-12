import { useCallback, useState } from "react";
import { resolveListingImageUrl } from "@/utils/listingImage";
import styles from "./ListingMediaImage.module.css";

/**
 * Large / unconstrained listing photo (e.g. fullscreen lightbox) — native `img` for intrinsic sizing.
 */
export default function ListingMediaIntrinsic({
  src,
  alt = "",
  className = "",
  style = {},
  onLoad,
}) {
  const resolved = resolveListingImageUrl(src || "") || "/placeholder.jpg";
  const [loaded, setLoaded] = useState(false);
  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoad?.();
  }, [onLoad]);

  return (
    <span
      className={`${styles.wrap} ${loaded ? styles.wrapLoaded : ""} ${className}`}
      style={{ display: "inline-block", maxWidth: "95vw", maxHeight: "90vh", ...style }}
    >
      <span className={styles.shimmer} aria-hidden />
      <img
        src={resolved}
        alt={alt}
        className={styles.image}
        loading="eager"
        decoding="async"
        style={{
          display: "block",
          maxWidth: "95vw",
          maxHeight: "90vh",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          borderRadius: 12,
        }}
        onLoad={handleLoad}
      />
    </span>
  );
}
