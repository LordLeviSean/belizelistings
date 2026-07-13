#!/usr/bin/env node
/**
 * Build production Belize Geography V1 runtime module + SQL seed from approved v3 JSON.
 * Run: node scripts/build-belize-geography-v1.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const V3_JSON = path.join(ROOT, "docs/geography/belize-v1-location-seed.preview.v3.json");
const OUT_JS = path.join(ROOT, "src/constants/belizeGeographyV1Data.js");
const OUT_SQL = path.join(ROOT, "supabase/seeds/belize_geography_v1_seed.sql");

const seed = JSON.parse(fs.readFileSync(V3_JSON, "utf8"));
const locations = seed.locations || [];

const mapRegions = locations.filter((l) => l.level === "map_region");
const communities = locations.filter((l) => l.level === "community");
const localities = locations.filter((l) => l.level === "locality");
const highways = locations.filter((l) => l.level === "highway");
const roadCorridors = locations.filter((l) => l.level === "road_corridor");

const aliasEntries = [];
for (const loc of [...communities, ...localities, ...highways, ...roadCorridors]) {
  const aliases = loc.aliases || [];
  for (const alias of aliases) {
    aliasEntries.push({
      alias,
      target_id: loc.area_id || loc.locality_id || loc.id,
      target_level: loc.level,
      map_region_id: loc.map_region_id || (loc.map_region_slugs && loc.map_region_slugs[0] ? `map-${loc.map_region_slugs[0]}` : null),
    });
  }
}

// Mango Creek → Independence (from seed metadata)
if (seed.mango_creek_independence_decision) {
  aliasEntries.push({
    alias: "Mango Creek",
    target_id: seed.mango_creek_independence_decision.area_id,
    target_level: "community",
    map_region_id: "map-stann-creek",
  });
}

const highwaySections = [];
for (const hw of highways) {
  for (const mile of hw.named_mile_examples || []) {
    const m = String(mile).replace(/[^\d.]/g, "");
    if (m) highwaySections.push({ highway_id: hw.area_id || hw.id, mile_number: Number(m), label: mile });
  }
}

const payload = {
  version: seed.version || "1.0",
  generated_at: new Date().toISOString(),
  mango_creek_independence_decision: seed.mango_creek_independence_decision,
  hopeville_decision: seed.hopeville_decision,
  highway_mile_strategy: seed.highway_mile_strategy,
  duplicate_place_names: seed.duplicate_place_names,
  totals: seed.totals || {},
  mapRegions,
  communities,
  localities,
  highways,
  roadCorridors,
  highwaySections,
  aliases: aliasEntries,
};

const js = `/* eslint-disable */
/** Auto-generated from belize-v1-location-seed.preview.v3.json — do not edit manually. */
export const BELIZE_GEOGRAPHY_V1 = ${JSON.stringify(payload, null, 0)};
export default BELIZE_GEOGRAPHY_V1;
`;

fs.mkdirSync(path.dirname(OUT_JS), { recursive: true });
fs.writeFileSync(OUT_JS, js);

// SQL seed (compact inserts for migration)
function sqlEscape(s) {
  return String(s ?? "").replace(/'/g, "''");
}

const sqlLines = [
  "-- Auto-generated Belize Geography V1 seed",
  `-- Source: ${path.basename(V3_JSON)}`,
  `-- Generated: ${payload.generated_at}`,
  "",
];

function insertGeo(table, rows, columns) {
  for (const row of rows) {
    const vals = columns.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "boolean") return v ? "true" : "false";
      if (typeof v === "number") return String(v);
      if (Array.isArray(v) || typeof v === "object") return `'${sqlEscape(JSON.stringify(v))}'::jsonb`;
      return `'${sqlEscape(v)}'`;
    });
    sqlLines.push(
      `INSERT INTO public.${table} (${columns.join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT (id) DO UPDATE SET active = EXCLUDED.active, verification_status = EXCLUDED.verification_status;`
    );
  }
}

// Schema is in migration; seed uses normalized tables
for (const mr of mapRegions) {
  sqlLines.push(
    `INSERT INTO public.geo_map_regions (id, slug, name, administrative_district_id, display_order, active, verification_status, source_refs) VALUES ('${sqlEscape(mr.id)}', '${sqlEscape(mr.slug)}', '${sqlEscape(mr.name)}', '${sqlEscape(mr.administrative_district_id)}', ${mr.display_order}, true, '${sqlEscape(mr.verification_status)}', '${sqlEscape(JSON.stringify(mr.source_refs || []))}'::jsonb) ON CONFLICT (id) DO NOTHING;`
  );
}

for (const c of communities) {
  sqlLines.push(
    `INSERT INTO public.geo_communities (id, slug, name, map_region_id, administrative_district_id, location_type, ui_tier, display_order, active, verification_status, source_refs, aliases) VALUES ('${sqlEscape(c.area_id || c.id)}', '${sqlEscape(c.slug)}', '${sqlEscape(c.name)}', '${sqlEscape(c.map_region_id)}', '${sqlEscape(c.administrative_district_id)}', '${sqlEscape(c.location_type)}', '${sqlEscape(c.ui_tier)}', ${c.display_order}, true, '${sqlEscape(c.verification_status)}', '${sqlEscape(JSON.stringify(c.source_refs || []))}'::jsonb, '${sqlEscape(JSON.stringify(c.aliases || []))}'::jsonb) ON CONFLICT (id) DO NOTHING;`
  );
}

for (const loc of localities) {
  sqlLines.push(
    `INSERT INTO public.geo_localities (id, slug, name, community_id, map_region_id, location_type, ui_tier, display_order, active, verification_status, source_refs) VALUES ('${sqlEscape(loc.locality_id || loc.id)}', '${sqlEscape(loc.slug)}', '${sqlEscape(loc.name)}', '${sqlEscape(loc.area_id)}', '${sqlEscape(loc.map_region_id)}', '${sqlEscape(loc.location_type)}', '${sqlEscape(loc.ui_tier)}', ${loc.display_order}, true, '${sqlEscape(loc.verification_status)}', '${sqlEscape(JSON.stringify(loc.source_refs || []))}'::jsonb) ON CONFLICT (id) DO NOTHING;`
  );
}

for (const hw of highways) {
  const hwId = hw.area_id || hw.id;
  sqlLines.push(
    `INSERT INTO public.geo_highways (id, slug, name, approx_mile_max, active, verification_status, aliases) VALUES ('${sqlEscape(hwId)}', '${sqlEscape(hw.slug)}', '${sqlEscape(hw.name)}', ${hw.approx_mile_max || 0}, true, '${sqlEscape(hw.verification_status)}', '${sqlEscape(JSON.stringify(hw.aliases || []))}'::jsonb) ON CONFLICT (id) DO NOTHING;`
  );
  for (const mrs of hw.map_region_slugs || []) {
    sqlLines.push(
      `INSERT INTO public.geo_highway_map_regions (highway_id, map_region_id) VALUES ('${sqlEscape(hwId)}', 'map-${sqlEscape(mrs)}') ON CONFLICT (highway_id, map_region_id) DO NOTHING;`
    );
  }
}

for (const rc of roadCorridors) {
  const rcId = rc.id;
  for (const mrs of rc.map_region_slugs || []) {
    sqlLines.push(
      `INSERT INTO public.geo_road_corridors (id, slug, name, map_region_id, active, verification_status) VALUES ('${sqlEscape(rcId)}', '${sqlEscape(rc.slug)}', '${sqlEscape(rc.name)}', 'map-${sqlEscape(mrs)}', true, '${sqlEscape(rc.verification_status)}') ON CONFLICT (id, map_region_id) DO NOTHING;`
    );
  }
}

for (const a of aliasEntries) {
  const norm = String(a.alias).toLowerCase().trim();
  sqlLines.push(
    `INSERT INTO public.geo_aliases (alias_normalized, alias_display, target_id, target_level, map_region_id) VALUES ('${sqlEscape(norm)}', '${sqlEscape(a.alias)}', '${sqlEscape(a.target_id)}', '${sqlEscape(a.target_level)}', ${a.map_region_id ? `'${sqlEscape(a.map_region_id)}'` : "NULL"}) ON CONFLICT (alias_normalized, target_id, COALESCE(map_region_id, '')) DO NOTHING;`
  );
}

fs.mkdirSync(path.dirname(OUT_SQL), { recursive: true });
fs.writeFileSync(OUT_SQL, sqlLines.join("\n"));

console.log("Built:", OUT_JS);
console.log("Built:", OUT_SQL);
console.log("Totals:", {
  mapRegions: mapRegions.length,
  communities: communities.length,
  localities: localities.length,
  highways: highways.length,
  roadCorridors: roadCorridors.length,
  aliases: aliasEntries.length,
});
