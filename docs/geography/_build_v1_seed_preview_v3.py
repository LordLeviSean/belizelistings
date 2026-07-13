#!/usr/bin/env python3
"""Generate belize-v1-location-seed.preview.v3.json + .md (docs only, not wired to app)."""
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


def make_area_id(map_slug: str, community_slug: str) -> str:
    if map_slug == "ambergris-caye":
        return f"area-ambergris-caye-{community_slug}"
    if map_slug == "caye-caulker":
        return f"area-caye-caulker-{community_slug}"
    return f"area-{map_slug}-{community_slug}"


MAP_REGIONS = [
    {"id": "map-belize", "slug": "belize", "name": "Belize", "admin_district": "belize"},
    {"id": "map-ambergris-caye", "slug": "ambergris-caye", "name": "Ambergris Caye", "admin_district": "belize"},
    {"id": "map-caye-caulker", "slug": "caye-caulker", "name": "Caye Caulker", "admin_district": "belize"},
    {"id": "map-cayo", "slug": "cayo", "name": "Cayo", "admin_district": "cayo"},
    {"id": "map-corozal", "slug": "corozal", "name": "Corozal", "admin_district": "corozal"},
    {"id": "map-orange-walk", "slug": "orange-walk", "name": "Orange Walk", "admin_district": "orange-walk"},
    {"id": "map-stann-creek", "slug": "stann-creek", "name": "Stann Creek", "admin_district": "stann-creek"},
    {"id": "map-toledo", "slug": "toledo", "name": "Toledo", "admin_district": "toledo"},
]

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
        "eb_only": [("Punta Negra", "village"), ("Wilson Road", "village"), ("Tambran", "village"), ("Hopeville", "village")],
        "aliases": {
            "Elridge": ["Eldridgeville"],
            "Jacinto": ["Jacintoville", "Westmoreland"],
            "Conejo": ["Conejo Creek"],
            "Corazón": ["Corazon Creek"],
        },
    },
}

