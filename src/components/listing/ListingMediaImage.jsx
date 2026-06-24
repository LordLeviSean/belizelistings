import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { IMAGE_QUALITY_CARD } from "@/constants/imageQuality";
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
  /** Next/Image 1–100; must be in `next.config.js` `images.qualities`. Default: browse/card tier. */
  quality = IMAGE_QUALITY_CARD,
  mode = "cover",
  className = "",
  imageClassName = "",
  hoverZoom = true,
  objectPosition,
  onLoad: onLoadProp,
}) {
  const resolved = resolveListingImageUrl(src || "") || "/placeholder.jpg";
  const isLocalPreview = /^blob:/i.test(resolved) || /^data:/i.test(resolved);
  const [loaded, setLoaded] = useState(false);
  const [optimizerFallback, setOptimizerFallback] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setOptimizerFallback(false);
  }, [resolved]);

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

  const handleError = useCallback(() => {
    if (!isLocalPreview && !optimizerFallback) {
      setOptimizerFallback(true);
    }
  }, [isLocalPreview, optimizerFallback]);

  const imageCommonProps = {
    src: resolved,
    alt,
    sizes,
    quality,
    priority,
    loading: priority ? "eager" : "lazy",
    unoptimized: isLocalPreview || optimizerFallback,
    placeholder: isLocalPreview || optimizerFallback ? undefined : "blur",
    blurDataURL: isLocalPreview || optimizerFallback ? undefined : LISTING_MEDIA_BLUR_DATA_URL,
    onLoad: handleLoad,
    onError: handleError,
  };

  if (fill) {
    return (
      <span className={wrapClass}>
        {shimmer}
        <Image
          {...imageCommonProps}
          fill
          className={`${styles.image} ${styles.imageFill} ${imageClassName}`}
          style={inlineImgStyle}
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
        {...imageCommonProps}
        width={width ?? 1}
        height={height ?? 1}
        className={`${styles.image} ${imageClassName}`}
        style={{ ...inlineImgStyle, width: "100%", height: "100%" }}
      />
    </span>
  );
}
