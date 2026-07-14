/**
 * Belize Geography V1 — runtime API over approved seed data.
 */
import { BELIZE_GEOGRAPHY_V1 } from "../../constants/belizeGeographyV1Data";
import { normalizeRegionSlug } from "../../constants/geographyLayer";

const DATA = BELIZE_GEOGRAPHY_V1;

/** Approved display order for Create Listing District / Region (not alphabetical). */
export const MAP_REGION_SELECTOR_ORDER = Object.freeze([
  "corozal",
  "orange-walk",
  "belize",
  "cayo",
  "stann-creek",
  "toledo",
  "ambergris-caye",
  "caye-caulker",
]);

const byMapRegionId = new Map();
const byCommunityId = new Map();
const byLocalityId = new Map();
const byHighwayId = new Map();
const byAlias = new Map();
const communitiesByMapRegion = new Map();
const localitiesByCommunity = new Map();
const highwaysByMapRegion = new Map();
const roadCorridorsByMapRegion = new Map();

function normAlias(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
}

function initIndexes() {
  if (byMapRegionId.size) return;

  for (const mr of DATA.mapRegions) {
    byMapRegionId.set(mr.id, mr);
    byMapRegionId.set(mr.slug, mr);
    communitiesByMapRegion.set(mr.id, []);
    highwaysByMapRegion.set(mr.id, []);
    roadCorridorsByMapRegion.set(mr.id, []);
  }

  for (const c of DATA.communities) {
    byCommunityId.set(c.area_id || c.id, c);
    const list = communitiesByMapRegion.get(c.map_region_id) || [];
    list.push(c);
    communitiesByMapRegion.set(c.map_region_id, list);
  }

  for (const loc of DATA.localities) {
    const id = loc.locality_id || loc.id;
    byLocalityId.set(id, loc);
    const parent = loc.area_id;
    const list = localitiesByCommunity.get(parent) || [];
    list.push(loc);
    localitiesByCommunity.set(parent, list);
  }

  for (const hw of DATA.highways) {
    const id = hw.area_id || hw.id;
    byHighwayId.set(id, hw);
    for (const slug of hw.map_region_slugs || []) {
      const mrId = `map-${slug}`;
      const list = highwaysByMapRegion.get(mrId) || [];
      list.push(hw);
      highwaysByMapRegion.set(mrId, list);
    }
  }

  for (const rc of DATA.roadCorridors) {
    for (const slug of rc.map_region_slugs || []) {
      const mrId = `map-${slug}`;
      const list = roadCorridorsByMapRegion.get(mrId) || [];
      list.push(rc);
      roadCorridorsByMapRegion.set(mrId, list);
    }
  }

  for (const a of DATA.aliases) {
    const key = `${normAlias(a.alias)}::${a.map_region_id || "*"}`;
    const bucket = byAlias.get(key) || [];
    bucket.push(a);
    byAlias.set(key, bucket);
  }

  // Sort children for stable UI
  for (const [, list] of communitiesByMapRegion) {
    list.sort(sortByDisplayName);
  }
  for (const [, list] of localitiesByCommunity) {
    list.sort(sortByDisplayName);
  }
}

initIndexes();

export function getGeographyVersion() {
  return DATA.version;
}

export function getGeographyTotals() {
  return DATA.totals || {};
}

/** Eight interactive map regions in approved Create Listing order. */
export function getMapRegionsForSelector() {
  initIndexes();
  const order = new Map(MAP_REGION_SELECTOR_ORDER.map((slug, index) => [slug, index]));
  return [...DATA.mapRegions].sort(
    (a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99)
  );
}

export function getMapRegionOptionsForSelector() {
  return getMapRegionsForSelector().map((mr) => ({
    id: mr.slug,
    slug: mr.slug,
    name: mr.name,
    label:
      mr.slug === "ambergris-caye" || mr.slug === "caye-caulker"
        ? mr.name
        : `${mr.name} District`,
  }));
}

export function getMapRegionBySlug(slug) {
  initIndexes();
  const s = normalizeRegionSlug(slug);
  return DATA.mapRegions.find((mr) => mr.slug === s) || null;
}

export function getMapRegionById(id) {
  initIndexes();
  return byMapRegionId.get(id) || null;
}

export function getCommunityById(id) {
  initIndexes();
  return byCommunityId.get(id) || null;
}

