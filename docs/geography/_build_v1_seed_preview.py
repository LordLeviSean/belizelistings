#!/usr/bin/env python3
"""One-off generator for belize-v1-location-seed.preview.json — not wired to app."""
import json
import re
from datetime import datetime, timezone

def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[''`]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")

MAP_REGIONS = [
    {"id": "map-corozal", "slug": "corozal", "name": "Corozal", "admin_district": "corozal", "svg_group": "corozal", "independent_map": True},
    {"id": "map-orange-walk", "slug": "orange-walk", "name": "Orange Walk", "admin_district": "orange-walk", "svg_group": "orange_walk", "independent_map": True},
    {"id": "map-belize", "slug": "belize", "name": "Belize", "admin_district": "belize", "svg_group": "belize", "independent_map": True},
    {"id": "map-cayo", "slug": "cayo", "name": "Cayo", "admin_district": "cayo", "svg_group": "cayo", "independent_map": True},
    {"id": "map-stann-creek", "slug": "stann-creek", "name": "Stann Creek", "admin_district": "stann-creek", "svg_group": "stann_creek", "independent_map": True},
    {"id": "map-toledo", "slug": "toledo", "name": "Toledo", "admin_district": "toledo", "svg_group": "toledo", "independent_map": True},
    {"id": "map-ambergris-caye", "slug": "ambergris-caye", "name": "Ambergris Caye", "admin_district": "belize", "svg_group": "ambergris_caye", "independent_map": True},
    {"id": "map-caye-caulker", "slug": "caye-caulker", "name": "Caye Caulker", "admin_district": "belize", "svg_group": "caye_caulker", "independent_map": True},
]

ADMIN_DISTRICTS = [
    {"id": "admin-corozal", "slug": "corozal", "name": "Corozal"},
    {"id": "admin-orange-walk", "slug": "orange-walk", "name": "Orange Walk"},
    {"id": "admin-belize", "slug": "belize", "name": "Belize"},
    {"id": "admin-cayo", "slug": "cayo", "name": "Cayo"},
    {"id": "admin-stann-creek", "slug": "stann-creek", "name": "Stann Creek"},
    {"id": "admin-toledo", "slug": "toledo", "name": "Toledo"},
]

# SIB 2010 Census Table P1.5–P1.10 — verified_official settlements
CENSUS = {
    "corozal": {
        "towns": ["Corozal Town"],
        "villages": [
            "Altamira", "Buena Vista", "Calcutta", "Caledonia", "Carolina", "Chan Chen",
            "Chunox", "Concepción", "Consejo", "Copper Bank", "Cristo Rey", "Libertad",
            "Little Belize", "Louisville", "Paraiso", "Patchakán", "Progreso", "Ranchito",
            "San Andrés", "San Antonio", "San Joaquín", "San Narciso", "San Pedro",
            "San Román", "San Victor", "Santa Clara", "Sarteneja", "Xaibe",
            "Estrella", "Yo Chen",
        ],
    },
    "orange-walk": {
        "towns": ["Orange Walk Town"],
        "villages": [
            "August Pine Ridge", "Blue Creek", "Carmelita", "Chan Pine Ridge", "Cuatro Leguas",
            "Douglas", "Guinea Grass", "Indian Church", "Indian Creek", "San Antonio",
            "San Carlos", "San Estevan", "San Felipe", "San José", "San José Palmar",
            "San Juan", "San Lázaro", "San Lorenzo", "San Luis", "San Pablo", "San Román",
            "Santa Cruz", "Santa Marta", "Shipyard", "Tower Hill", "Tres Leguas",
            "Trial Farm", "Trinidad", "Yo Creek",
        ],
    },
    "belize": {
        "towns": ["Belize City", "San Pedro Town"],
        "villages": [
            "Bermudian Landing", "Biscayne", "Boston", "Burrell Boom", "Crooked Tree",
            "Double Head Cabbage", "Flowers Bank", "Gales Point", "Gardenia", "Gracie Rock",
            "Hattieville", "Isabella Bank", "La Democracia", "Ladyville", "Lemonal",
            "Lord's Bank", "Lucky Strike", "Mahogany Heights", "Maskall", "Rancho Dolores",
            "Rock Stone Pond", "Sand Hill", "Santana", "Scotland Halfmoon", "St. George's Caye",
            "St. Paul's Bank", "Western Paradise", "Willows Bank",
            "Bomba", "May Pen", "Corozalito", "Santa Ana", "Rayburn Ridge",
        ],
        "notes": {"Western Paradise": ["West Lake", "8 Miles"]},
    },
    "cayo": {
        "towns": ["Belmopan", "Benque Viejo", "San Ignacio", "Santa Elena"],
        "villages": [
            "Arenal", "Armenia", "Billy White", "Blackman Eddy", "Buena Vista", "Bullet Tree Falls",
            "Calla Creek", "Camalote", "Central Farm", "Cotton Tree", "Cristo Rey", "Duck Run 1",
            "Duck Run 2", "Duck Run 3", "Esperanza", "Frank's Eddy", "Georgeville", "La Gracia",
            "Los Tambos", "Lower Barton Creek", "More Tomorrow", "Ontario", "Paslow Falls",
            "Ringtail", "Roaring Creek", "San Antonio", "San José Succotz", "Santa Familia",
            "Santa Marta", "Selena", "Seven Miles", "Spanish Lookout", "Springfield",
            "St. Matthews",             "Teakettle", "Unitedville", "Upper Barton Creek", "Valley of Peace",
            "Beaver Dam", "Caves Branch", "St. Margaret's",
        ],
    },
    "stann-creek": {
        "towns": ["Dangriga"],
        "villages": [
            "Alta Vista", "Cow Pen", "Georgetown", "Hope Creek", "Hopkins", "Hummingbird Community",
            "Independence", "Kendall", "Long Bank", "Maya Beach", "Maya Centre", "Maya Mopan",
            "Middlesex", "Mullins River", "Placencia", "Pomona", "Red Bank", "Riversdale",
            "San Juan", "San Román", "Santa Cruz", "Santa Rosa", "Sarawee", "Seine Bight",
            "Silk Grass", "Sittee River", "South Stann Creek", "Steadfast", "Valley Community",
        ],
    },
    "toledo": {
        "towns": ["Punta Gorda Town"],
        "villages": [
            "Aguacate", "Barranco", "Bella Vista", "Big Falls", "Bladen", "Blue Creek",
            "Cattle Landing", "Conejo", "Corazón", "Crique Jute", "Crique Sarco", "Dolores",
            "Dump", "Elridge", "Forest Home", "Golden Stream", "Hicattee", "Indian Creek",
            "Jacinto", "Jalacté", "Laguna", "Mabilha", "Mafredi", "Mango Walk", "Medina Bank",
            "Midway", "Monkey River", "Otoxha", "Pine Hill", "Pueblo Viejo", "San Antonio",
            "San Benito Poite", "San Felipe", "San Isidro", "San José", "San Marcos",
            "San Miguel", "San Pablo", "San Pedro Columbia", "San Vicente", "Santa Ana",
            "Santa Cruz", "Santa Elena", "Santa Teresa", "Silver Creek", "Sunday Wood",
            "Swasey", "Trio", "Yemeri Grove", "Punta Negra", "Wilson Road", "Tambran",
        ],
    },
}

MENNONITE_COMMUNITIES = {
    "orange-walk": ["Shipyard"],
    "cayo": ["Spanish Lookout"],
    "corozal": ["Little Belize"],
    "toledo": ["Blue Creek"],
    "belize": [],
    "stann-creek": [],
}

# E&B / ROP 2024 + BCC zoning — additional localities
BELIZE_CITY_LOCALITIES = [
    ("King's Park", "neighborhood", "verified_official", ["BCC King's Park Zoning Bylaws 2009"]),
    ("Belama", "subdivision", "verified_common_usage", ["BCC subdivision regulations"]),
    ("Belama Phase II", "subdivision", "verified_common_usage", []),
    ("Belama Phase III", "subdivision", "verified_common_usage", []),
    ("Port Loyola", "neighborhood", "verified_official", ["E&B Port Loyola constituency"]),
    ("Lake Independence", "neighborhood", "verified_official", ["E&B Lake Independence constituency"]),
    ("Mesopotamia", "neighborhood", "verified_official", ["E&B Mesopotamia constituency"]),
    ("Albert", "neighborhood", "verified_official", ["E&B Albert constituency"]),
    ("Pickstock", "neighborhood", "verified_official", ["E&B Pickstock constituency"]),
    ("Fort George", "neighborhood", "verified_official", ["E&B Fort George constituency"]),
    ("Collet", "neighborhood", "verified_official", ["E&B Collet constituency"]),
    ("Caribbean Shores", "neighborhood", "verified_official", ["E&B Caribbean Shores constituency"]),
    ("Freetown", "neighborhood", "verified_official", ["E&B Freetown constituency"]),
    ("Queen's Square", "neighborhood", "verified_official", ["E&B Queen's Square constituency"]),
    ("Palm Grove Estate", "subdivision", "verified_official", ["BCC planning regulations"]),
    ("Bella Vista", "subdivision", "verified_official", ["BCC Bella Vista Zoning Bylaws"]),
    ("West Landivar", "subdivision", "verified_official", ["BCC planning regulations"]),
]

COROZAL_TOWN_LOCALITIES = [
    ("Alta Mira", "subdivision", "verified_common_usage", []),
    ("Finca Solana", "subdivision", "verified_common_usage", []),
    ("Santa Rita", "locality", "verified_common_usage", ["Archaeological reserve area"]),
    ("Halls Layout", "subdivision", "verified_common_usage", []),
    ("Chula Vista", "subdivision", "verified_common_usage", []),
]

CAYO_LOCALITIES = [
    ("Maya Vista", "subdivision", "verified_common_usage", ["San Ignacio real estate market"]),
    ("Mountain Pine Ridge", "natural_area", "verified_official", ["Forest Department"]),
    ("Yalbac", "locality", "verified_common_usage", ["Cayo forest area"]),
]

# Ambergris — San Pedro Town is Area; island sectors are localities
AMBERGRIS = {
    "area": "San Pedro",
    "localities": [
        ("San Pedro Town Centre", "neighborhood", "verified_common_usage"),
        ("Boca del Rio", "neighborhood", "verified_common_usage"),
        ("San Juan", "neighborhood", "verified_common_usage"),
        ("San Mateo", "neighborhood", "verified_common_usage"),
        ("San Pablo", "neighborhood", "verified_common_usage"),
        ("DFC Area", "neighborhood", "verified_common_usage"),
        ("Escalante", "neighborhood", "verified_common_usage"),
        ("Mahogany Bay", "development", "verified_private_development"),
        ("Tres Cocos", "neighborhood", "verified_common_usage"),
        ("Boca Ciega", "locality", "verified_common_usage"),
        ("South Ambergris Caye", "coastal_locality", "verified_common_usage"),
        ("North Ambergris Caye", "coastal_locality", "verified_common_usage"),
        ("Secret Beach", "coastal_locality", "verified_common_usage"),
        ("Grand Belizean Estates", "development", "verified_private_development"),
        ("Mata Grande", "neighborhood", "verified_common_usage"),
        ("Mexico Rocks Area", "coastal_locality", "verified_common_usage"),
        ("Basil Jones", "coastal_locality", "verified_common_usage"),
        ("Robles Point", "coastal_locality", "verified_common_usage"),
        ("Cayo Frances", "island", "verified_common_usage"),
        ("Palmero Point", "coastal_locality", "verified_common_usage"),
        ("Mosquito Coast", "coastal_locality", "requires_review"),
        ("Marina Area", "locality", "verified_common_usage"),
    ],
}

CAYE_CAULKER = {
    "area": "Caye Caulker Village",
    "localities": [
        ("South Caye Caulker", "coastal_locality", "verified_common_usage"),
        ("North Caye Caulker", "coastal_locality", "verified_common_usage"),
        ("The Split", "coastal_locality", "verified_common_usage"),
        ("Airport Area", "locality", "verified_common_usage"),
        ("West Side", "coastal_locality", "verified_common_usage"),
        ("Bahia Area", "locality", "verified_common_usage"),
        ("Caye Caulker Estates", "development", "verified_private_development"),
    ],
}

BELIZE_ISLANDS = [
    ("Caye Chapel", "island", "verified_common_usage"),
    ("Turneffe Atoll", "island", "verified_official"),
    ("Goff's Caye", "caye", "verified_official"),
    ("English Caye", "caye", "verified_official"),
    ("Long Caye", "caye", "verified_common_usage"),
]

HIGHWAYS = [
    ("George Price Highway", "national_highway", "verified_official", ["SI 90/2023", "AR1"], ["Western Highway"], "national_highway_area"),
    ("Philip Goldson Highway", "national_highway", "verified_official", ["SI 90/2023", "AR2"], ["Northern Highway", "Old Northern Highway"], "national_highway_area"),
    ("Hummingbird Highway", "national_highway", "verified_official", ["SI 90/2023", "AR3"], [], "national_highway_area"),
    ("Coastal Plain Highway", "national_highway", "verified_official", ["SI 90/2023", "AR5"], ["Coastal Highway", "Manatee Highway"], "national_highway_area"),
    ("Thomas Vincent Ramos Highway", "national_highway", "verified_official", ["SI 90/2023", "AR4"], ["Southern Highway"], "national_highway_area"),
    ("Old Northern Highway", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("John Smith Road", "road_corridor", "requires_review", [], [], "road_corridor"),
    ("Burrell Boom Road", "road_corridor", "verified_official", ["E&B Belize Rural North"], [], "road_corridor"),
    ("San Antonio Road", "road_corridor", "verified_common_usage", ["Toledo access"], [], "road_corridor"),
    ("Jalacte Road", "road_corridor", "verified_official", ["Toledo"], [], "road_corridor"),
    ("Placencia Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Hopkins Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Consejo Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Maskall Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Cristo Rey Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Mountain Pine Ridge Road", "road_corridor", "verified_official", [], [], "road_corridor"),
    ("Caracol Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Spanish Lookout Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Bullet Tree Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Boom Creek Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Sarteneja Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Progresso Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Chunox Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("San Estevan Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Blue Creek Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
    ("Sittee River Road", "road_corridor", "verified_common_usage", [], [], "road_corridor"),
]

MILE_MARKERS = [
    ("Mile 8", "highway_section", "verified_common_usage", "belize", "Philip Goldson Highway"),
    ("Mile 12", "highway_section", "verified_common_usage", "stann-creek", "Hummingbird Highway"),
]

# Map census district key to map region slug (belize rural -> map-belize; san pedro -> ambergris)
DISTRICT_TO_MAP = {
    "corozal": "corozal",
    "orange-walk": "orange-walk",
    "belize": "belize",
    "cayo": "cayo",
    "stann-creek": "stann-creek",
    "toledo": "toledo",
}

locations = []
order = 0

def add(loc):
    global order
    order += 1
    loc["display_order"] = order
    loc.setdefault("active", True)
    loc.setdefault("aliases", [])
    loc.setdefault("source_refs", [])
    loc.setdefault("latitude", None)
    loc.setdefault("longitude", None)
    loc.setdefault("zoom_level", None)
    loc.setdefault("notes", "")
    locations.append(loc)

# Map regions
for mr in MAP_REGIONS:
    add({
        "id": mr["id"],
        "slug": mr["slug"],
        "name": mr["name"],
        "level": "map_region",
        "map_region_id": None,
        "administrative_district_id": f"admin-{mr['admin_district']}",
        "area_id": None,
        "locality_id": None,
        "location_type": "independent_map_island" if mr["slug"] in ("ambergris-caye", "caye-caulker") else "district",
        "official_status": "verified_official",
        "verification_status": "verified_official",
        "independent_map_region": mr["independent_map"],
        "svg_group": mr["svg_group"],
        "source_refs": ["SIB 2010 Census metadata", "geographyLayer.js"],
    })

# Admin districts
for ad in ADMIN_DISTRICTS:
    add({
        "id": ad["id"],
        "slug": ad["slug"],
        "name": ad["name"],
        "level": "administrative_district",
        "map_region_id": f"map-{ad['slug']}" if ad["slug"] not in ("ambergris-caye",) else None,
        "administrative_district_id": ad["id"],
        "area_id": None,
        "locality_id": None,
        "location_type": "district",
        "official_status": "verified_official",
        "verification_status": "verified_official",
        "source_refs": ["SIB 2010 Census"],
    })

# Tag Mennonite communities (already in census list — metadata pass)
MENNONITE_SET = set()
for d, names in MENNONITE_COMMUNITIES.items():
    for n in names:
        MENNONITE_SET.add((d, slugify(n)))

# Census settlements as areas
for district, data in CENSUS.items():
    map_slug = DISTRICT_TO_MAP[district]
    map_id = f"map-{map_slug}"
    admin_id = f"admin-{district}"

    for town in data["towns"]:
        if town == "San Pedro Town":
            continue  # under Ambergris map region
        if town == "Caye Caulker":
            continue
        town_slug = slugify(town.replace(" Town", ""))
        area_id = f"area-{district}-{town_slug}"
        loc_type = "city" if town == "Belize City" else "town"
        add({
            "id": area_id,
            "slug": town_slug,
            "name": town.replace(" Town", ""),
            "level": "area",
            "map_region_id": map_id,
            "administrative_district_id": admin_id,
            "area_id": area_id,
            "locality_id": None,
            "location_type": loc_type,
            "official_status": "verified_official",
            "verification_status": "verified_official",
            "source_refs": ["SIB 2010 Census Table P1"],
        })

    for village in data["villages"]:
        vslug = slugify(village)
        area_id = f"area-{district}-{vslug}"
        add({
            "id": area_id,
            "slug": vslug,
            "name": village,
            "level": "area",
            "map_region_id": map_id,
            "administrative_district_id": admin_id,
            "area_id": area_id,
            "locality_id": None,
            "location_type": "mennonite_community" if (district, vslug) in MENNONITE_SET else "village",
            "official_status": "verified_official",
            "verification_status": "verified_official",
            "source_refs": ["SIB 2010 Census Table P1", "E&B 2024"] if village in ("Estrella", "Yo Chen", "Bomba", "Beaver Dam", "Caves Branch", "St. Margaret's", "Punta Negra") else ["SIB 2010 Census Table P1"],
            "aliases": data.get("notes", {}).get(village, []),
            "notes": "Mennonite community" if (district, vslug) in MENNONITE_SET else "",
        })

# Belize City localities
bc_area = "area-belize-belize-city"
for name, ltype, vstatus, refs in BELIZE_CITY_LOCALITIES:
    add({
        "id": f"loc-belize-city-{slugify(name)}",
        "slug": slugify(name),
        "name": name,
        "level": "locality",
        "map_region_id": "map-belize",
        "administrative_district_id": "admin-belize",
        "area_id": bc_area,
        "locality_id": f"loc-belize-city-{slugify(name)}",
        "location_type": ltype,
        "official_status": vstatus,
        "verification_status": vstatus,
        "source_refs": refs,
    })

# Corozal Town localities
ct_area = "area-corozal-corozal"
for name, ltype, vstatus, refs in COROZAL_TOWN_LOCALITIES:
    add({
        "id": f"loc-corozal-town-{slugify(name)}",
        "slug": slugify(name),
        "name": name,
        "level": "locality",
        "map_region_id": "map-corozal",
        "administrative_district_id": "admin-corozal",
        "area_id": ct_area,
        "locality_id": f"loc-corozal-town-{slugify(name)}",
        "location_type": ltype,
        "official_status": vstatus,
        "verification_status": vstatus,
        "source_refs": refs,
    })

# Cayo extra localities under San Ignacio
si_area = "area-cayo-san-ignacio"
for name, ltype, vstatus, refs in CAYO_LOCALITIES:
    add({
        "id": f"loc-cayo-{slugify(name)}",
        "slug": slugify(name),
        "name": name,
        "level": "locality",
        "map_region_id": "map-cayo",
        "administrative_district_id": "admin-cayo",
        "area_id": si_area if name == "Maya Vista" else "area-cayo-mountain-pine-ridge" if name == "Mountain Pine Ridge" else si_area,
        "locality_id": f"loc-cayo-{slugify(name)}",
        "location_type": ltype,
        "official_status": vstatus,
        "verification_status": vstatus,
        "source_refs": refs,
    })

# Ambergris Caye
sp_area = "area-ambergris-caye-san-pedro"
add({
    "id": sp_area,
    "slug": "san-pedro",
    "name": "San Pedro",
    "level": "area",
    "map_region_id": "map-ambergris-caye",
    "administrative_district_id": "admin-belize",
    "area_id": sp_area,
    "locality_id": None,
    "location_type": "town",
    "official_status": "verified_official",
    "verification_status": "verified_official",
    "source_refs": ["SIB 2010 Census P1.7 San Pedro Town", "San Pedro Sun 2025 municipal boundary"],
    "aliases": ["San Pedro Town"],
})
for name, ltype, vstatus in AMBERGRIS["localities"]:
    add({
        "id": f"loc-ambergris-{slugify(name)}",
        "slug": slugify(name),
        "name": name,
        "level": "locality",
        "map_region_id": "map-ambergris-caye",
        "administrative_district_id": "admin-belize",
        "area_id": sp_area,
        "locality_id": f"loc-ambergris-{slugify(name)}",
        "location_type": ltype,
        "official_status": vstatus,
        "verification_status": vstatus,
        "source_refs": ["Common real estate usage", "San Pedro Sun"],
    })

# Caye Caulker — census village is area
cc_area = "area-caye-caulker-caye-caulker-village"
add({
    "id": cc_area,
    "slug": "caye-caulker-village",
    "name": "Caye Caulker Village",
    "level": "area",
    "map_region_id": "map-caye-caulker",
    "administrative_district_id": "admin-belize",
    "area_id": cc_area,
    "locality_id": None,
    "location_type": "village",
    "official_status": "verified_official",
    "verification_status": "verified_official",
    "source_refs": ["SIB 2010 Census P1.7 Caye Caulker"],
    "aliases": ["Caye Caulker"],
})
for name, ltype, vstatus in CAYE_CAULKER["localities"]:
    add({
        "id": f"loc-caye-caulker-{slugify(name)}",
        "slug": slugify(name),
        "name": name,
        "level": "locality",
        "map_region_id": "map-caye-caulker",
        "administrative_district_id": "admin-belize",
        "area_id": cc_area,
        "locality_id": f"loc-caye-caulker-{slugify(name)}",
        "location_type": ltype,
        "official_status": vstatus,
        "verification_status": vstatus,
        "source_refs": ["Common usage"],
    })

# Belize District islands (not separate map regions)
for name, ltype, vstatus in BELIZE_ISLANDS:
    add({
        "id": f"area-belize-{slugify(name)}",
        "slug": slugify(name),
        "name": name,
        "level": "area",
        "map_region_id": "map-belize",
        "administrative_district_id": "admin-belize",
        "area_id": f"area-belize-{slugify(name)}",
        "locality_id": None,
        "location_type": ltype,
        "official_status": vstatus,
        "verification_status": vstatus,
        "source_refs": ["Marine/coastal records"],
    })

# Highways — attach to relevant map regions
HIGHWAY_MAP = {
    "George Price Highway": ["belize", "cayo"],
    "Philip Goldson Highway": ["belize", "orange-walk", "corozal"],
    "Hummingbird Highway": ["cayo", "stann-creek"],
    "Coastal Plain Highway": ["belize", "stann-creek"],
    "Thomas Vincent Ramos Highway": ["stann-creek", "toledo"],
    "Old Northern Highway": ["belize", "orange-walk"],
    "Burrell Boom Road": ["belize"],
    "San Antonio Road": ["toledo"],
    "Jalacte Road": ["toledo"],
    "Placencia Road": ["stann-creek"],
    "Hopkins Road": ["stann-creek"],
    "Consejo Road": ["corozal"],
    "Maskall Road": ["belize"],
    "Cristo Rey Road": ["cayo", "corozal"],
    "Mountain Pine Ridge Road": ["cayo"],
    "Caracol Road": ["cayo"],
    "Spanish Lookout Road": ["cayo"],
    "Bullet Tree Road": ["cayo"],
    "Boom Creek Road": ["toledo"],
    "Sarteneja Road": ["corozal"],
    "Progresso Road": ["corozal"],
    "Chunox Road": ["corozal"],
    "San Estevan Road": ["orange-walk"],
    "Blue Creek Road": ["orange-walk", "toledo"],
    "Sittee River Road": ["stann-creek"],
    "John Smith Road": ["belize"],
}

for hw in HIGHWAYS:
    name, ltype, vstatus, refs, aliases, tier = hw
    for map_slug in HIGHWAY_MAP.get(name, ["belize"]):
        hw_id = f"hw-{map_slug}-{slugify(name)}"
        add({
            "id": hw_id,
            "slug": slugify(name),
            "name": name,
            "level": "area" if tier == "national_highway_area" else "locality",
            "map_region_id": f"map-{map_slug}",
            "administrative_district_id": f"admin-{map_slug}",
            "area_id": hw_id if tier == "national_highway_area" else None,
            "locality_id": hw_id if tier == "road_corridor" else None,
            "location_type": ltype if tier == "national_highway_area" else "road_corridor",
            "official_status": vstatus,
            "verification_status": vstatus,
            "source_refs": refs,
            "aliases": aliases,
            "notes": f"Classified as {tier}",
        })

for name, ltype, vstatus, map_slug, parent_hw in MILE_MARKERS:
    parent_slug = slugify(parent_hw)
    add({
        "id": f"mile-{map_slug}-{slugify(name)}",
        "slug": slugify(name),
        "name": name,
        "level": "locality",
        "map_region_id": f"map-{map_slug}",
        "administrative_district_id": f"admin-{map_slug}",
        "area_id": f"hw-{map_slug}-{parent_slug}",
        "locality_id": f"mile-{map_slug}-{slugify(name)}",
        "location_type": ltype,
        "official_status": vstatus,
        "verification_status": vstatus,
        "source_refs": ["Common real estate mile-marker usage"],
        "notes": f"Child of {parent_hw}",
    })

# Toledo marine / river corridors
for name in ["Golden Stream corridor", "Columbia River area", "Deep River area", "Temash River", "Moho River", "Rio Grande", "Port Honduras", "Sapodilla Cayes", "Snake Cayes"]:
    add({
        "id": f"loc-toledo-{slugify(name)}",
        "slug": slugify(name),
        "name": name,
        "level": "locality",
        "map_region_id": "map-toledo",
        "administrative_district_id": "admin-toledo",
        "area_id": "area-toledo-punta-gorda",
        "locality_id": f"loc-toledo-{slugify(name)}",
        "location_type": "coastal_locality" if "Caye" in name or "River" in name or "Port" in name else "rural_community",
        "official_status": "verified_common_usage",
        "verification_status": "requires_review",
        "source_refs": ["Toledo coastal/marine references"],
    })

# Stann Creek extras
for name, ltype in [
    ("Commerce Bight", "coastal_locality"),
    ("Cockscomb Basin", "natural_area"),
    ("Mayflower Bocawina", "natural_area"),
    ("Billy Barquedier", "natural_area"),
    ("Placencia Lagoon", "coastal_locality"),
    ("Mango Creek", "village"),
]:
    vstatus = "verified_official" if name == "Mango Creek" else "verified_common_usage"
    parent = "area-stann-creek-placencia" if name == "Placencia Lagoon" else "area-stann-creek-independence" if name == "Mango Creek" else "area-stann-creek-dangriga"
    add({
        "id": f"loc-stann-creek-{slugify(name)}",
        "slug": slugify(name),
        "name": name,
        "level": "locality" if ltype != "village" else "area",
        "map_region_id": "map-stann-creek",
        "administrative_district_id": "admin-stann-creek",
        "area_id": parent,
        "locality_id": None if ltype == "village" else f"loc-stann-creek-{slugify(name)}",
        "location_type": ltype,
        "official_status": vstatus,
        "verification_status": vstatus,
        "source_refs": ["E&B Stann Creek divisions", "Common usage"],
        "aliases": ["Independence"] if name == "Mango Creek" else [],
        "notes": "Mango Creek commonly marketed as Independence" if name == "Mango Creek" else "",
    })

# Orange Walk extras from E&B
for name in ["Lamanai Area", "Gallon Jug", "Chan Chich", "New River corridor", "Rio Hondo corridor", "Nuevo San Juan", "Fire Burn", "Sylvestre Camp", "Lemonal"]:
    map_slug = "orange-walk" if name not in ("Lemonal",) else "belize"
    admin = f"admin-{map_slug}"
    add({
        "id": f"loc-{map_slug}-{slugify(name)}",
        "slug": slugify(name),
        "name": name,
        "level": "locality",
        "map_region_id": f"map-{map_slug}",
        "administrative_district_id": admin,
        "area_id": f"area-{map_slug}-orange-walk" if map_slug == "orange-walk" else "area-belize-lemonal",
        "locality_id": f"loc-{map_slug}-{slugify(name)}",
        "location_type": "rural_community" if "corridor" in name.lower() else "locality",
        "official_status": "verified_common_usage",
        "verification_status": "requires_review" if name in ("Gallon Jug", "Chan Chich") else "verified_common_usage",
        "source_refs": ["E&B Orange Walk divisions", "Archaeological/ecotourism usage"],
    })

# Corozal extras
for name in ["Consejo Shores", "Four Mile Lagoon", "Cerros Peninsula", "Corozal Free Zone"]:
    add({
        "id": f"loc-corozal-{slugify(name)}",
        "slug": slugify(name),
        "name": name,
        "level": "locality",
        "map_region_id": "map-corozal",
        "administrative_district_id": "admin-corozal",
        "area_id": "area-corozal-consejo" if "Consejo" in name else "area-corozal-corozal",
        "locality_id": f"loc-corozal-{slugify(name)}",
        "location_type": "development" if "Shores" in name or "Free Zone" in name else "coastal_locality",
        "official_status": "verified_common_usage",
        "verification_status": "verified_common_usage",
        "source_refs": ["Real estate / commercial usage"],
    })

# Count totals
def count_type(t):
    return sum(1 for l in locations if l.get("location_type") == t)

def count_level(lvl):
    return sum(1 for l in locations if l.get("level") == lvl)

def count_review():
    return sum(1 for l in locations if l.get("verification_status") == "requires_review")

totals = {
    "interactive_map_regions": 8,
    "administrative_districts": 6,
    "cities": count_type("city"),
    "towns": count_type("town"),
    "villages": count_type("village"),
    "neighborhoods": count_type("neighborhood"),
    "subdivisions": count_type("subdivision"),
    "developments": count_type("development"),
    "highways_national": sum(1 for l in locations if l.get("location_type") == "national_highway"),
    "road_corridors": count_type("road_corridor"),
    "highway_sections": count_type("highway_section"),
    "islands_cayes": count_type("island") + count_type("caye"),
    "coastal_localities": count_type("coastal_locality"),
    "natural_areas": count_type("natural_area"),
    "rural_communities": count_type("rural_community"),
    "areas": count_level("area"),
    "localities": count_level("locality"),
    "total_unique_location_records": len(locations),
    "records_requiring_human_review": count_review(),
    "alias_records": sum(len(l.get("aliases") or []) for l in locations),
}

output = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "version": "1.0-seed-preview",
    "status": "uncommitted_preview_not_wired",
    "hierarchy_model": "map_region → area → neighborhood_locality",
    "preserves_eight_interactive_map_regions": True,
    "sources": [
        {"id": "sib-2010", "name": "SIB 2010 Population and Housing Census Tables P1.5–P1.10", "authority": "Statistical Institute of Belize", "url": "https://sib.org.bz/wp-content/uploads/2010_Census_Report.pdf"},
        {"id": "sib-2022", "name": "SIB Abstract of Statistics 2022", "authority": "Statistical Institute of Belize", "url": "https://sib.org.bz/wp-content/uploads/2022_Abstract_of_Statistics.pdf"},
        {"id": "rop-2024", "name": "Representation of the People Amendment Bill 2024", "authority": "National Assembly of Belize", "url": "https://www.nationalassembly.gov.bz/wp-content/uploads/2024/05/Representation-of-the-People-Amendment-Bill-2024.pdf"},
        {"id": "ebd-cayo", "name": "Cayo South Electoral Division boundary descriptions", "authority": "Elections and Boundaries Department", "url": "https://elections.gov.bz/wp-content/uploads/2023/12/Cayo-South.pdf"},
        {"id": "si-90-2023", "name": "Public Roads Names and Description of Highways Order 2023", "authority": "National Assembly of Belize", "url": "https://www.nationalassembly.gov.bz/wp-content/uploads/2023/11/SI-No.-90-of-2023-Public-Roads-Names-and-Description-of-Highways-Order-2023.pdf"},
        {"id": "bcc-planning", "name": "Belize City Council Planning Regulations and Zoning Bylaws", "authority": "Belize City Council", "url": "https://www.belizecitycouncil.org/lib/docs/planning/Regulations.pdf"},
        {"id": "repo-baseline", "name": "BelizeListings current-location-inventory.json", "authority": "Repository audit", "path": "docs/geography/current-location-inventory.json"},
    ],
    "highway_classification_rules": {
        "national_highway_area": "Major AR-numbered highways (George Price, Philip Goldson, Hummingbird, Coastal Plain, TV Ramos) stored as Area when listing is primarily corridor-addressed.",
        "road_corridor_locality": "District access roads stored as Locality under nearest settlement Area when property is inside a village/town; as Area only when corridor is primary market identity.",
        "mile_marker": "Stored as Locality under parent highway Area; requires highway slug uniqueness.",
        "alias_only": "Legacy names (Southern Highway, Coastal Highway, Western Highway) kept as aliases not separate records.",
    },
    "map_regions": MAP_REGIONS,
    "administrative_districts": ADMIN_DISTRICTS,
    "locations": locations,
    "totals": totals,
}

out_path = __file__.replace("_build_v1_seed_preview.py", "belize-v1-location-seed.preview.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"Wrote {len(locations)} records to {out_path}")
print(json.dumps(totals, indent=2))
