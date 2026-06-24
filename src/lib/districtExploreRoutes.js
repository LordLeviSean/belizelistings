import { normalizeRegionSlug } from "@/constants/geographyLayer";

/**
 * Path to the district browse shell (map + listings) for a district or subregion slug.
 * Matches patterns used in `BelizeMap`, `index`, and `listings/district/[district].jsx`.
 *
 * @param {string} districtOrSlug Raw listing district, region_slug, or alias.
 * @returns {string | null} e.g. `/listings/district/cayo`, or null if input normalizes to empty.
 */
export function getDistrictExploreHref(districtOrSlug) {
  const slug = normalizeRegionSlug(String(districtOrSlug ?? "").trim());
  if (!slug) return null;
  return `/listings/district/${slug}`;
}
