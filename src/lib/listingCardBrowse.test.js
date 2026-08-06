/** @jest-environment node */

import {
  FEATURED_LISTING_CARD_IMAGE_SIZES,
  buildFeaturedBrowseListingCardProps,
  normalizeBrowseListingCardRow,
} from "./listingCardBrowse";

describe("listingCardBrowse", () => {
  const listing = {
    id: "l-1",
    title: "Sea View Villa",
    price: 450000,
    currency: "BZD",
    listing_type: "sale",
    verification_status: "verified",
    images: ["/listings/a.jpg"],
  };

  test("featured image sizes match homepage featured carousel contract", () => {
    expect(FEATURED_LISTING_CARD_IMAGE_SIZES).toBe("(max-width: 760px) 82vw, 296px");
  });

  test("normalizeBrowseListingCardRow rejects rows without id", () => {
    expect(normalizeBrowseListingCardRow(null)).toBeNull();
    expect(normalizeBrowseListingCardRow({ title: "x" })).toBeNull();
    expect(normalizeBrowseListingCardRow(listing)).toBe(listing);
  });

  test("buildFeaturedBrowseListingCardProps mirrors homepage featured card props", () => {
    const favorites = {
      isFavorite: jest.fn(() => true),
      isBusy: jest.fn(() => false),
      onFavoriteClick: jest.fn(),
      carouselIndexById: { "l-1": 2 },
      onCarouselIndexChange: jest.fn(),
    };

    const first = buildFeaturedBrowseListingCardProps(listing, 0, favorites);
    const deferred = buildFeaturedBrowseListingCardProps(listing, 4, favorites);

    expect(first).toMatchObject({
      listing,
      imageSizes: FEATURED_LISTING_CARD_IMAGE_SIZES,
      imagePriority: true,
      deferImageLoad: false,
      showFavoriteButton: true,
      showShareButton: true,
      isFavorited: true,
      favoriteBusy: false,
      carouselIndex: 2,
    });
    expect(deferred?.imagePriority).toBe(false);
    expect(deferred?.deferImageLoad).toBe(true);

    first?.onCarouselIndexChange(1);
    expect(favorites.onCarouselIndexChange).toHaveBeenCalledWith("l-1", 1);
  });

  test("missing optional listing fields still produce card props", () => {
    const sparse = { id: "sparse-1" };
    const props = buildFeaturedBrowseListingCardProps(sparse, 1, {
      isFavorite: () => false,
      isBusy: () => false,
      onFavoriteClick: () => {},
      carouselIndexById: {},
      onCarouselIndexChange: () => {},
    });
    expect(props?.listing).toBe(sparse);
    expect(props?.showShareButton).toBe(true);
  });
});
