/**
 * Next/Image quality policy for BelizeListings.
 *
 * Values MUST appear in `next.config.js` → `images.qualities` (currently **75** and **82** only).
 * We intentionally avoid a third tier (e.g. 90): two steps keep transfer predictable and match
 * calm, editorial surfaces — sharper hero/lightbox is already served by larger `sizes`, not
 * higher JPEG/WebP quant.
 *
 * Mapping:
 * - Thumbnails / rails / small chrome → {@link IMAGE_QUALITY_THUMB}
 * - Cards, browse tiles, default listing media → {@link IMAGE_QUALITY_CARD}
 * - Detail hero / large bounded media (same numeric tier as cards here) → {@link IMAGE_QUALITY_HERO}
 * - Bounded flex/gallery helpers → {@link IMAGE_QUALITY_EDITORIAL} (alias tier; same as card)
 */

/** Small thumbs, lightbox rail, dense previews */
export const IMAGE_QUALITY_THUMB = 75;

/** Listing cards, homepage property tiles, default `ListingMediaImage` */
export const IMAGE_QUALITY_CARD = 82;

/** Listing detail main stage (large viewport width; quality tier matches card policy) */
export const IMAGE_QUALITY_HERO = 82;

/** Larger bounded editorial blocks; same quant as card until config adds a third quality */
export const IMAGE_QUALITY_EDITORIAL = 82;

/** Responsive `sizes` hints — keep in sync with layout CSS where noted */
export const IMAGE_SIZES_DASHBOARD_THUMB = "96px";
export const IMAGE_SIZES_ADMIN_ROW_THUMB = "74px";
export const IMAGE_SIZES_LIGHTBOX_MAIN = "(max-width: 1920px) 95vw, 1920px";
