import { getRegionLabel, normalizeRegionSlug } from "../constants/geographyLayer";
import { amenitiesFromListingRow, sanitizeAmenitiesArray } from "../constants/listingAmenities";
import { isLandInventoryListing } from "./listingPresentation";

const PROPERTY_TYPES = ["house", "apartment", "condo", "land", "commercial"];

export const CREATE_FORM_INITIAL = Object.freeze({
  title: "",
  price: "",
  property_type: "",
  district: "",
  listing_type: "sale",
  beds: "",
  baths: "",
  description: "",
  amenities: [],
  legacyFeaturesTail: "",
  square_feet: "",
});

/**
 * Map a listings row (+ optional joined images) into create-workspace form fields.
 * District select uses human labels from geographyLayer.
 */
export function mapListingRowToCreateForm(listing = {}) {
  const districtSlug = normalizeRegionSlug(
    listing.subregion_slug || listing.region_slug || listing.district || ""
  );
  const districtLabel = districtSlug ? getRegionLabel(districtSlug) : "";
  const pt = String(listing.property_type || "").toLowerCase();
  const { amenities, legacyFeaturesTail } = amenitiesFromListingRow(listing);
  return {
    title: String(listing.title || ""),
    price: listing.price != null && listing.price !== "" ? String(listing.price) : "",
    property_type: PROPERTY_TYPES.includes(pt) ? pt : "",
    district: districtLabel,
    listing_type: listing.listing_type === "rent" ? "rent" : "sale",
    beds:
      listing.beds != null && Number(listing.beds) > 0 ? String(listing.beds) : "",
    baths:
      listing.baths != null && Number(listing.baths) > 0 ? String(listing.baths) : "",
    description: String(listing.description || ""),
    amenities,
    legacyFeaturesTail,
    square_feet:
      listing.square_feet != null && listing.square_feet !== ""
        ? String(listing.square_feet)
        : "",
  };
}

/**
 * Build a listing-shaped object for `ListingCard` preview (Create workspace).
 * @param {{}} form
 * @param {Array} remoteImages
 * @param {string[]} pendingLocalUrls
 * @param {string} [persistedListingId] — draft row id after first save; omit or empty uses placeholder `preview` until FABs can target a real listing.
 */
export function createSyntheticListingForPreview(form, remoteImages, pendingLocalUrls, persistedListingId) {
  const remoteRows = remoteImages || [];
  const remoteUrls = remoteRows.map((x) => x.image_url || x.url).filter(Boolean);
  const pending = (pendingLocalUrls || []).filter(Boolean);
  /** Single ordered pipeline: matches grid order & keeps intel + Next/Image in sync */
  const urls = [...remoteUrls, ...pending];

  const districtSlug = normalizeRegionSlug(form.district || "");
  const listingType = form.listing_type === "rent" ? "rent" : "sale";
  const land = isLandInventoryListing({
    property_type: form.property_type,
    listing_type: form.listing_type,
    market_type: form.market_type,
    category: form.category,
  });
  const amenities = sanitizeAmenitiesArray(form.amenities || []);
  const legacy = String(form.legacyFeaturesTail || "").trim();
  const features =
    legacy && amenities.length
      ? `${legacy}, ${amenities.join(", ")}`
      : legacy || (amenities.length ? amenities.join(", ") : "");

  const bedsPreview = land ? null : Number(form.beds) || 0;
  const bathsPreview = land ? null : Number(form.baths) || 0;

  const previewId = String(persistedListingId || "").trim() || "preview";

  return {
    id: previewId,
    title: form.title?.trim() || "Listing title",
    price: Number(form.price) || 0,
    currency: "BZD",
    beds: bedsPreview,
    baths: bathsPreview,
    district: districtSlug || form.district,
    property_type: String(form.property_type || "").trim(),
    listing_type: listingType,
    /** Helps homepage-style card badge match production listing rows */
    market_type: listingType === "rent" ? "rent" : "sale",
    description: form.description?.trim() || "",
    amenities,
    features,
    images: urls,
    listing_images: urls.map((image_url, position) => ({ image_url, position })),
    garage: land ? null : 0,
    status: "draft",
    lifecycle_status: "draft",
  };
}
