/**
 * Geography-aware listing filter matching (V1.0 discovery).
 */
import { normalizeRegionSlug, isChildRegion } from "../../constants/geographyLayer";
import { getCommunityById, getLocalityById, getMapRegionBySlug } from "./belizeGeographyV1";
import { mapLegacyListingToGeography } from "./legacyGeoBackfill";
import { getListingRegionSlug } from "../../utils/canonicalListing";

export function resolveListingGeographyFields(listing = {}) {
  if (listing.map_region_slug) {
    return {
      map_region_slug: listing.map_region_slug,
      community_id: listing.community_id || null,
      locality_id: listing.locality_id || null,
      highway_id: listing.highway_id || null,
    };
  }
  const mapped = mapLegacyListingToGeography(listing);
  return {
    map_region_slug: mapped.map_region_slug,
    community_id: mapped.community_id,
    locality_id: mapped.locality_id || null,
    highway_id: listing.highway_id || null,
  };
}

/**
 * @param {object} listing
 * @param {{ mapRegion?: string, communityId?: string, localityId?: string, district?: string, subregion?: string }} filters
 */
export function listingMatchesGeographyFilters(listing, filters = {}) {
  const geo = resolveListingGeographyFields(listing);
  const mapRegion = normalizeRegionSlug(filters.mapRegion || filters.district || "");
  const communityId = String(filters.communityId || "").trim();
  const localityId = String(filters.localityId || "").trim();
  const legacySub = normalizeRegionSlug(filters.subregion || "");

  if (localityId) {
    if (geo.locality_id !== localityId) return false;
  }

  if (communityId) {
    if (geo.community_id !== communityId) return false;
  }

  if (mapRegion) {
    const listingMr = normalizeRegionSlug(geo.map_region_slug || "");
    if (listingMr && listingMr === mapRegion) return true;

    // Legacy URL compat: district/subregion slugs
    const listingSlug = normalizeRegionSlug(getListingRegionSlug(listing));
    if (listingSlug === mapRegion || isChildRegion(listingSlug, mapRegion)) return true;
    if (legacySub && listingSlug === legacySub) return true;
    return false;
  }

  if (legacySub) {
    const listingSlug = normalizeRegionSlug(getListingRegionSlug(listing));
    return listingSlug === legacySub;
  }

  return true;
}

export function geographyFilterChipLabels(filters = {}) {
  const chips = [];
  const mr = filters.mapRegion || filters.district;
  if (mr) {
    const region = getMapRegionBySlug(mr);
    chips.push({ key: "mapRegion", label: region?.name || mr });
  }
  if (filters.communityId) {
    const c = getCommunityById(filters.communityId);
    chips.push({ key: "communityId", label: c?.name || filters.communityId });
  }
  if (filters.localityId) {
    const loc = getLocalityById(filters.localityId);
    chips.push({ key: "localityId", label: loc?.name || filters.localityId });
  }
  return chips;
}