# Parent-scoped localities ONLY — keyed by stable area_id
LOCALITIES_BY_AREA_ID: dict[str, list[tuple[str, str]]] = {
    "area-belize-belize-city": [
        ("Albert", "neighborhood"), ("Belama Phase 1", "subdivision"), ("Belama Phase 2", "subdivision"),
        ("Belama Phase 3", "subdivision"), ("Belama Phase 4", "subdivision"), ("Bella Vista", "subdivision"),
        ("Buttonwood Bay", "neighborhood"), ("Caribbean Shores", "neighborhood"), ("Collet", "neighborhood"),
        ("Coral Grove", "neighborhood"), ("Fort George", "neighborhood"), ("Freetown", "neighborhood"),
        ("King's Park", "neighborhood"), ("Lake Independence", "neighborhood"), ("Mesopotamia", "neighborhood"),
        ("New Horizon", "neighborhood"), ("Pickstock", "neighborhood"), ("Port Loyola", "neighborhood"),
        ("Queen's Square", "neighborhood"), ("Saint Martin de Porres", "neighborhood"),
        ("West Landivar", "subdivision"), ("Yarborough", "neighborhood"),
    ],
    "area-belize-ladyville": [
        ("Vista Del Mar", "locality"), ("Lake Gardens", "locality"), ("Airport Area", "locality"),
        ("Central Park Area", "locality"),
    ],
    "area-cayo-belmopan": [
        ("Belmopan City Centre", "locality"), ("Salvapan", "neighborhood"), ("San Martin", "neighborhood"),
        ("Maya Mopan", "neighborhood"), ("Las Flores", "neighborhood"), ("Cohune Walk", "locality"),
        ("University Heights", "locality"), ("Mountain View", "locality"), ("Piccini", "locality"),
    ],
    "area-cayo-san-ignacio": [
        ("Maya Vista", "subdivision"), ("Cahal Pech", "locality"), ("Santiago Juan Layout", "subdivision"),
        ("Kontiki", "locality"), ("Bullet Tree Road Area", "locality"), ("Branch Mouth Road Area", "locality"),
        ("Elena Area", "locality"),
    ],
    "area-cayo-santa-elena": [
        ("Hawksworth Bridge Area", "locality"), ("Bullet Tree Falls Junction", "locality"),
        ("Santa Elena Town Centre", "locality"), ("Loma Linda", "locality"), ("Cristo Rey Road Area", "locality"),
    ],
    "area-cayo-benque-viejo": [
        ("Benque Hills", "locality"), ("Arenal Area", "locality"), ("Benque Town Centre", "locality"),
    ],
    "area-corozal-corozal": [
        ("Alta Mira", "subdivision"), ("Finca Solana", "subdivision"), ("Santa Rita", "locality"),
        ("Halls Layout", "subdivision"), ("Chula Vista", "subdivision"), ("Rainbow Town", "locality"),
        ("College Road Area", "locality"), ("Consejo Road Area", "locality"),
    ],
    "area-corozal-san-pedro": [],
    "area-orange-walk-orange-walk": [
        ("San Francisco", "locality"), ("Otro Benque", "locality"), ("Louisiana Area", "locality"),
        ("San Lorenzo Housing Site", "locality"), ("Orange Walk Town Centre", "locality"),
    ],
    "area-stann-creek-dangriga": [
        ("Benguche", "locality"), ("New Site", "locality"), ("Rivas Estate", "locality"),
        ("Wagierale", "locality"), ("Commerce Bight Area", "locality"),
    ],
    "area-stann-creek-placencia": [
        ("Placencia Village", "locality"), ("Plantation", "locality"), ("Surfside", "locality"),
        ("Caribbean Way", "locality"), ("Cocoplum", "locality"), ("Placencia Lagoon", "coastal_locality"),
        ("North Placencia", "locality"), ("South Placencia", "locality"),
    ],
    "area-toledo-punta-gorda": [
        ("Punta Gorda Town Centre", "locality"), ("Port Area", "locality"), ("Indianville", "locality"),
        ("New Site", "locality"), ("Joe Taylor Creek", "locality"), ("Toledo Settlement Fringe", "locality"),
    ],
    "area-toledo-santa-elena": [],
    "area-ambergris-caye-san-pedro": [
        ("San Pedro Town Centre", "locality"), ("Boca del Rio", "locality"), ("San Mateo", "neighborhood"),
        ("San Pablo", "locality"), ("DFC Area", "locality"), ("Escalante", "locality"),
        ("Mahogany Bay", "development"), ("Tres Cocos", "locality"), ("Boca Ciega", "locality"),
        ("South Ambergris Caye", "coastal_locality"), ("North Ambergris Caye", "coastal_locality"),
        ("Secret Beach", "coastal_locality"), ("Grand Belizean Estates", "development"),
        ("Mata Grande", "locality"), ("Mexico Rocks Area", "locality"), ("Basil Jones", "locality"),
        ("Robles Point", "locality"), ("Marina Area", "locality"),
    ],
    "area-caye-caulker-caye-caulker-village": [
        ("The Split", "coastal_locality"), ("North Caye Caulker", "coastal_locality"),
        ("South Caye Caulker", "coastal_locality"), ("Airport Area", "locality"),
        ("West Side", "coastal_locality"), ("Bahia Area", "locality"), ("Caye Caulker Estates", "development"),
    ],
}

DUPLICATE_PLACE_NAMES = [
    {"name": "San Pedro", "records": ["area-corozal-san-pedro (village)", "area-ambergris-caye-san-pedro (town)"]},
    {"name": "Santa Elena", "records": ["area-cayo-santa-elena (town)", "area-toledo-santa-elena (village)"]},
    {"name": "San Antonio", "records": ["area-corozal-san-antonio", "area-cayo-san-antonio", "area-orange-walk-san-antonio", "area-toledo-san-antonio"]},
    {"name": "San José", "records": ["area-orange-walk-san-jose", "area-toledo-san-jose", "area-cayo-san-jose-succotz"]},
    {"name": "San Juan", "records": ["area-orange-walk-san-juan", "area-stann-creek-san-juan", "loc under area-ambergris-caye-san-pedro only"]},
    {"name": "San Pablo", "records": ["area-orange-walk-san-pablo", "area-toledo-san-pablo", "loc under area-ambergris-caye-san-pedro only"]},
    {"name": "San Román", "records": ["area-corozal-san-roman", "area-orange-walk-san-roman", "area-stann-creek-san-roman"]},
    {"name": "Santa Cruz", "records": ["area-orange-walk-santa-cruz", "area-stann-creek-santa-cruz", "area-toledo-santa-cruz"]},
    {"name": "Cristo Rey", "records": ["area-corozal-cristo-rey", "area-cayo-cristo-rey"]},
    {"name": "Buena Vista", "records": ["area-corozal-buena-vista", "area-cayo-buena-vista"]},
    {"name": "Blue Creek", "records": ["area-orange-walk-blue-creek", "area-toledo-blue-creek (mennonite)"]},
    {"name": "Bella Vista", "records": ["area-toledo-bella-vista (village)", "neighborhood under Belize City only"]},
    {"name": "Indian Creek", "records": ["area-orange-walk-indian-creek", "area-toledo-indian-creek"]},
    {"name": "San Felipe", "records": ["area-orange-walk-san-felipe", "area-toledo-san-felipe"]},
    {"name": "San Vicente", "records": ["area-toledo-san-vicente only"]},
    {"name": "Altamira / Alta Mira", "records": ["area-corozal-altamira (census village)", "Alta Mira (Corozal Town subdivision) — related spelling, separate IDs"]},
]