export function getLocalityById(id) {
  initIndexes();
  return byLocalityId.get(id) || null;
}

export function getHighwayById(id) {
  initIndexes();
  return byHighwayId.get(id) || null;
}

function communityTypeLabel(c) {
  if (!c) return "Community";
  const raw = c.ui_tier || c.location_type || "community";
  if (raw === "mennonite_community") return "Village";
  if (raw === "road_corridor") return "Road Corridor";
  if (raw === "highway") return "Highway";
  if (raw === "city") return "City";
  if (raw === "town") return "Town";
  if (raw === "village") return "Village";
  if (raw === "caye") return "Caye";
  const titled = String(raw).replace(/_/g, " ");
  return titled.charAt(0).toUpperCase() + titled.slice(1);
}

function formatCommunityOptionLabel(c) {
  return `${c.name} — ${communityTypeLabel(c)}`;
}

function sortByDisplayName(a, b) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** Second-tier options: settlements, highways, road corridors for a map region. */
export function getAreaOptionsForMapRegion(mapRegionSlug) {
  initIndexes();
  const mr = getMapRegionBySlug(mapRegionSlug);
  if (!mr) return [];
  const settlements = (communitiesByMapRegion.get(mr.id) || []).map((c) => ({
    id: c.area_id || c.id,
    slug: c.slug,
    name: c.name,
    kind: "community",
    location_type: c.location_type,
    label: formatCommunityOptionLabel(c),
    map_region_id: mr.id,
  }));
  const highways = (highwaysByMapRegion.get(mr.id) || []).map((hw) => ({
    id: hw.area_id || hw.id,
    slug: hw.slug,
    name: hw.name,
    kind: "highway",
    location_type: "highway",
    label: `${hw.name} — Highway`,
    map_region_id: mr.id,
    approx_mile_max: hw.approx_mile_max,
  }));
  const roads = (roadCorridorsByMapRegion.get(mr.id) || []).map((rc) => ({
    id: rc.id,
    slug: rc.slug,
    name: rc.name,
    kind: "road_corridor",
    location_type: "road_corridor",
    label: `${rc.name} — Road Corridor`,
    map_region_id: mr.id,
  }));
  return [...settlements, ...highways, ...roads].sort(sortByDisplayName);
}

export function getLocalityOptionsForCommunity(communityId) {
  initIndexes();
  return (localitiesByCommunity.get(communityId) || []).map((loc) => ({
    id: loc.locality_id || loc.id,
    slug: loc.slug,
    name: loc.name,
    location_type: loc.location_type,
    label: loc.name,
    community_id: loc.area_id,
  }));
}

export function isHighwaySelection(selection) {
  return selection?.kind === "highway" || String(selection?.location_type || "").includes("highway");
}

export function validateHighwayMile(highwayId, mileRaw, { required = false } = {}) {
  const hw = getHighwayById(highwayId);
  if (!hw) return { ok: false, error: "Select a highway." };
  const raw = String(mileRaw ?? "").trim();
  if (!raw) {
    if (required) return { ok: false, error: "Enter a mile marker." };
    return { ok: true, mile: null };
  }
  const mile = Number(raw);
  if (!Number.isFinite(mile) || mile <= 0) {
    return { ok: false, error: "Enter a valid mile marker." };
  }
  const max = Number(hw.approx_mile_max || 0);
  if (max > 0 && mile > max) {
    return { ok: false, error: `Mile must be between 1 and ${max} for ${hw.name}.` };
  }
  return { ok: true, mile };
}

export function resolveAlias(alias, mapRegionSlug) {
  initIndexes();
  const mr = mapRegionSlug ? getMapRegionBySlug(mapRegionSlug) : null;
  const keys = [
    `${normAlias(alias)}::${mr?.id || "*"}`,
    `${normAlias(alias)}::*`,
  ];
  for (const key of keys) {
    const hits = byAlias.get(key);
    if (hits?.length) return hits[0];
  }
  return null;
}

export function getMapRegionLabel(mapRegionSlug) {
  const mr = getMapRegionBySlug(mapRegionSlug);
  if (!mr) return "";
  if (mr.slug === "ambergris-caye" || mr.slug === "caye-caulker") return mr.name;
  return `${mr.name} District`;
}

export { formatCommunityOptionLabel, communityTypeLabel };
