const PRESET = [
  { re: /ocean|sea view|waterfront|beachfront|waterview/i, label: "Ocean & water proximity" },
  { re: /dock|marina|boat slip/i, label: "Dock / marina access" },
  { re: /investment|rental income|roi/i, label: "Investment angle" },
  { re: /walk to beach|steps to sand|beach walk/i, label: "Walk-to-beach lifestyle" },
  { re: /gated|security|24[\s-]?hour/i, label: "Gated / secure context" },
  { re: /luxury|designer|high end|premium finish/i, label: "Premium finishes" },
  { re: /resort|amenities|pool|spa/i, label: "Resort-style amenities" },
  { re: /jungle|rainforest|private reserve/i, label: "Lush natural setting" },
];

/**
 * Premium highlight chips: structured `amenities` or legacy `features` CSV first, then keyword inference from copy.
 */
export function derivePropertyHighlights(listing = {}, { max = 8 } = {}) {
  const out = [];
  const seen = new Set();

  const pushLabel = (s, source) => {
    if (s.length < 2 || s.length > 48) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label: s, source });
  };

  if (Array.isArray(listing?.amenities) && listing.amenities.length) {
    for (const raw of listing.amenities) {
      const s = String(raw).trim();
      pushLabel(s, "amenities");
      if (out.length >= max) return out;
    }
  } else {
    const rawFeatures = String(listing?.features || "").trim();
    if (rawFeatures) {
      for (const part of rawFeatures.split(/[,;]/)) {
        pushLabel(part.trim(), "features");
        if (out.length >= max) return out;
      }
    }
  }

  const haystack = `${listing?.title || ""} ${listing?.description || ""}`.trim();
  if (!haystack) return out;

  for (const { re, label } of PRESET) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    if (re.test(haystack)) {
      seen.add(key);
      out.push({ label, source: "inferred" });
      if (out.length >= max) break;
    }
  }

  return out.slice(0, max);
}