HIGHWAYS = [
    {"name": "George Price Highway", "slug": "george-price-highway", "map_region_slugs": ["belize", "cayo"],
     "aliases": ["Western Highway"], "approx_mile_max": 76, "named_mile_examples": ["Mile 8", "Mile 10", "Mile 12", "Mile 32"]},
    {"name": "Philip Goldson Highway", "slug": "philip-goldson-highway", "map_region_slugs": ["belize", "orange-walk", "corozal"],
     "aliases": ["Northern Highway"], "approx_mile_max": 95, "named_mile_examples": ["Mile 8", "Mile 13"]},
    {"name": "Hummingbird Highway", "slug": "hummingbird-highway", "map_region_slugs": ["cayo", "stann-creek"],
     "aliases": [], "approx_mile_max": 55, "named_mile_examples": ["Mile 12", "Mile 32"]},
    {"name": "Coastal Plain Highway", "slug": "coastal-plain-highway", "map_region_slugs": ["belize", "stann-creek"],
     "aliases": ["Coastal Highway", "Manatee Highway"], "approx_mile_max": 36, "named_mile_examples": ["Mile 15"]},
    {"name": "Thomas Vincent Ramos Highway", "slug": "thomas-vincent-ramos-highway", "map_region_slugs": ["stann-creek", "toledo"],
     "aliases": ["Southern Highway"], "approx_mile_max": 97, "named_mile_examples": []},
]

ALIAS_ONLY_HIGHWAY = [
    ("Old Northern Highway", "Philip Goldson Highway", "legacy corridor name; not separate canonical highway"),
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
    ("Caye Chapel", "belize"), ("Turneffe Atoll", "belize"), ("Goff's Caye", "belize"), ("English Caye", "belize"),
]

locations: list[dict] = []
order = 0
REQUIRES_REVIEW: list[str] = []


def add(**kwargs):
    global order
    order += 1
    rec = {"display_order": order, "active": True, "latitude": None, "longitude": None, "zoom_level": None, "notes": "", **kwargs}
    if rec.get("verification_status") == "requires_review":
        REQUIRES_REVIEW.append(rec["name"])
    locations.append(rec)
    return rec


def tier_label(ctype: str) -> str:
    return {"city": "City", "town": "Town", "village": "Village", "mennonite_community": "Village", "caye": "Caye"}.get(ctype, "Community")


for mr in MAP_REGIONS:
    add(id=mr["id"], slug=mr["slug"], name=mr["name"], level="map_region",
        map_region_id=None, administrative_district_id=f"admin-{mr['admin_district']}",
        area_id=None, locality_id=None,
        location_type="independent_map_island" if mr["slug"] in ("ambergris-caye", "caye-caulker") else "district",
        ui_tier="Map Region" if mr["slug"] in ("ambergris-caye", "caye-caulker") else "District",
        verification_status="verified_official", source_refs=["SIB 2010"])

for d in ["corozal", "orange-walk", "belize", "cayo", "stann-creek", "toledo"]:
    add(id=f"admin-{d}", slug=d, name=d.replace("-", " ").title(), level="administrative_district",
        map_region_id=f"map-{d}", administrative_district_id=f"admin-{d}",
        area_id=None, locality_id=None, location_type="district", ui_tier="Administrative District",
        verification_status="verified_official", source_refs=["SIB 2010"])

