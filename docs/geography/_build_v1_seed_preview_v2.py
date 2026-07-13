#!/usr/bin/env python3
"""Generate belize-v1-location-seed.preview.v2.json + human-readable .md (not wired to app)."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[''`]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


MAP_REGIONS = [
    {"id": "map-corozal", "slug": "corozal", "name": "Corozal", "admin_district": "corozal", "ui_label": "District: Corozal"},
    {"id": "map-orange-walk", "slug": "orange-walk", "name": "Orange Walk", "admin_district": "orange-walk", "ui_label": "District: Orange Walk"},
    {"id": "map-belize", "slug": "belize", "name": "Belize", "admin_district": "belize", "ui_label": "District: Belize"},
    {"id": "map-cayo", "slug": "cayo", "name": "Cayo", "admin_district": "cayo", "ui_label": "District: Cayo"},
    {"id": "map-stann-creek", "slug": "stann-creek", "name": "Stann Creek", "admin_district": "stann-creek", "ui_label": "District: Stann Creek"},
    {"id": "map-toledo", "slug": "toledo", "name": "Toledo", "admin_district": "toledo", "ui_label": "District: Toledo"},
    {"id": "map-ambergris-caye", "slug": "ambergris-caye", "name": "Ambergris Caye", "admin_district": "belize", "ui_label": "Map Region: Ambergris Caye (Administrative District: Belize)"},
    {"id": "map-caye-caulker", "slug": "caye-caulker", "name": "Caye Caulker", "admin_district": "belize", "ui_label": "Map Region: Caye Caulker (Administrative District: Belize)"},
]

# SIB 2010 Census Tables P1.5–P1.10 (City/Town/Village rows) — primary authority
CENSUS = {
    "corozal": {
        "communities": [
            ("Corozal Town", "town"),
            ("Altamira", "village"), ("Buena Vista", "village"), ("Calcutta", "village"), ("Caledonia", "village"),
            ("Carolina", "village"), ("Chan Chen", "village"), ("Chunox", "village"), ("Concepción", "village"),
            ("Consejo", "village"), ("Copper Bank", "village"), ("Cristo Rey", "village"), ("Libertad", "village"),
            ("Little Belize", "mennonite_community"), ("Louisville", "village"), ("Paraiso", "village"),
            ("Patchakán", "village"), ("Progreso", "village"), ("Ranchito", "village"), ("San Andrés", "village"),
            ("San Antonio", "village"), ("San Joaquín", "village"), ("San Narciso", "village"), ("San Pedro", "village"),
            ("San Román", "village"), ("San Victor", "village"), ("Santa Clara", "village"), ("Sarteneja", "village"),
            ("Xaibe", "village"),
        ],
        "eb_only": [("Estrella", "village"), ("Yo Chen", "village")],
    },
    "orange-walk": {
        "communities": [
            ("Orange Walk Town", "town"),
            ("August Pine Ridge", "village"), ("Blue Creek", "village"), ("Carmelita", "village"),
            ("Chan Pine Ridge", "village"), ("Cuatro Leguas", "village"), ("Douglas", "village"),
            ("Guinea Grass", "village"), ("Indian Church", "village"), ("Indian Creek", "village"),
            ("San Antonio", "village"), ("San Carlos", "village"), ("San Estevan", "village"),
            ("San Felipe", "village"), ("San José", "village"), ("San José Palmar", "village"),
            ("San Juan", "village"), ("San Lázaro", "village"), ("San Lorenzo", "village"),
            ("San Luis", "village"), ("San Pablo", "village"), ("San Román", "village"),
            ("Santa Cruz", "village"), ("Santa Marta", "village"), ("Shipyard", "mennonite_community"),
            ("Tower Hill", "village"), ("Tres Leguas", "village"), ("Trial Farm", "village"),
            ("Trinidad", "village"), ("Yo Creek", "village"),
        ],
        "eb_only": [("Nuevo San Juan", "village"), ("Fire Burn", "village")],
    },
    "belize": {
        "communities": [
            ("Belize City", "city"),
            ("Bermudian Landing", "village"), ("Biscayne", "village"), ("Boston", "village"),
            ("Burrell Boom", "village"), ("Crooked Tree", "village"), ("Double Head Cabbage", "village"),
            ("Flowers Bank", "village"), ("Gales Point", "village"), ("Gardenia", "village"),
            ("Gracie Rock", "village"), ("Hattieville", "village"), ("Isabella Bank", "village"),
            ("La Democracia", "village"), ("Ladyville", "village"), ("Lemonal", "village"),
            ("Lord's Bank", "village"), ("Lucky Strike", "village"), ("Mahogany Heights", "village"),
            ("Maskall", "village"), ("Rancho Dolores", "village"), ("Rock Stone Pond", "village"),
            ("Sand Hill", "village"), ("Santana", "village"), ("Scotland Halfmoon", "village"),
            ("St. George's Caye", "caye"), ("St. Paul's Bank", "village"), ("Western Paradise", "village"),
            ("Willows Bank", "village"),
        ],
        "eb_only": [("Bomba", "village"), ("May Pen", "village"), ("Corozalito", "village"), ("Santa Ana", "village"), ("Rayburn Ridge", "village")],
        "aliases": {"Western Paradise": ["West Lake", "8 Miles"]},
    },
    "cayo": {
        "communities": [
            ("Belmopan", "city"),
            ("Benque Viejo", "town"),
            ("San Ignacio", "town"),
            ("Santa Elena", "town"),
            ("Arenal", "village"), ("Armenia", "village"), ("Billy White", "village"),
            ("Blackman Eddy", "village"), ("Buena Vista", "village"), ("Bullet Tree Falls", "village"),
            ("Calla Creek", "village"), ("Camalote", "village"), ("Central Farm", "village"),
            ("Cotton Tree", "village"), ("Cristo Rey", "village"), ("Duck Run 1", "village"),
            ("Duck Run 2", "village"), ("Duck Run 3", "village"), ("Esperanza", "village"),
            ("Frank's Eddy", "village"), ("Georgeville", "village"), ("La Gracia", "village"),
            ("Los Tambos", "village"), ("Lower Barton Creek", "village"), ("More Tomorrow", "village"),
            ("Ontario", "village"), ("Paslow Falls", "village"), ("Ringtail", "village"),
            ("Roaring Creek", "village"), ("San Antonio", "village"), ("San José Succotz", "village"),
            ("Santa Familia", "village"), ("Santa Marta", "village"), ("Selena", "village"),
            ("Seven Miles", "village"), ("Spanish Lookout", "mennonite_community"), ("Springfield", "village"),
            ("St. Matthews", "village"), ("Teakettle", "village"), ("Unitedville", "village"),
            ("Upper Barton Creek", "village"), ("Valley of Peace", "village"),
        ],
        "eb_only": [("Beaver Dam", "village"), ("Caves Branch", "village"), ("St. Margaret's", "village")],
    },
    "stann-creek": {
        "communities": [
            ("Dangriga", "town"),
            ("Alta Vista", "village"), ("Cow Pen", "village"), ("Georgetown", "village"),
            ("Hope Creek", "village"), ("Hopkins", "village"), ("Hummingbird Community", "village"),
            ("Independence", "village"), ("Kendall", "village"), ("Long Bank", "village"),
            ("Maya Beach", "village"), ("Maya Centre", "village"), ("Maya Mopan", "village"),
            ("Middlesex", "village"), ("Mullins River", "village"), ("Placencia", "village"),
            ("Pomona", "village"), ("Red Bank", "village"), ("Riversdale", "village"),
            ("San Juan", "village"), ("San Román", "village"), ("Santa Cruz", "village"),
            ("Santa Rosa", "village"), ("Sarawee", "village"), ("Seine Bight", "village"),
            ("Silk Grass", "village"), ("Sittee River", "village"), ("South Stann Creek", "village"),
            ("Steadfast", "village"), ("Valley Community", "village"),
        ],
        "aliases": {"Independence": ["Mango Creek"]},
    },
    "toledo": {
        "communities": [
            ("Punta Gorda Town", "town"),
            ("Aguacate", "village"), ("Barranco", "village"), ("Bella Vista", "village"),
            ("Big Falls", "village"), ("Bladen", "village"), ("Blue Creek", "mennonite_community"),
            ("Cattle Landing", "village"), ("Conejo", "village"), ("Corazón", "village"),
            ("Crique Jute", "village"), ("Crique Sarco", "village"), ("Dolores", "village"),
            ("Dump", "village"), ("Elridge", "village"), ("Forest Home", "village"),
            ("Golden Stream", "village"), ("Hicattee", "village"), ("Indian Creek", "village"),
            ("Jacinto", "village"), ("Jalacté", "village"), ("Laguna", "village"),
            ("Mabilha", "village"), ("Mafredi", "village"), ("Mango Walk", "village"),
            ("Medina Bank", "village"), ("Midway", "village"), ("Monkey River", "village"),
            ("Otoxha", "village"), ("Pine Hill", "village"), ("Pueblo Viejo", "village"),
            ("San Antonio", "village"), ("San Benito Poite", "village"), ("San Felipe", "village"),
            ("San Isidro", "village"), ("San José", "village"), ("San Marcos", "village"),
            ("San Miguel", "village"), ("San Pablo", "village"), ("San Pedro Columbia", "village"),
            ("San Vicente", "village"), ("Santa Ana", "village"), ("Santa Cruz", "village"),
            ("Santa Elena", "village"), ("Santa Teresa", "village"), ("Silver Creek", "village"),
            ("Sunday Wood", "village"), ("Swasey", "village"), ("Trio", "village"),
            ("Yemeri Grove", "village"),
        ],
        "eb_only": [("Punta Negra", "village"), ("Wilson Road", "village"), ("Tambran", "village")],
        "aliases": {
            "Elridge": ["Eldridgeville"],
            "Jacinto": ["Jacintoville", "Westmoreland"],
            "Conejo": ["Conejo Creek"],
            "Corazón": ["Corazon Creek"],
        },
    },
}

# Major marketed localities (V1.0 scope — not exhaustive informal blocks)
LOCALITIES = {
    "belize-city": [
        "Albert", "Belama Phase 1", "Belama Phase 2", "Belama Phase 3", "Belama Phase 4",
        "Bella Vista", "Buttonwood Bay", "Caribbean Shores", "Collet", "Coral Grove",
        "Fort George", "Freetown", "King's Park", "Lake Independence", "Mesopotamia",
        "Pickstock", "Port Loyola", "Queen's Square", "West Landivar",
    ],
    "ladyville": ["Vista Del Mar", "Airport Area", "Lake Gardens", "Lord's Bank Junction"],
    "belmopan": ["Las Flores", "Salvapan", "San Martin", "Maya Mopan", "University of Belize Area"],
    "san-ignacio": ["Maya Vista", "Cahal Pech", "Elena Area", "Bullet Tree Road Junction"],
    "santa-elena": ["Bullet Tree Falls Junction", "Hawksworth Bridge Area"],
    "benque-viejo": ["Benque Hills", "Arenal Area"],
    "corozal": ["Alta Mira", "Finca Solana", "Santa Rita", "Halls Layout", "Chula Vista", "Altamira"],
    "orange-walk": ["Trial Farm Fringe", "Louisville Road Area", "San Lorenzo Fringe"],
    "dangriga": ["Wagier Creek", "New Site Area"],
    "placencia": ["Maya Beach", "Seine Bight Fringe", "Placencia Lagoon", "Placencia Village Centre"],
    "punta-gorda": ["Punta Gorda Town Centre", "Port Area"],
    "san-pedro": [
        "San Pedro Town Centre", "Boca del Rio", "San Juan", "San Mateo", "San Pablo", "DFC Area",
        "Escalante", "Mahogany Bay", "Tres Cocos", "Boca Ciega", "South Ambergris Caye",
        "North Ambergris Caye", "Secret Beach", "Grand Belizean Estates", "Mata Grande",
        "Mexico Rocks Area", "Basil Jones", "Robles Point", "Marina Area",
    ],
    "caye-caulker-village": [
        "The Split", "North Caye Caulker", "South Caye Caulker", "Airport Area",
        "West Side", "Bahia Area", "Caye Caulker Estates",
    ],
}

# Canonical highways — ONE record each with map_region_slugs[]
HIGHWAYS = [
    {
        "name": "George Price Highway",
        "slug": "george-price-highway",
        "type": "national_highway",
        "map_region_slugs": ["belize", "cayo"],
        "aliases": ["Western Highway"],
        "source_refs": ["SI 90/2023 AR1"],
        "mile_markers": ["Mile 8", "Mile 10", "Mile 12", "Mile 32"],
    },
    {
        "name": "Philip Goldson Highway",
        "slug": "philip-goldson-highway",
        "type": "national_highway",
        "map_region_slugs": ["belize", "orange-walk", "corozal"],
        "aliases": ["Northern Highway", "Old Northern Highway"],
        "source_refs": ["SI 90/2023 AR2"],
        "mile_markers": ["Mile 8"],
    },
    {
        "name": "Hummingbird Highway",
        "slug": "hummingbird-highway",
        "type": "national_highway",
        "map_region_slugs": ["cayo", "stann-creek"],
        "aliases": [],
        "source_refs": ["SI 90/2023 AR3"],
        "mile_markers": ["Mile 12", "Mile 32"],
    },
    {
        "name": "Coastal Plain Highway",
        "slug": "coastal-plain-highway",
        "type": "national_highway",
        "map_region_slugs": ["belize", "stann-creek"],
        "aliases": ["Coastal Highway", "Manatee Highway"],
        "source_refs": ["SI 90/2023 AR5"],
        "mile_markers": [],
    },
    {
        "name": "Thomas Vincent Ramos Highway",
        "slug": "thomas-vincent-ramos-highway",
        "type": "national_highway",
        "map_region_slugs": ["stann-creek", "toledo"],
        "aliases": ["Southern Highway"],
        "source_refs": ["SI 90/2023 AR4"],
        "mile_markers": [],
    },
]

ROAD_CORRIDORS = [
    ("Burrell Boom Road", ["belize"], "verified_official"),
    ("John Smith Road", ["belize"], "requires_review"),
    ("San Antonio Road", ["toledo"], "verified_common_usage"),
    ("Jalacte Road", ["toledo"], "verified_official"),
    ("Placencia Road", ["stann-creek"], "verified_common_usage"),
    ("Hopkins Road", ["stann-creek"], "verified_common_usage"),
    ("Consejo Road", ["corozal"], "verified_common_usage"),
    ("Maskall Road", ["belize"], "verified_common_usage"),
    ("Cristo Rey Road", ["cayo", "corozal"], "verified_common_usage"),
    ("Mountain Pine Ridge Road", ["cayo"], "verified_official"),
    ("Caracol Road", ["cayo"], "verified_common_usage"),
    ("Spanish Lookout Road", ["cayo"], "verified_common_usage"),
    ("Bullet Tree Road", ["cayo"], "verified_common_usage"),
    ("Boom Creek Road", ["toledo"], "verified_common_usage"),
    ("Sarteneja Road", ["corozal"], "verified_common_usage"),
    ("Progresso Road", ["corozal"], "verified_common_usage"),
    ("Chunox Road", ["corozal"], "verified_common_usage"),
    ("San Estevan Road", ["orange-walk"], "verified_common_usage"),
    ("Blue Creek Road", ["orange-walk", "toledo"], "verified_common_usage"),
    ("Sittee River Road", ["stann-creek"], "verified_common_usage"),
]

ISLANDS = [
    ("Caye Chapel", "belize", "verified_common_usage"),
    ("Turneffe Atoll", "belize", "verified_official"),
    ("Goff's Caye", "belize", "verified_official"),
    ("English Caye", "belize", "verified_official"),
]

REQUIRES_REVIEW = []
ALIAS_ONLY = []

locations: list[dict] = []
order = 0


def add(**kwargs):
    global order
    order += 1
    rec = {
        "display_order": order,
        "active": True,
        "latitude": None,
        "longitude": None,
        "zoom_level": None,
        "notes": "",
        **kwargs,
    }
    if rec.get("verification_status") == "requires_review":
        REQUIRES_REVIEW.append(rec["name"])
    locations.append(rec)
    return rec


def community_label(ctype: str) -> str:
    return {"city": "City", "town": "Town", "village": "Village", "mennonite_community": "Village", "caye": "Caye"}.get(ctype, "Community")


# Map regions + admin districts
for mr in MAP_REGIONS:
    add(
        id=mr["id"], slug=mr["slug"], name=mr["name"], level="map_region",
        map_region_id=None, administrative_district_id=f"admin-{mr['admin_district']}",
        area_id=None, locality_id=None, location_type="independent_map_island" if mr["slug"] in ("ambergris-caye", "caye-caulker") else "district",
        ui_tier="District" if mr["slug"] not in ("ambergris-caye", "caye-caulker") else "Map Region",
        verification_status="verified_official", source_refs=["SIB 2010", "geographyLayer.js"],
    )

for slug, name in [(d["slug"], d["name"]) for d in [
    {"slug": "corozal", "name": "Corozal"}, {"slug": "orange-walk", "name": "Orange Walk"},
    {"slug": "belize", "name": "Belize"}, {"slug": "cayo", "name": "Cayo"},
    {"slug": "stann-creek", "name": "Stann Creek"}, {"slug": "toledo", "name": "Toledo"},
]]:
    add(id=f"admin-{slug}", slug=slug, name=name, level="administrative_district",
        map_region_id=f"map-{slug}", administrative_district_id=f"admin-{slug}",
        area_id=None, locality_id=None, location_type="district", ui_tier="Administrative District",
        verification_status="verified_official", source_refs=["SIB 2010"])

# Communities
DISTRICT_TO_MAP = {d: d for d in CENSUS}
SPECIAL_MAP = {"san-pedro-town": "ambergris-caye", "caye-caulker": "caye-caulker"}

for district, data in CENSUS.items():
    map_slug = DISTRICT_TO_MAP[district]
    for source_list, src_tag in [(data["communities"], "SIB 2010 Census P1"), (data.get("eb_only", []), "E&B ROP 2024")]:
        for name, ctype in source_list:
            if name == "San Pedro Town":
                continue
            base = slugify(name.replace(" Town", ""))
            area_id = f"area-{district}-{base}"
            map_id = f"map-{map_slug}"
            if name == "Caye Caulker":
                continue
            add(
                id=area_id, slug=base, name=name.replace(" Town", ""), level="community",
                map_region_id=map_id, administrative_district_id=f"admin-{district}",
                area_id=area_id, locality_id=None, location_type=ctype,
                ui_tier=community_label(ctype),
                verification_status="verified_official" if src_tag.startswith("SIB") else "verified_common_usage",
                source_refs=[src_tag],
                aliases=data.get("aliases", {}).get(name.replace(" Town", ""), data.get("aliases", {}).get(name, [])),
            )
            parent_slug = base
            for loc in LOCALITIES.get(parent_slug, []):
                add(
                    id=f"loc-{district}-{slugify(parent_slug)}-{slugify(loc)}",
                    slug=slugify(loc), name=loc, level="locality",
                    map_region_id=map_id, administrative_district_id=f"admin-{district}",
                    area_id=area_id, locality_id=f"loc-{district}-{slugify(parent_slug)}-{slugify(loc)}",
                    location_type="neighborhood" if loc in LOCALITIES.get("belize-city", []) else "locality",
                    ui_tier="Neighborhood / Locality",
                    verification_status="verified_common_usage",
                    source_refs=["Real estate / municipal common usage"],
                )

# Ambergris + Caye Caulker
add(id="area-ambergris-san-pedro", slug="san-pedro", name="San Pedro", level="community",
    map_region_id="map-ambergris-caye", administrative_district_id="admin-belize",
    area_id="area-ambergris-san-pedro", locality_id=None, location_type="town", ui_tier="Town",
    verification_status="verified_official", source_refs=["SIB 2010 P1.7", "San Pedro Sun 2025"],
    aliases=["San Pedro Town"])
for loc in LOCALITIES["san-pedro"]:
    add(id=f"loc-ambergris-{slugify(loc)}", slug=slugify(loc), name=loc, level="locality",
        map_region_id="map-ambergris-caye", administrative_district_id="admin-belize",
        area_id="area-ambergris-san-pedro", locality_id=f"loc-ambergris-{slugify(loc)}",
        location_type="development" if loc == "Mahogany Bay" else "locality", ui_tier="Neighborhood / Locality",
        verification_status="verified_private_development" if loc == "Mahogany Bay" else "verified_common_usage",
        source_refs=["RE market"])

add(id="area-caye-caulker-village", slug="caye-caulker-village", name="Caye Caulker Village", level="community",
    map_region_id="map-caye-caulker", administrative_district_id="admin-belize",
    area_id="area-caye-caulker-village", locality_id=None, location_type="village", ui_tier="Village",
    verification_status="verified_official", source_refs=["SIB 2010 P1.7"], aliases=["Caye Caulker"])
for loc in LOCALITIES["caye-caulker-village"]:
    add(id=f"loc-cc-{slugify(loc)}", slug=slugify(loc), name=loc, level="locality",
        map_region_id="map-caye-caulker", administrative_district_id="admin-belize",
        area_id="area-caye-caulker-village", locality_id=f"loc-cc-{slugify(loc)}",
        location_type="locality", ui_tier="Neighborhood / Locality",
        verification_status="verified_common_usage", source_refs=["Tourism/common usage"])

# Islands with RE relevance
for name, district, status in ISLANDS:
    add(id=f"area-{district}-{slugify(name)}", slug=slugify(name), name=name, level="community",
        map_region_id=f"map-{district}", administrative_district_id=f"admin-{district}",
        area_id=f"area-{district}-{slugify(name)}", locality_id=None, location_type="island",
        ui_tier="Island / Caye", verification_status=status, source_refs=["Marine/coastal records"])

# Highways — single canonical record
for hw in HIGHWAYS:
    hw_id = f"highway-{hw['slug']}"
    for alias in hw["aliases"]:
        ALIAS_ONLY.append((alias, hw["name"], "legacy highway name"))
    add(
        id=hw_id, slug=hw["slug"], name=hw["name"], level="highway",
        map_region_id=None, map_region_slugs=hw["map_region_slugs"],
        administrative_district_id=None, area_id=hw_id, locality_id=None,
        location_type=hw["type"], ui_tier="Highway",
        verification_status="verified_official", source_refs=hw["source_refs"], aliases=hw["aliases"],
        notes="Single canonical highway record; map_region_slugs defines browse/filter association.",
    )
    for mile in hw["mile_markers"]:
        add(
            id=f"{hw_id}-{slugify(mile)}", slug=slugify(mile), name=mile, level="locality",
            map_region_id=None, map_region_slugs=hw["map_region_slugs"],
            administrative_district_id=None, area_id=hw_id,
            locality_id=f"{hw_id}-{slugify(mile)}", location_type="highway_section",
            ui_tier="Highway Locality", verification_status="verified_common_usage",
            source_refs=["RE mile-marker convention"], parent_highway_id=hw_id,
        )

for name, maps, status in ROAD_CORRIDORS:
    if status == "requires_review":
        REQUIRES_REVIEW.append(name)
    add(
        id=f"road-{slugify(name)}", slug=slugify(name), name=name, level="road_corridor",
        map_region_id=None, map_region_slugs=maps, administrative_district_id=None,
        area_id=None, locality_id=f"road-{slugify(name)}", location_type="road_corridor",
        ui_tier="Road Corridor", verification_status=status,
        source_refs=["Common RE / E&B references"],
        notes="Stored as locality/corridor; prefer parent settlement Area when property is inside a village.",
    )

# Known gaps flagged (not added as fake records)
KNOWN_GAPS = [
    "Honey Camp (village — secondary sources; not in SIB 2010 P1 tables)",
    "Machacilha (E&B Toledo East — spelling variant Machakilha)",
    "Na Lum Cah / Na Luum Ca (E&B spelling variants)",
    "Crique Trosa (secondary municipality lists)",
    "Settlements aggregated in SIB 'Other - {District}' rows (6 districts)",
    "Hopeville (user example — not found in SIB/E&B; may mean Hope Creek)",
]

# Totals
def cnt(**kw):
    return sum(1 for l in locations if all(l.get(k) == v for k, v in kw.items()))

totals = {
    "interactive_map_regions": 8,
    "administrative_districts": 6,
    "cities": cnt(location_type="city"),
    "towns": cnt(location_type="town"),
    "villages": cnt(location_type="village"),
    "mennonite_communities": cnt(location_type="mennonite_community"),
    "neighborhoods": sum(1 for l in locations if l.get("location_type") == "neighborhood"),
    "localities": sum(1 for l in locations if l.get("level") == "locality"),
    "subdivisions": sum(1 for l in locations if "Phase" in l.get("name", "")),
    "developments": cnt(location_type="development"),
    "national_highways": cnt(location_type="national_highway"),
    "road_corridors": cnt(location_type="road_corridor"),
    "highway_sections": cnt(location_type="highway_section"),
    "islands_cayes": cnt(location_type="island") + cnt(location_type="caye"),
    "communities_total": sum(1 for l in locations if l.get("level") == "community"),
    "total_geography_records": len(locations),
    "records_requires_review": len(set(REQUIRES_REVIEW)),
    "alias_only_entries": len(ALIAS_ONLY),
    "known_official_gaps": len(KNOWN_GAPS),
}

payload = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "version": "1.0-seed-preview-v2",
    "status": "uncommitted_preview_not_wired",
    "verification_pass": "final-pre-implementation",
    "ui_hierarchy_labels": ["District", "City / Town / Village", "Neighborhood / Locality"],
    "internal_hierarchy": "map_region → community (area) → locality",
    "highway_architecture": "single_canonical_record_with_map_region_slugs_array",
    "existing_listing_migration_note": (
        "Current listings store district, region_slug, subregion_slug only. On implementation (post-Open-Beta): "
        "map legacy slugs via compatibility layer; subregion_slug values (san-pedro, placencia, belize-city) map to "
        "community_id; district/region slugs map to district or map_region; locality_id will be null until backfill "
        "or user re-selection. Do not backfill now."
    ),
    "isolated_alias_bug": {
        "alias": "san pedro island",
        "current_target": "ambergris-caye",
        "correct_target": "ambergris-caye → san-pedro",
        "fix_scope": "Ship separately from geography seed",
        "file": "src/constants/geographyLayer.js",
    },
    "sources_live_checked": [
        {"name": "SIB Census 2010 Metadata", "url": "https://sib.org.bz/data-portals/documentation/census-2010-metadata/"},
        {"name": "SIB 2010 Census CTV tables (partial page)", "url": "https://sib.org.bz/census/2010-census/"},
        {"name": "SIB 2010 Census Report PDF (Tables P1.5–P1.10)", "url": "https://sib.org.bz/wp-content/uploads/2010_Census_Report.pdf"},
        {"name": "Representation of the People Amendment Bill 2024", "url": "https://www.nationalassembly.gov.bz/wp-content/uploads/2024/05/Representation-of-the-People-Amendment-Bill-2024.pdf"},
        {"name": "Public Roads Names Order 2023 (SI 90/2023)", "url": "https://www.nationalassembly.gov.bz/wp-content/uploads/2023/11/SI-No.-90-of-2023-Public-Roads-Names-and-Description-of-Highways-Order-2023.pdf"},
        {"name": "Belize City Council Planning Regulations", "url": "https://www.belizecitycouncil.org/lib/docs/planning/Regulations.pdf"},
        {"name": "Cayo South E&B boundary", "url": "https://elections.gov.bz/wp-content/uploads/2023/12/Cayo-South.pdf"},
        {"name": "San Pedro Sun municipal boundary 2025", "url": "https://www.sanpedrosun.com/government/2025/05/15/municipal-boundaries-realigned-for-the-first-time-in-decades-san-pedro-town-now-encompasses-the-entire-island-of-ambergris-caye/"},
    ],
    "certification": {
        "every_official_settlement_exactly_once": False,
        "reason": "SIB census aggregates unnamed settlements in 'Other - District' buckets; some E&B/secondary-list villages not in P1 tables; 247-municipality inventory not published as single SIB table.",
    },
    "known_gaps": KNOWN_GAPS,
    "requires_review": sorted(set(REQUIRES_REVIEW)),
    "alias_only": ALIAS_ONLY,
    "map_regions": MAP_REGIONS,
    "locations": locations,
    "totals": totals,
}

json_path = ROOT / "belize-v1-location-seed.preview.v2.json"
json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

# Human-readable MD
md_lines = ["# BelizeListings V1.0 Geography", "", f"*Generated: {payload['generated_at']} — Preview v2 (not committed, not wired)*", ""]

section_titles = {
    "map-belize": "🌎 District: Belize",
    "map-ambergris-caye": "🏝 Map Region: Ambergris Caye (Administrative District: Belize)",
    "map-caye-caulker": "🏝 Map Region: Caye Caulker (Administrative District: Belize)",
    "map-cayo": "🌎 District: Cayo",
    "map-corozal": "🌎 District: Corozal",
    "map-orange-walk": "🌎 District: Orange Walk",
    "map-stann-creek": "🌎 District: Stann Creek",
    "map-toledo": "🌎 District: Toledo",
}

communities_by_map: dict[str, list[dict]] = defaultdict(list)
localities_by_area: dict[str, list[str]] = defaultdict(list)
highway_miles: dict[str, list[str]] = defaultdict(list)

for loc in locations:
    if loc["level"] == "locality" and loc.get("parent_highway_id"):
        highway_miles[loc["parent_highway_id"]].append(loc["name"])
    elif loc["level"] == "locality" and loc.get("area_id"):
        localities_by_area[loc["area_id"]].append(loc["name"])
    elif loc["level"] == "community":
        communities_by_map[loc["map_region_id"]].append(loc)

for map_id in [
    "map-belize", "map-ambergris-caye", "map-caye-caulker", "map-cayo",
    "map-corozal", "map-orange-walk", "map-stann-creek", "map-toledo",
]:
    md_lines.append(section_titles[map_id])
    md_lines.append("")
    for comm in sorted(communities_by_map.get(map_id, []), key=lambda x: x["name"]):
        md_lines.append(f"{comm.get('ui_tier', 'Community')}: {comm['name']}")
        locs = sorted(localities_by_area.get(comm["id"], []))
        if locs:
            md_lines.append("Neighborhoods / Localities")
            for l in locs:
                md_lines.append(f"- {l}")
        md_lines.append("")

md_lines.append("## Highways (canonical single records)")
md_lines.append("")
for hw in [l for l in locations if l["level"] == "highway"]:
    md_lines.append(f"Highway: {hw['name']}")
    md_lines.append(f"- Map regions: {', '.join(hw.get('map_region_slugs', []))}")
    if hw.get("aliases"):
        md_lines.append(f"- Legacy aliases: {', '.join(hw['aliases'])}")
    miles = sorted(highway_miles.get(hw["id"], []))
    if miles:
        md_lines.append("Highway Localities")
        for m in miles:
            md_lines.append(f"- {m}")
    md_lines.append("")

md_lines.append("## Road Corridors")
md_lines.append("")
for rc in sorted([l for l in locations if l["level"] == "road_corridor"], key=lambda x: x["name"]):
    md_lines.append(f"- {rc['name']} ({', '.join(rc.get('map_region_slugs', []))})")
md_lines.append("")

md_lines.append("## Summary")
md_lines.append("")
for k, v in totals.items():
    md_lines.append(f"- {k.replace('_', ' ').title()}: {v}")
md_lines.append("")
md_lines.append("---")
md_lines.append("")
md_lines.append("**This is the complete proposed BelizeListings V1.0 Geography hierarchy ready to be frozen for implementation** — subject to Open Beta gate and resolution of known_gaps / requires_review items.")
md_lines.append("")
md_lines.append("*Implementation (migrations, PLATFORM_GEOGRAPHY, dropdowns, backfill) remains blocked until Open Beta passes.*")

md_path = ROOT / "belize-v1-location-seed.preview.v2.md"
md_path.write_text("\n".join(md_lines), encoding="utf-8")

print(f"Wrote {json_path}")
print(f"Wrote {md_path}")
print(json.dumps(totals, indent=2))
