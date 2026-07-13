/**
 * Canonical search & discovery filter system (Sprint 2.2).
 * Single source of truth for URL parsing, query building, client-side filtering, sorting, and chip labels.
 *
 * @see docs/discovery/search-architecture.md
 * @see docs/discovery/extension-points.md — saved searches, recommendations, analytics hooks
 */
import {
  getRegionByAny,
  getRegionLabel,
  isChildRegion,
  normalizeRegionSlug,
} from "../constants/geographyLayer";
import { getLifecycleStatus, getListingRegionSlug } from "../utils/canonicalListing";
import { filterListings } from "../utils/filterListings";
import { isListingCardVerified } from "../utils/listingVerification";
import { listingMatchesGeographyFilters, geographyFilterChipLabels } from "./geography/geographySearchFilters";
import { formatListingLocation } from "./geography/formatListingLocation";
import { cleanQuery } from "../utils/queryStringify";

/**
 * @typedef {object} SearchFilterState
 * @property {string} q
 * @property {string} district
 * @property {string} subregion
 * @property {string} mapRegion
 * @property {string} communityId
 * @property {string} localityId
 * @property {"all"|"sale"|"rent"} market
 * @property {string} minPrice
 * @property {string} maxPrice
 * @property {string} beds
 * @property {string} baths
 * @property {string} propertyType
 * @property {boolean} verifiedOnly
 * @property {string} sort
 */

export const SEARCH_SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export const PROPERTY_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "house", label: "House" },
  { value: "condo", label: "Condo" },
  { value: "land", label: "Land" },
  { value: "apartment", label: "Apartment" },
  { value: "commercial", label: "Commercial" },
];

/** @returns {SearchFilterState} */
export function getDefaultSearchFilters() {
  return {
    q: "",
    district: "",
    subregion: "",
    mapRegion: "",
    communityId: "",
    localityId: "",
    market: "all",
    minPrice: "",
    maxPrice: "",
    beds: "",
    baths: "",
    propertyType: "",
    verifiedOnly: false,
    sort: "newest",
  };
}