for district, data in CENSUS.items():
    map_slug = district
    for source_list, src in [(data["communities"], "SIB 2010 Census P1"), (data.get("eb_only", []), "E&B / local RE")]:
        for name, ctype in source_list:
            if name in ("San Pedro Town",):
                continue
            if name == "Caye Caulker":
                continue
            comm_slug = slugify(name.replace(" Town", ""))
            aid = make_area_id(map_slug, comm_slug)
            aliases = list(data.get("aliases", {}).get(name.replace(" Town", ""), data.get("aliases", {}).get(name, [])))
            if name == "Independence":
                aliases = ["Mango Creek"]
            notes = ""
            if aid == "area-corozal-san-pedro":
                notes = "Corozal village; no Ambergris localities."
            if aid == "area-toledo-santa-elena":
                notes = "Toledo village; no Cayo Santa Elena Town localities."
            if aid == "area-corozal-altamira":
                notes = "Census village Altamira; market spelling Alta Mira is Corozal Town subdivision only."
            if name == "Hopeville":
                notes = "Village north of Punta Gorda; separate from Hope Creek (Stann Creek)."
            add(id=aid, slug=comm_slug, name=name.replace(" Town", ""), level="community",
                map_region_id=f"map-{map_slug}", administrative_district_id=f"admin-{district}",
                area_id=aid, locality_id=None, location_type=ctype, ui_tier=tier_label(ctype),
                verification_status="verified_official" if src.startswith("SIB") else "verified_common_usage",
                source_refs=[src], aliases=aliases, notes=notes)
            for loc_name, loc_type in LOCALITIES_BY_AREA_ID.get(aid, []):
                lid = f"loc-{aid}-{slugify(loc_name)}"
                add(id=lid, slug=slugify(loc_name), name=loc_name, level="locality",
                    map_region_id=f"map-{map_slug}", administrative_district_id=f"admin-{district}",
                    area_id=aid, locality_id=lid, location_type=loc_type, ui_tier="Neighborhood / Locality",
                    verification_status="verified_common_usage", source_refs=["BCC / RE / municipal usage"],
                    parent_scope_id=aid)

# Ambergris San Pedro (SIB San Pedro Town)
add(id="area-ambergris-caye-san-pedro", slug="san-pedro", name="San Pedro", level="community",
    map_region_id="map-ambergris-caye", administrative_district_id="admin-belize",
    area_id="area-ambergris-caye-san-pedro", locality_id=None, location_type="town", ui_tier="Town",
    verification_status="verified_official", source_refs=["SIB 2010 P1.7", "San Pedro Sun 2025"],
    aliases=["San Pedro Town", "San Pedro Island"], notes="Ambergris Caye town only; not Corozal San Pedro village.")
for loc_name, loc_type in LOCALITIES_BY_AREA_ID["area-ambergris-caye-san-pedro"]:
    lid = f"loc-area-ambergris-caye-san-pedro-{slugify(loc_name)}"
    add(id=lid, slug=slugify(loc_name), name=loc_name, level="locality",
        map_region_id="map-ambergris-caye", administrative_district_id="admin-belize",
        area_id="area-ambergris-caye-san-pedro", locality_id=lid, location_type=loc_type,
        ui_tier="Neighborhood / Locality",
        verification_status="verified_private_development" if loc_name == "Mahogany Bay" else "verified_common_usage",
        source_refs=["RE market"], parent_scope_id="area-ambergris-caye-san-pedro")

# Caye Caulker Village
add(id="area-caye-caulker-caye-caulker-village", slug="caye-caulker-village", name="Caye Caulker Village",
    level="community", map_region_id="map-caye-caulker", administrative_district_id="admin-belize",
    area_id="area-caye-caulker-caye-caulker-village", locality_id=None, location_type="village", ui_tier="Village",
    verification_status="verified_official", source_refs=["SIB 2010 P1.7"], aliases=["Caye Caulker"])
for loc_name, loc_type in LOCALITIES_BY_AREA_ID["area-caye-caulker-caye-caulker-village"]:
    lid = f"loc-area-caye-caulker-caye-caulker-village-{slugify(loc_name)}"
    add(id=lid, slug=slugify(loc_name), name=loc_name, level="locality",
        map_region_id="map-caye-caulker", administrative_district_id="admin-belize",
        area_id="area-caye-caulker-caye-caulker-village", locality_id=lid, location_type=loc_type,
        ui_tier="Neighborhood / Locality", verification_status="verified_common_usage",
        source_refs=["Tourism/common usage"], parent_scope_id="area-caye-caulker-caye-caulker-village")

for iname, dist in ISLANDS:
    aid = make_area_id(dist, slugify(iname))
    add(id=aid, slug=slugify(iname), name=iname, level="community", map_region_id=f"map-{dist}",
        administrative_district_id=f"admin-{dist}", area_id=aid, locality_id=None, location_type="island",
        ui_tier="Island / Caye", verification_status="verified_official", source_refs=["Marine records"])

