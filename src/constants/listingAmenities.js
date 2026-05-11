/**
 * Canonical BelizeListings amenity vocabulary for structured inventory (TEXT[] on `listings.amenities`).
 * Labels are stable storage values — do not rename without a data migration.
 */

export const LISTING_AMENITY_GROUPS = [
  {
    id: "outdoor",
    label: "Outdoor",
    items: ["Waterfront", "Beach access", "Sea view", "Garden", "Pool", "Dock"],
  },
  {
    id: "comfort",
    label: "Comfort",
    items: ["Air conditioning", "Furnished", "Laundry", "Balcony", "Gated"],
  },
  {
    id: "utilities",
    label: "Utilities",
    items: ["Solar", "Backup generator", "Water storage", "Internet ready"],
  },
  {
    id: "investment",
    label: "Investment",
    items: ["Commercial use", "Development potential", "Subdividable", "Road access"],
  },
  {
    id: "land",
    label: "Land-specific",
    items: ["Cleared land", "Corner lot", "Lagoon frontage", "Jungle frontage"],
  },
];

const CANONICAL_BY_NORMALIZED = new Map();

for (const g of LISTING_AMENITY_GROUPS) {
  for (const label of g.items) {
    CANONICAL_BY_NORMALIZED.set(normalizeAmenityKey(label), label);
  }
}

export function normalizeAmenityKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Map a user/legacy token to the canonical label, or null. */
export function canonicalizeAmenityToken(raw) {
  const k = normalizeAmenityKey(raw);
  return CANONICAL_BY_NORMALIZED.get(k) ?? null;
}

export function sanitizeAmenitiesArray(input) {
  if (!Array.isArray(input)) return [];
  const wanted = new Set();
  for (const x of input) {
    const c = canonicalizeAmenityToken(x);
    if (c) wanted.add(c);
  }
  const out = [];
  for (const g of LISTING_AMENITY_GROUPS) {
    for (const item of g.items) {
      if (wanted.has(item)) out.push(item);
    }
  }
  return out;
}

export function splitLegacyFeaturesString(featStr) {
  const raw = String(featStr || "").trim();
  if (!raw) return { matched: [], unmatchedParts: [] };
  const matched = [];
  const unmatchedParts = [];
  const seen = new Set();
  for (const part of raw.split(/[,;]/)) {
    const c = canonicalizeAmenityToken(part);
    if (c) {
      if (!seen.has(c)) {
        seen.add(c);
        matched.push(c);
      }
    } else {
      const t = part.trim();
      if (t) unmatchedParts.push(t);
    }
  }
  return { matched, unmatchedParts };
}

/**
 * Hydrate form state from a listing row. Prefers `amenities` when non-empty; otherwise parses `features` CSV.
 * Unmatched legacy freeform is returned as `legacyFeaturesTail` (preserved on save).
 */
export function amenitiesFromListingRow(listing = {}) {
  const arr = listing?.amenities;
  if (Array.isArray(arr) && arr.length > 0) {
    const normalized = arr
      .map((x) => canonicalizeAmenityToken(String(x)))
      .filter(Boolean);
    return {
      amenities: sanitizeAmenitiesArray(normalized),
      legacyFeaturesTail: "",
    };
  }

  const feat = String(listing?.features ?? "").trim();
  if (!feat) {
    return { amenities: [], legacyFeaturesTail: "" };
  }

  const { matched, unmatchedParts } = splitLegacyFeaturesString(feat);
  return {
    amenities: sanitizeAmenitiesArray(matched),
    legacyFeaturesTail: unmatchedParts.join(", "),
  };
}

/** Land workspace: show land-specific group first without forking the component. */
export function orderedAmenityGroups(prioritizeLand) {
  const g = LISTING_AMENITY_GROUPS.map((group) => ({ ...group, items: [...group.items] }));
  if (prioritizeLand) {
    const i = g.findIndex((x) => x.id === "land");
    if (i > 0) {
      const [block] = g.splice(i, 1);
      g.unshift(block);
    }
  }
  return g;
}

/** Lowercase haystack for filters / search (amenities array + legacy features string + description). */
export function listingAmenitiesSearchHaystack(listing = {}) {
  const parts = [];
  if (Array.isArray(listing?.amenities) && listing.amenities.length) {
    parts.push(...listing.amenities);
  }
  const f = String(listing?.features || "").trim();
  if (f) parts.push(f);
  const d = String(listing?.description || "").trim();
  if (d) parts.push(d);
  return parts.join(" \n ").toLowerCase();
}
