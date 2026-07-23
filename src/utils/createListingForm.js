import { getRegionLabel, normalizeRegionSlug } from "../constants/geographyLayer";
import { mapLegacyListingToGeography } from "../lib/geography/legacyGeoBackfill";
import { resolveCanonicalListingMarketType } from "../lib/listingMarketType";
import { amenitiesFromListingRow, sanitizeAmenitiesArray } from "../constants/listingAmenities";
import { isLandInventoryListing } from "./listingPresentation";

const PROPERTY_TYPES = ["house", "apartment", "condo", "land", "commercial"];

const PROPERTY_TYPE_ALIASES = Object.freeze({
  townhouse: "house",
  villa: "house",
  duplex: "house",
  "single-family": "house",
  "single family": "house",
  flat: "apartment",
  penthouse: "condo",
  plot: "land",
  parcel: "land",
  lot: "land",
  office: "commercial",
  retail: "commercial",
  industrial: "commercial",
  building: "commercial",
});

export { PROPERTY_TYPES };

/**
 * Normalize persisted property_type into create-workspace select values.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizePropertyTypeForForm(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  if (!raw) return "";
  if (PROPERTY_TYPES.includes(raw)) return raw;
  const aliased = PROPERTY_TYPE_ALIASES[raw];
  if (aliased && PROPERTY_TYPES.includes(aliased)) return aliased;
  return "";
}

/**
 * Map numeric listing columns into form strings; preserves zero.
 * @param {unknown} value
 */
export function formatListingNumericFormField(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

/**
 * Resolve For Sale / For Rent from listing row (listing_type, market_type, legacy signals).
 * @param {object} listing
 * @returns {"sale"|"rent"}
 */
export function resolveListingTypeForForm(listing = {}) {
  const market = resolveCanonicalListingMarketType(listing);
  return market === "rent" ? "rent" : "sale";
}

export const CREATE_FORM_INITIAL = Object.freeze({
  title: "",
  price: "",
  property_type: "",
  district: "",
  map_region_slug: "",
  community_id: "",
  locality_id: "",
  highway_id: "",
  highway_mile: "",
  road_corridor_id: "",
  locality_not_listed: false,
  locality_not_listed_note: "",
  listing_type: "sale",
  beds: "",
  baths: "",
  garage: "",
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
  const geo =
    listing.map_region_slug
      ? {
          map_region_slug: listing.map_region_slug,
          community_id: listing.community_id || "",
          locality_id: listing.locality_id || "",
          highway_id: listing.highway_id || "",
          road_corridor_id: listing.road_corridor_id || "",
          highway_mile:
            listing.highway_mile != null && listing.highway_mile !== ""
              ? String(listing.highway_mile)
              : "",
          locality_not_listed: Boolean(listing.locality_not_listed_text),
          locality_not_listed_note: listing.locality_not_listed_text || "",
        }
      : mapLegacyListingToGeography(listing);

  const districtSlug = normalizeRegionSlug(
    listing.subregion_slug || listing.region_slug || listing.district || ""
  );
  const districtLabel = districtSlug ? getRegionLabel(districtSlug) : "";
  const pt = normalizePropertyTypeForForm(listing.property_type);
  const { amenities, legacyFeaturesTail } = amenitiesFromListingRow(listing);
  return {
    title: String(listing.title || ""),
    price: listing.price != null && listing.price !== "" ? String(listing.price) : "",
    property_type: pt,
    district: districtLabel,
    map_region_slug: geo.map_region_slug || listing.map_region_slug || "",
    community_id: listing.community_id || geo.community_id || "",
    locality_id: listing.locality_id || geo.locality_id || "",
    highway_id: listing.highway_id || geo.highway_id || "",
    road_corridor_id: listing.road_corridor_id || "",
    highway_mile:
      listing.highway_mile != null && listing.highway_mile !== ""
        ? String(listing.highway_mile)
        : "",
    locality_not_listed: geo.locality_not_listed || false,
    locality_not_listed_note: geo.locality_not_listed_note || "",
    listing_type: resolveListingTypeForForm(listing),
    beds: formatListingNumericFormField(listing.beds),
    baths: formatListingNumericFormField(listing.baths),
    garage: formatListingNumericFormField(listing.garage),
    description: String(listing.description || ""),
    amenities,
    legacyFeaturesTail,
    square_feet: formatListingNumericFormField(listing.square_feet),
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
    map_region_slug: form.map_region_slug || "",
    community_id: form.community_id || "",
    locality_id: form.locality_id || "",
    highway_id: form.highway_id || "",
    highway_mile: form.highway_mile || "",
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
