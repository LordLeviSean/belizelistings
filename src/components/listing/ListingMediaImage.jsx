import Image from "next/image";
import { useCallback, useState } from "react";
import { resolveListingImageUrl } from "@/utils/listingImage";
import { LISTING_MEDIA_BLUR_DATA_URL } from "@/utils/listingMediaBlur";
import styles from "./ListingMediaImage.module.css";

/**
 * Canonical listing photo for browse surfaces (Next/Image + LQIP + shimmer).
 * Use `fill` inside a `position: relative` + bounded parent, or `width`/`height` for fixed tiles.
 */
export default function ListingMediaImage({
  src,
  alt = "",
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  /** Next/Image 1–100; higher = sharper (larger transfer). Default tuned for listing surfaces. */
  quality = 80,
  mode = "cover",
  className = "",
  imageClassName = "",
  hoverZoom = true,
  objectPosition,
  onLoad: onLoadProp,
}) {
  const resolved = resolveListingImageUrl(src || "") || "/placeholder.jpg";
  const [loaded, setLoaded] = useState(false);
  const handleLoad = useCallback(
    (event) => {
      setLoaded(true);
      onLoadProp?.(event);
    },
    [onLoadProp]
  );

  const wrapClass = [
    styles.wrap,
    fill ? styles.wrapFill : "",
    loaded ? styles.wrapLoaded : "",
    hoverZoom ? styles.mediaHoverZoom : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const objectFit = mode === "contain" ? "contain" : "cover";
  const objPos =
    objectPosition ?? (mode === "cover" ? "center 42%" : "center center");

  const inlineImgStyle = {
    objectFit,
    objectPosition: objPos,
  };

  const shimmer = (
    <span className={styles.shimmer} aria-hidden />
  );

  if (fill) {
    return (
      <span className={wrapClass}>
        {shimmer}
        <Image
          src={resolved}
          alt={alt}
          fill
          sizes={sizes}
          quality={quality}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          placeholder="blur"
          blurDataURL={LISTING_MEDIA_BLUR_DATA_URL}
          className={`${styles.image} ${styles.imageFill} ${imageClassName}`}
          style={inlineImgStyle}
          onLoad={handleLoad}
        />
      </span>
    );
  }

  if (width == null || height == null) {
    console.warn("ListingMediaImage: provide width+height when fill is false");
  }

  return (
    <span
      className={wrapClass}
      style={width != null && height != null ? { width, height } : undefined}
    >
      {shimmer}
      <Image
        src={resolved}
        alt={alt}
        width={width ?? 1}
        height={height ?? 1}
        sizes={sizes}
        quality={quality}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        placeholder="blur"
        blurDataURL={LISTING_MEDIA_BLUR_DATA_URL}
        className={`${styles.image} ${imageClassName}`}
        style={{ ...inlineImgStyle, width: "100%", height: "100%" }}
        onLoad={handleLoad}
      />
    </span>
  );
}
