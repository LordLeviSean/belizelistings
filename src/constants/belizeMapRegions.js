import { getMapRegions } from "./geographyLayer";

/** SVG group ids and browse slugs — derived from centralized geography layer. */
const mapRegions = getMapRegions();

export const BELIZE_MAP_REGION_ORDER = mapRegions.map((region) => region.mapRegion);

export const BELIZE_MAP_REGION_CONFIG = mapRegions.reduce((acc, region) => {
  acc[region.mapRegion] = {
    label: region.label,
    slug: region.routeSlug || region.slug,
  };
  return acc;
}, { mainland_base: { label: "Mainland Base" } });
