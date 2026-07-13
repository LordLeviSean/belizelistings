import { normalizeRegionSlug } from "../../constants/geographyLayer";
import {
  getAreaOptionsForMapRegion,
  getCommunityById,
  getHighwayById,
  getMapRegionBySlug,
  isHighwaySelection,
  validateHighwayMile,
} from "./belizeGeographyV1";

const LEGACY_SLUG_TO_GEO = Object.freeze({
  "belize-city": { map_region_slug: "belize", community_id: "area-belize-belize-city" },
  "san-pedro": { map_region_slug: "ambergris-caye", community_id: "area-ambergris-caye-san-pedro" },
  "caye-caulker": { map_region_slug: "caye-caulker", community_id: "area-caye-caulker-caye-caulker-village" },
  placencia: { map_region_slug: "stann-creek", community_id: "area-stann-creek-placencia" },
  belmopan: { map_region_slug: "cayo", community_id: "area-cayo-belmopan" },
  "san-ignacio": { map_region_slug: "cayo", community_id: "area-cayo-san-ignacio" },
  "santa-elena": { map_region_slug: "cayo", community_id: "area-cayo-santa-elena" },
  corozal: { map_region_slug: "corozal", community_id: "area-corozal-corozal" },
  "orange-walk": { map_region_slug: "orange-walk", community_id: "area-orange-walk-orange-walk" },
  dangriga: { map_region_slug: "stann-creek", community_id: "area-stann-creek-dangriga" },
  "punta-gorda": { map_region_slug: "toledo", community_id: "area-toledo-punta-gorda" },
  independence: { map_region_slug: "stann-creek", community_id: "area-stann-creek-independence" },
  "mango-creek": { map_region_slug: "stann-creek", community_id: "area-stann-creek-independence" },
});

export const GEO_BACKFILL_STATUS = Object.freeze({
  EXACT: "exact",
  PARTIAL: "partial",
  ALIAS: "alias",
  AMBIGUOUS: "ambiguous",
  UNMATCHED: "unmatched",
  REVIEW_REQUIRED: "review_required",
});

/**
 * Map legacy listing slugs to V1 geography fields.
 */
export function mapLegacyListingToGeography(listing = {}) {
  const sub = normalizeRegionSlug(listing.subregion_slug || "");
  const region = normalizeRegionSlug(listing.region_slug || listing.district || "");
  const district = normalizeRegionSlug(listing.district || "");

  // Ambergris + San Pedro
  if (region === "ambergris-caye" && sub === "san-pedro") {
    return {
      map_region_slug: "ambergris-caye",
      community_id: "area-ambergris-caye-san-pedro",
      locality_id: null,
      geo_backfill_status: GEO_BACKFILL_STATUS.EXACT,
    };
  }

  // Explicit subregion mappings
  const lookupSlug = sub || region || district;
  const hit = LEGACY_SLUG_TO_GEO[lookupSlug];
  if (hit) {
    return {
      map_region_slug: hit.map_region_slug,
      community_id: hit.community_id,
      locality_id: null,
      geo_backfill_status: sub ? GEO_BACKFILL_STATUS.EXACT : GEO_BACKFILL_STATUS.PARTIAL,
    };
  }

  // District-only mainland/island regions
  const mr = getMapRegionBySlug(region || district);
  if (mr) {
    return {
      map_region_slug: mr.slug,
      community_id: null,
      locality_id: null,
      geo_backfill_status: GEO_BACKFILL_STATUS.PARTIAL,
    };
  }

  return {
    map_region_slug: null,
    community_id: null,
    locality_id: null,
    geo_backfill_status: GEO_BACKFILL_STATUS.UNMATCHED,
  };
}

export function validateGeographyForm(form = {}) {
  const errors = {};
  const mapRegionSlug = normalizeRegionSlug(form.map_region_slug || "");
  if (!mapRegionSlug || !getMapRegionBySlug(mapRegionSlug)) {
    errors.map_region_slug = "Select a district or region.";
    return { ok: false, errors };
  }

  const areaId = form.community_id || form.highway_id || form.road_corridor_id || "";
  if (!areaId) {
    errors.community_id = "Select a city, town, village, highway, or area.";
    return { ok: false, errors };
  }

  const options = getAreaOptionsForMapRegion(mapRegionSlug);
  const selected = options.find((o) => o.id === areaId);
  if (!selected) {
    errors.community_id = "Selection is not valid for this region.";
    return { ok: false, errors };
  }

  if (isHighwaySelection(selected) || form.highway_id) {
    const mileCheck = validateHighwayMile(areaId, form.highway_mile);
    if (!mileCheck.ok) errors.highway_mile = mileCheck.error;
  } else if (form.locality_id) {
    const community = getCommunityById(areaId);
    if (!community) errors.locality_id = "Invalid community.";
  }

  if (form.locality_not_listed && !String(form.locality_not_listed_note || "").trim()) {
    errors.locality_not_listed_note = "Briefly describe the locality for admin review.";
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export function buildGeographyPayloadFromForm(form = {}) {
  const mapRegionSlug = normalizeRegionSlug(form.map_region_slug || "");
  const areaId = form.community_id || form.highway_id || form.road_corridor_id || "";
  const options = getAreaOptionsForMapRegion(mapRegionSlug);
  const selected = options.find((o) => o.id === areaId);

  const payload = {
    map_region_slug: mapRegionSlug,
    community_id: null,
    locality_id: form.locality_id || null,
    highway_id: null,
    highway_mile: null,
    locality_not_listed_text: form.locality_not_listed
      ? String(form.locality_not_listed_note || "").trim() || "Not Listed"
      : null,
  };

  if (selected?.kind === "highway") {
    payload.highway_id = areaId;
    payload.highway_mile = form.highway_mile != null && form.highway_mile !== ""
      ? Number(form.highway_mile)
      : null;
    payload.community_id = null;
    payload.locality_id = null;
  } else if (selected?.kind === "road_corridor") {
    payload.community_id = areaId;
  } else {
    payload.community_id = areaId;
  }

  // Legacy compat columns
  const mr = getMapRegionBySlug(mapRegionSlug);
  let district = mapRegionSlug;
  let regionSlug = mapRegionSlug;
  let subregionSlug = null;

  if (payload.community_id) {
    const community = getCommunityById(payload.community_id);
    if (community) {
      subregionSlug = community.slug;
      if (mr?.slug === "ambergris-caye" || mr?.slug === "caye-caulker") {
        regionSlug = mr.slug;
        district = community.slug;
      } else {
        district = community.slug;
        regionSlug = mr?.slug || mapRegionSlug;
      }
    }
  } else if (payload.highway_id) {
    const hw = getHighwayById(payload.highway_id);
    district = hw?.slug || mapRegionSlug;
    regionSlug = mapRegionSlug;
  }

  return {
    ...payload,
    district,
    region_slug: regionSlug,
    subregion_slug: subregionSlug,
  };
}