/** @param {unknown} v */
function qv(v) {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

/**
 * Parse Next.js router query into canonical filter state.
 * @param {import("next/router").NextRouter["query"] | Record<string, unknown>} query
 * @param {{ isReady?: boolean }} [options]
 * @returns {SearchFilterState}
 */
export function parseSearchFiltersFromQuery(query, { isReady = true } = {}) {
  if (!isReady) return getDefaultSearchFilters();

  const marketRaw = String(qv(query.market ?? query.status) || "all").toLowerCase().trim();
  const market =
    marketRaw === "rent" || marketRaw === "for-rent" || marketRaw === "for rent"
      ? "rent"
      : marketRaw === "sale" || marketRaw === "for-sale" || marketRaw === "for sale"
        ? "sale"
        : "all";

  const sortRaw = String(qv(query.sort) || "newest").trim();
  const sort = SEARCH_SORT_OPTIONS.some((o) => o.value === sortRaw) ? sortRaw : "newest";

  return {
    q: String(qv(query.q ?? query.query) || "").trim(),
    district: String(qv(query.district) || "").trim(),
    subregion: String(qv(query.subregion) || "").trim(),
    mapRegion: String(qv(query.region ?? query.mapRegion) || qv(query.district) || "").trim(),
    communityId: String(qv(query.community ?? query.communityId) || "").trim(),
    localityId: String(qv(query.locality ?? query.localityId) || "").trim(),
    market,
    minPrice: String(qv(query.minPrice) || "").trim(),
    maxPrice: String(qv(query.maxPrice) || "").trim(),
    beds: String(qv(query.beds) || "").trim(),
    baths: String(qv(query.baths) || "").trim(),
    propertyType: String(qv(query.type ?? query.propertyType) || "").trim(),
    verifiedOnly: qv(query.verified) === "1" || qv(query.verified) === "true",
    sort,
  };
}

/**
 * Build router query object from filter state (omits defaults).
 * @param {SearchFilterState} filters
 */
export function buildSearchRouterQuery(filters) {
  return cleanQuery({
    q: filters.q?.trim() || undefined,
    district: filters.district || filters.mapRegion || undefined,
    subregion: filters.subregion || undefined,
    region: filters.mapRegion || filters.district || undefined,
    community: filters.communityId || undefined,
    locality: filters.localityId || undefined,
    market: filters.market && filters.market !== "all" ? filters.market : undefined,
    minPrice: filters.minPrice || undefined,
    maxPrice: filters.maxPrice || undefined,
    beds: filters.beds || undefined,
    baths: filters.baths || undefined,
    type: filters.propertyType || undefined,
    verified: filters.verifiedOnly ? "1" : undefined,
    sort: filters.sort && filters.sort !== "newest" ? filters.sort : undefined,
  });
}

/** @param {string} queryNorm Lowercased trimmed query */
export function listingMatchesSearchQuery(listing, queryNorm) {
  if (!queryNorm) return true;
  const district = formatListingLocation(listing) || getRegionLabel(getListingRegionSlug(listing));
  const haystack = `${listing?.title || ""} ${district} ${listing?.property_type || ""} ${getLifecycleStatus(listing)} ${listing?.price || ""}`;
  return haystack.toLowerCase().includes(queryNorm);
}

function listingMatchesSubregion(listing, filters) {
  const normalizedDistrict = normalizeRegionSlug(filters.district);
  const normalizedSubregion = normalizeRegionSlug(filters.subregion);
  if (
    !normalizedSubregion ||
    !getRegionByAny(normalizedSubregion) ||
    !isChildRegion(normalizedSubregion, normalizedDistrict)
  ) {
    return true;
  }
  return normalizeRegionSlug(getListingRegionSlug(listing)) === normalizedSubregion;
}

function listingMatchesPropertyType(listing, propertyType) {
  if (!propertyType) return true;
  const typeValue = String(
    listing?.property_type || listing?.listing_type || listing?.type || ""
  ).toLowerCase();
  return typeValue.includes(String(propertyType).toLowerCase());
}

/**
 * Apply canonical filters to in-memory listing rows (post Supabase fetch).
 * @param {object[]} listings
 * @param {SearchFilterState} filters
 */
export function applySearchFilters(listings, filters) {
  const numericOrNull = (value) => {
    if (value === "" || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const statusForFilter =
    filters.market === "rent" ? "rent" : filters.market === "sale" ? "for-sale" : "all";

  return filterListings(listings, {
    district: filters.district || null,
    status: statusForFilter,
    minPrice: numericOrNull(filters.minPrice),
    maxPrice: numericOrNull(filters.maxPrice),
    beds: numericOrNull(filters.beds),
    baths: numericOrNull(filters.baths),
  }).filter((listing) => {
    if (!listingMatchesGeographyFilters(listing, filters)) return false;
    if (!listingMatchesSubregion(listing, filters)) return false;
    if (!listingMatchesPropertyType(listing, filters.propertyType)) return false;
    if (filters.verifiedOnly && !isListingCardVerified(listing)) return false;
    const qNorm = String(filters.q || "").trim().toLowerCase();
    if (qNorm && !listingMatchesSearchQuery(listing, qNorm)) return false;
    return true;
  });
}

/** @param {object[]} listings @param {string} [sortBy] */
export function sortSearchResults(listings, sortBy = "newest") {
  const rows = [...listings];
  if (sortBy === "price-asc") {
    return rows.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  }
  if (sortBy === "price-desc") {
    return rows.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  }
  return rows.sort(
    (a, b) =>
      new Date(b.created_at || b.updated_at || 0).getTime() -
      new Date(a.created_at || a.updated_at || 0).getTime()
  );
}

/** @param {SearchFilterState} filters @returns {{ key: string, label: string }[]} */
export function getActiveFilterChips(filters) {
  const chips = [];
  const q = String(filters.q || "").trim();
  if (q) chips.push({ key: "q", label: `"${q}"` });

  if (filters.communityId) {
    const c = geographyFilterChipLabels({ communityId: filters.communityId });
    chips.push(...c);
  }
  if (filters.localityId) {
    const l = geographyFilterChipLabels({ localityId: filters.localityId });
    chips.push(...l.filter((x) => x.key === "localityId"));
  }
  if (filters.mapRegion || filters.district) {
    const r = geographyFilterChipLabels({ mapRegion: filters.mapRegion || filters.district });
    chips.push(...r.filter((x) => x.key === "mapRegion"));
  }
  if (filters.subregion) {
    chips.push({ key: "subregion", label: getRegionLabel(filters.subregion) });
  }
  if (filters.market === "sale") chips.push({ key: "market", label: "For sale" });
  if (filters.market === "rent") chips.push({ key: "market", label: "For rent" });
  if (filters.minPrice) chips.push({ key: "minPrice", label: `Min ${Number(filters.minPrice).toLocaleString()} BZD` });
  if (filters.maxPrice) chips.push({ key: "maxPrice", label: `Max ${Number(filters.maxPrice).toLocaleString()} BZD` });
  if (filters.beds) chips.push({ key: "beds", label: `${filters.beds}+ beds` });
  if (filters.baths) chips.push({ key: "baths", label: `${filters.baths}+ baths` });
  if (filters.propertyType) {
    const match = PROPERTY_TYPE_OPTIONS.find((o) => o.value === filters.propertyType);
    chips.push({ key: "propertyType", label: match?.label || filters.propertyType });
  }
  if (filters.verifiedOnly) chips.push({ key: "verifiedOnly", label: "Verified only" });
  if (filters.sort && filters.sort !== "newest") {
    const match = SEARCH_SORT_OPTIONS.find((o) => o.value === filters.sort);
    chips.push({ key: "sort", label: match?.label || filters.sort });
  }
  return chips;
}

/** @param {SearchFilterState} filters */
export function hasActiveSearchFilters(filters) {
  const defaults = getDefaultSearchFilters();
  return (
    filters.q !== defaults.q ||
    filters.district !== defaults.district ||
    filters.subregion !== defaults.subregion ||
    filters.mapRegion !== defaults.mapRegion ||
    filters.communityId !== defaults.communityId ||
    filters.localityId !== defaults.localityId ||
    filters.market !== defaults.market ||
    filters.minPrice !== defaults.minPrice ||
    filters.maxPrice !== defaults.maxPrice ||
    filters.beds !== defaults.beds ||
    filters.baths !== defaults.baths ||
    filters.propertyType !== defaults.propertyType ||
    filters.verifiedOnly !== defaults.verifiedOnly ||
    filters.sort !== defaults.sort
  );
}

/** Remove one chip key from filter state. @param {SearchFilterState} filters @param {string} chipKey */
export function removeFilterChip(filters, chipKey) {
  const next = { ...filters };
  switch (chipKey) {
    case "q":
      next.q = "";
      break;
    case "district":
      next.district = "";
      next.mapRegion = "";
      next.communityId = "";
      next.localityId = "";
      break;
    case "mapRegion":
      next.mapRegion = "";
      next.district = "";
      next.communityId = "";
      next.localityId = "";
      break;
    case "communityId":
      next.communityId = "";
      next.localityId = "";
      break;
    case "localityId":
      next.localityId = "";
      break;
    case "subregion":
      next.subregion = "";
      break;
    case "market":
      next.market = "all";
      break;
    case "minPrice":
      next.minPrice = "";
      break;
    case "maxPrice":
      next.maxPrice = "";
      break;
    case "beds":
      next.beds = "";
      break;
    case "baths":
      next.baths = "";
      break;
    case "propertyType":
      next.propertyType = "";
      break;
    case "verifiedOnly":
      next.verifiedOnly = false;
      break;
    case "sort":
      next.sort = "newest";
      break;
    default:
      break;
  }
  return next;
}
