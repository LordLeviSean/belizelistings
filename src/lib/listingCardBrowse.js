/**
 * Browse-surface listing card contracts — homepage Featured Listings is canonical.
 * Do not change these values without matching the homepage featured carousel.
 */

/** `sizes` passed to featured carousel cards on the homepage. */
export const FEATURED_LISTING_CARD_IMAGE_SIZES = "(max-width: 760px) 82vw, 296px";

/** Featured carousel item width cap (desktop track). */
export const FEATURED_LISTING_CARD_MAX_WIDTH_PX = 300;

/** Grid column template aligned with featured carousel card width. */
export const FEATURED_LISTING_CARD_GRID_TEMPLATE =
  "repeat(auto-fill, minmax(min(296px, 100%), 300px))";

/**
 * Minimal guard for browse cards — agent profile rows are already mapped via
 * `mapListingWithImages`; this only rejects unusable rows.
 * @param {object|null|undefined} listing
 */
export function normalizeBrowseListingCardRow(listing) {
  if (!listing || listing.id == null) return null;
  return listing;
}

/**
 * Featured-carousel parity props for browse grids (agent profile, etc.).
 * Homepage keeps its inline `renderListingCard`; this mirrors that contract.
 * @param {object} listing
 * @param {number} index
 * @param {{
 *   isFavorite: (id: string|number) => boolean,
 *   isBusy: (id: string|number) => boolean,
 *   onFavoriteClick: (id: string|number) => void,
 *   carouselIndexById: Record<string|number, number>,
 *   onCarouselIndexChange: (id: string|number, nextIndex: number) => void,
 * }} favorites
 */
export function buildFeaturedBrowseListingCardProps(listing, index, favorites) {
  const normalized = normalizeBrowseListingCardRow(listing);
  if (!normalized) return null;

  const listingId = normalized.id;

  return {
    listing: normalized,
    imageSizes: FEATURED_LISTING_CARD_IMAGE_SIZES,
    imagePriority: index < 2,
    deferImageLoad: index >= 3,
    showFavoriteButton: true,
    showShareButton: true,
    isFavorited: favorites.isFavorite(listingId),
    favoriteBusy: favorites.isBusy(listingId),
    onFavoriteClick: favorites.onFavoriteClick,
    carouselIndex: Number(favorites.carouselIndexById[listingId] || 0),
    onCarouselIndexChange: (nextIndex) => favorites.onCarouselIndexChange(listingId, nextIndex),
  };
}