for hw in HIGHWAYS:
    hid = f"highway-{hw['slug']}"
    add(id=hid, slug=hw["slug"], name=hw["name"], level="highway", map_region_id=None,
        map_region_slugs=hw["map_region_slugs"], administrative_district_id=None, area_id=hid, locality_id=None,
        location_type="national_highway", ui_tier="Highway", verification_status="verified_official",
        source_refs=["SI 90/2023"], aliases=hw["aliases"],
        approx_mile_max=hw["approx_mile_max"],
        notes="Single canonical record; use geo_highway_map_regions at implementation.")
    for mile in hw["named_mile_examples"]:
        mid = f"{hid}-{slugify(mile)}"
        add(id=mid, slug=slugify(mile), name=mile, level="highway_named_section",
            map_region_id=None, map_region_slugs=hw["map_region_slugs"], area_id=hid, locality_id=mid,
            location_type="highway_named_section", ui_tier="Highway Locality",
            verification_status="verified_common_usage", source_refs=["RE examples"],
            parent_highway_id=hid, mile_number=int(re.search(r"\d+", mile).group()))

for name, maps, status in ROAD_CORRIDORS:
    add(id=f"road-{slugify(name)}", slug=slugify(name), name=name, level="road_corridor",
        map_region_id=None, map_region_slugs=maps, location_type="road_corridor", ui_tier="Road Corridor",
        verification_status=status, source_refs=["E&B / RE"])

KNOWN_GAPS = [
    "SIB 'Other - {District}' unnamed settlement buckets (6 districts)",
    "Honey Camp (secondary municipality lists; not in SIB P1)",
    "Machacilha / Machakilha (E&B Toledo East spelling)",
    "Na Lum Cah spelling variants",
    "Crique Trosa (secondary lists)",
]

HIGHWAY_MILE_STRATEGY = {
    "v1_recommendation": "hybrid",
    "canonical_highways": "geo_highways — one row per physical highway",
    "map_association": "geo_highway_map_regions (highway_id, map_region_id)",
    "mile_selection": "geo_listing_highway_mile (listing_id, highway_id, mile_number integer) validated 1..approx_mile_max",
    "named_sections": "Optional geo_highway_sections for RE-common examples (Mile 8, Mile 12); not every integer seeded",
    "display_format": "Mile {n}, {Highway Name}, {District}",
    "settlement_priority": "If property is inside a named city/town/village, community wins; highway mile is secondary",
    "slug_uniqueness": "Mile numbers scoped to parent highway_id — Mile 8 on PGH ≠ Mile 8 on Philip Goldson without highway parent",
}

def cnt(**kw):
    return sum(1 for l in locations if all(l.get(k) == v for k, v in kw.items()))

totals = {
    "interactive_map_regions": 8,
    "administrative_districts": 6,
    "cities": cnt(location_type="city"),
    "towns": cnt(location_type="town"),
    "villages": cnt(location_type="village"),
    "mennonite_communities": cnt(location_type="mennonite_community"),
    "neighborhoods": cnt(location_type="neighborhood"),
    "localities": sum(1 for l in locations if l.get("level") == "locality"),
    "subdivisions": cnt(location_type="subdivision"),
    "developments": cnt(location_type="development"),
    "national_highways": cnt(location_type="national_highway"),
    "highway_named_sections": cnt(location_type="highway_named_section"),
    "road_corridors": cnt(location_type="road_corridor"),
    "islands_cayes": cnt(location_type="island") + cnt(location_type="caye"),
    "communities_total": cnt(level="community"),
    "total_geography_records": len(locations),
    "records_requires_review": len(set(REQUIRES_REVIEW)),
}

payload = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "version": "1.0-seed-preview-v3",
    "status": "approved_reference_not_wired",
    "ui_hierarchy": ["District", "City / Town / Village", "Neighborhood / Locality"],
    "parent_scoping_rule": "All identities resolve by area_id / map_region_id + administrative_district_id — never display name alone",
    "mango_creek_independence_decision": {
        "canonical_name": "Independence",
        "aliases": ["Mango Creek"],
        "user_facing_display": "Independence (alias: Mango Creek)",
        "sib_2010_census": "Independence",
        "area_id": "area-stann-creek-independence",
        "separate_from": "Hope Creek (area-stann-creek-hope-creek)",
    },
    "hopeville_decision": {
        "canonical_name": "Hopeville",
        "area_id": "area-toledo-hopeville",
        "classification": "village north of Punta Gorda",
        "separate_from": "Hope Creek (Stann Creek)",
        "sources": ["GeoNames", "RE listings", "local knowledge"],
    },
    "highway_mile_strategy": HIGHWAY_MILE_STRATEGY,
    "duplicate_place_names": DUPLICATE_PLACE_NAMES,
    "highway_architecture": "single_canonical_highway_with_geo_highway_map_regions",
    "alias_only_highways": ALIAS_ONLY_HIGHWAY,
    "known_gaps": KNOWN_GAPS,
    "requires_review": sorted(set(REQUIRES_REVIEW)),
    "locations": locations,
    "totals": totals,
}

