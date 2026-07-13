const toSlug = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");

const titleCase = (value) =>
  String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const PLATFORM_GEOGRAPHY = [
  {
    id: "corozal",
    slug: "corozal",
    label: "Corozal",
    type: "district",
    parentDistrict: null,
    displayCaption: null,
    searchable: true,
    mapRegion: "corozal",
    hasDistrictPage: true,
    routeSlug: "corozal",
    aliases: [],
  },
  {
    id: "orange-walk",
    slug: "orange-walk",
    label: "Orange Walk",
    type: "district",
    parentDistrict: null,
    displayCaption: null,
    searchable: true,
    mapRegion: "orange_walk",
    hasDistrictPage: true,
    routeSlug: "orange-walk",
    aliases: ["orangewalk"],
  },
  {
    id: "belize",
    slug: "belize",
    label: "Belize",
    type: "district",
    parentDistrict: null,
    displayCaption: null,
    searchable: true,
    mapRegion: "belize",
    hasDistrictPage: true,
    routeSlug: "belize",
    aliases: ["belize-district"],
  },
  {
    id: "cayo",
    slug: "cayo",
    label: "Cayo",
    type: "district",
    parentDistrict: null,
    displayCaption: null,
    searchable: true,
    mapRegion: "cayo",
    hasDistrictPage: true,
    routeSlug: "cayo",
    aliases: [],
  },
  {
    id: "stann-creek",
    slug: "stann-creek",
    label: "Stann Creek",
    type: "district",
    parentDistrict: null,
    displayCaption: null,
    searchable: true,
    mapRegion: "stann_creek",
    hasDistrictPage: true,
    routeSlug: "stann-creek",
    aliases: ["stann creek"],
  },
  {
    id: "toledo",
    slug: "toledo",
    label: "Toledo",
    type: "district",
    parentDistrict: null,
    displayCaption: null,
    searchable: true,
    mapRegion: "toledo",
    hasDistrictPage: true,
    routeSlug: "toledo",
    aliases: [],
  },
  {
    id: "ambergris-caye",
    slug: "ambergris-caye",
    label: "Ambergris Caye",
    type: "region",
    parentDistrict: "belize",
    displayCaption: "Belize District",
    searchable: true,
    mapRegion: "ambergris_caye",
    hasDistrictPage: true,
    routeSlug: "ambergris-caye",
    aliases: ["ambergris caye"],
  },
  {
    id: "caye-caulker",
    slug: "caye-caulker",
    label: "Caye Caulker",
    type: "region",
    parentDistrict: "belize",
    displayCaption: "Belize District",
    searchable: true,
    mapRegion: "caye_caulker",
    hasDistrictPage: true,
    routeSlug: "caye-caulker",
    aliases: ["caye caulker"],
  },
  {
    id: "san-pedro",
    slug: "san-pedro",
    label: "San Pedro",
    type: "subregion",
    parentDistrict: "ambergris-caye",
    displayCaption: "Ambergris Caye",
    searchable: true,
    mapRegion: "ambergris_caye",
    hasDistrictPage: true,
    routeSlug: "san-pedro",
    aliases: ["san pedro town", "san pedro island"],
  },
  {
    id: "placencia",
    slug: "placencia",
    label: "Placencia",
    type: "subregion",
    parentDistrict: "stann-creek",
    displayCaption: "Stann Creek",
    searchable: true,
    mapRegion: "stann_creek",
    hasDistrictPage: true,
    routeSlug: "placencia",
    aliases: [],
  },
  {
    id: "belize-city",
    slug: "belize-city",
    label: "Belize City",
    type: "subregion",
    parentDistrict: "belize",
    displayCaption: "Belize District",
    searchable: true,
    mapRegion: "belize",
    hasDistrictPage: true,
    routeSlug: "belize-city",
    aliases: [],
  },
];

const bySlug = new Map();
for (const region of PLATFORM_GEOGRAPHY) {
  bySlug.set(region.slug, region);
  for (const alias of region.aliases || []) {
    bySlug.set(toSlug(alias), region);
  }
}

export function getRegionByAny(value) {
  const slug = toSlug(value);
  return bySlug.get(slug) || null;
}

export function normalizeRegionSlug(value) {
  const region = getRegionByAny(value);
  return region?.slug || toSlug(value);
}

export function getRegionLabel(value) {
  const region = getRegionByAny(value);
  if (region?.label) return region.label;
  const normalized = toSlug(value).replace(/-/g, " ");
  return titleCase(normalized);
}

export function getRegionCaption(value) {
  return getRegionByAny(value)?.displayCaption || null;
}

export function getParentRegion(value) {
  const region = getRegionByAny(value);
  if (!region?.parentDistrict) return null;
  return getRegionByAny(region.parentDistrict);
}

export function getParentRegionLabel(value) {
  return getParentRegion(value)?.label || null;
}

export function getMapRegionId(value) {
  return getRegionByAny(value)?.mapRegion || null;
}

export function getRegionDisplayMeta(value) {
  const region = getRegionByAny(value);
  if (!region) {
    const normalized = normalizeRegionSlug(value);
    return {
      slug: normalized,
      label: getRegionLabel(normalized),
      caption: null,
      parentLabel: null,
      type: "unknown",
    };
  }
  return {
    slug: region.slug,
    label: region.label,
    caption: region.displayCaption || null,
    parentLabel: getParentRegionLabel(region.slug),
    type: region.type,
  };
}

export function isChildRegion(value, parentValue) {
  const region = getRegionByAny(value);
  const parent = getRegionByAny(parentValue);
  if (!region || !parent) return false;
  return normalizeRegionSlug(region.parentDistrict) === parent.slug;
}

export function getRegionHierarchy(value) {
  const region = getRegionByAny(value);
  if (!region) return [];
  const chain = [region];
  let parent = getParentRegion(region.slug);
  let guard = 0;
  while (parent && guard < 8) {
    chain.push(parent);
    parent = getParentRegion(parent.slug);
    guard += 1;
  }
  return chain;
}

export function getSelectableRegions() {
  return PLATFORM_GEOGRAPHY.filter((region) => region.searchable && region.hasDistrictPage);
}

export function getMapRegions() {
  const seen = new Set();
  return PLATFORM_GEOGRAPHY.filter((region) => {
    if (!region.mapRegion) return false;
    if (seen.has(region.mapRegion)) return false;
    seen.add(region.mapRegion);
    return true;
  });
}

export function slugifyRegionInput(value) {
  return toSlug(value);
}

