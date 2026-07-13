import {
  getCommunityById,
  getHighwayById,
  getLocalityById,
  getMapRegionBySlug,
  getMapRegionLabel,
} from "./belizeGeographyV1";
import { getRegionLabel, normalizeRegionSlug } from "../../constants/geographyLayer";

/**
 * Centralized listing location formatter for all platform surfaces.
 */
export function formatListingLocation(listing = {}) {
  if (!listing) return "";

  const mapRegionSlug = normalizeRegionSlug(
    listing.map_region_slug || listing.region_slug || listing.district || ""
  );
  const communityId = listing.community_id || null;
  const localityId = listing.locality_id || null;
  const highwayId = listing.highway_id || null;
  const highwayMile = listing.highway_mile;

  const mr = getMapRegionBySlug(mapRegionSlug);
  const community = communityId ? getCommunityById(communityId) : null;
  const locality = localityId ? getLocalityById(localityId) : null;
  const highway = highwayId ? getHighwayById(highwayId) : null;

  if (highway && highwayMile != null && highwayMile !== "") {
    const regionLabel = mr ? getMapRegionLabel(mr.slug) : getRegionLabel(mapRegionSlug);
    return `Mile ${highwayMile}, ${highway.name}, ${regionLabel.replace(/ District$/, "")}`;
  }

  const parts = [];
  if (locality?.name) parts.push(locality.name);
  if (community?.name) parts.push(community.name);

  if (mr) {
    if (mr.slug === "ambergris-caye" || mr.slug === "caye-caulker") {
      if (!community && parts.length === 0) parts.push(mr.name);
      else if (community && !locality) {
        return `${community.name}, ${mr.name}`;
      }
      if (parts.length) return `${parts.join(", ")}, ${mr.name}`;
      return mr.name;
    }
    const districtName = mr.name;
    if (parts.length >= 2) return `${parts[0]}, ${parts[1]}, ${districtName}`;
    if (parts.length === 1) return `${parts[0]}, ${districtName}`;
    return getMapRegionLabel(mr.slug);
  }

  // Legacy fallback
  const legacySlug = normalizeRegionSlug(
    listing.subregion_slug || listing.region_slug || listing.district || ""
  );
  if (legacySlug) return getRegionLabel(legacySlug);
  return "";
}

export function formatListingLocationShort(listing = {}) {
  const full = formatListingLocation(listing);
  if (!full) return "";
  const parts = full.split(",").map((p) => p.trim());
  if (parts.length <= 2) return full;
  return parts.slice(0, 2).join(", ");
}