(ROOT / "belize-v1-location-seed.preview.v3.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

# Build MD
SECTION_ORDER = [
    ("map-belize", "Belize District"),
    ("map-ambergris-caye", "Ambergris Caye (Administrative District: Belize)"),
    ("map-caye-caulker", "Caye Caulker (Administrative District: Belize)"),
    ("map-cayo", "Cayo District"),
    ("map-corozal", "Corozal District"),
    ("map-orange-walk", "Orange Walk District"),
    ("map-stann-creek", "Stann Creek District"),
    ("map-toledo", "Toledo District"),
]

by_map: dict[str, list] = defaultdict(list)
locs_by_area: dict[str, list] = defaultdict(list)
for loc in locations:
    if loc["level"] == "community":
        by_map[loc["map_region_id"]].append(loc)
    elif loc["level"] in ("locality", "highway_named_section") and loc.get("area_id"):
        locs_by_area[loc["area_id"]].append(loc)

md = ["# BelizeListings V1.0 Geography", "", f"*Preview v3 — {payload['generated_at']}*", "",
      "## Mango Creek / Independence", "",
      "**Decision:** Canonical community name is **Independence** (SIB 2010 Census P1.9).",
      "**Alias:** Mango Creek (common and RE usage).",
      "**Display:** Independence (alias: Mango Creek)",
      "**Area ID:** `area-stann-creek-independence`",
      "**Separate from:** Hope Creek (`area-stann-creek-hope-creek`)",
      "", "## Hopeville", "",
      "**Decision:** Separate village **Hopeville** north of Punta Gorda (`area-toledo-hopeville`).",
      "**Not** Hope Creek (Stann Creek).",
      ""]

for map_id, title in SECTION_ORDER:
    prefix = "🏝 Map Region: " if "ambergris" in map_id or "caye-caulker" in map_id else "🌎 District: "
    md.append(f"{prefix}{title}")
    md.append("")
    for comm in sorted(by_map.get(map_id, []), key=lambda x: x["name"]):
        alias_note = f" (aliases: {', '.join(comm['aliases'])})" if comm.get("aliases") else ""
        md.append(f"→ {comm['ui_tier']}: {comm['name']}{alias_note}")
        children = sorted(locs_by_area.get(comm["id"], []), key=lambda x: x["name"])
        for ch in children:
            md.append(f"  → {ch['name']}")
        if not children and comm["id"] in ("area-corozal-san-pedro", "area-toledo-santa-elena"):
            md.append("  → (no child localities — parent-scoped standalone community)")
        md.append("")

md.append("## Highways (canonical — one record each)")
md.append("")
for hw in [l for l in locations if l["level"] == "highway"]:
    md.append(f"→ Highway: {hw['name']}")
    md.append(f"  → Map regions: {', '.join(hw['map_region_slugs'])}")
    if hw.get("aliases"):
        md.append(f"  → Legacy aliases (not separate records): {', '.join(hw['aliases'])}")
    md.append(f"  → Mile model: validated integer 1–{hw.get('approx_mile_max')} per listing + named examples below")
    for sec in sorted(locs_by_area.get(hw["id"], []), key=lambda x: x["name"]):
        md.append(f"  → {sec['name']} (named section example)")
    md.append("")

md.append("## Road Corridors")
for rc in sorted([l for l in locations if l["level"] == "road_corridor"], key=lambda x: x["name"]):
    md.append(f"- {rc['name']}")
md.append("")
md.append("## Summary")
for k, v in totals.items():
    md.append(f"- {k.replace('_', ' ').title()}: {v}")
md.append("")
md.append("**This is the complete proposed BelizeListings V1.0 Geography hierarchy ready to be frozen for implementation.**")
md.append("")
md.append("*Production implementation remains gated behind Open Beta passing.*")

(ROOT / "belize-v1-location-seed.preview.v3.md").write_text("\n".join(md), encoding="utf-8")
print("v3 totals:", json.dumps(totals, indent=2))
