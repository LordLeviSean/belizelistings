/**
 * Ensure static / public URLs work on every route. Paths without a leading `/`
 * resolve relative to the current page (e.g. `listings/x.png` on `/listing/5`
 * becomes `/listing/listings/x.png` and 404s).
 */
/** Normalize `images[]` entry: string URL or `{ image_url }` object. */
export function normalizeListingImageEntry(entry) {
  if (entry == null) return "";
  if (typeof entry === "string") return resolveListingImageUrl(entry);
  return resolveListingImageUrl(entry?.image_url ?? entry?.url ?? "");
}

export function resolveListingImageUrl(url) {
  if (url == null) return "";
  const s = String(url).trim();
  if (s === "") return "";
  /* Local preview URLs must pass through unchanged (browser-local blobs / data URIs). */
  if (/^blob:/i.test(s) || /^data:/i.test(s)) return s;
  if (/^https?:\/\//i.test(s) || s.startsWith("//")) return s;
  const rooted = s.startsWith("/") ? s : `/${s}`;

  // Many records are stored as "/listings/house1" while files are ".png" in public/.
  // If no extension is present, default to .png for local static assets.
  const hasQueryOrHash = rooted.includes("?") || rooted.includes("#");
  if (hasQueryOrHash) return rooted;
  const lastSegment = rooted.split("/").pop() ?? "";
  const hasExtension = /\.[A-Za-z0-9]+$/.test(lastSegment);
  if (!hasExtension) return `${rooted}.png`;
  return rooted;
}

/** Primary image for cards: first valid image_url in images[], or null. */
export function getListingPrimaryImageSrc(listing) {
  const first = listing?.images?.[0];
  return first?.image_url ? resolveListingImageUrl(first.image_url) : null;
}

/** All non-empty image URLs (for listing detail gallery). */
export function getListingValidImages(listing) {
  if (!listing?.images?.length) return [];
  return listing.images
    .map((img) => resolveListingImageUrl(img?.image_url))
    .filter((url) => url !== "");
}

/** Raw URL from a listing_images table row (column names vary by schema). */
export function listingImageRowToRawUrl(row) {
  if (!row || typeof row !== "object") return "";
  const raw = row.image_url ?? row.url ?? row.path ?? row.public_url ?? "";
  return raw == null ? "" : String(raw).trim();
}

/** Normalize Supabase row with listing_images relation into images[]. */
export function mapListingWithImages(listing) {
  const normalizedImages =
    listing?.listing_images
      ?.map((img, idx) => ({
        image_url: resolveListingImageUrl(listingImageRowToRawUrl(img)),
        position: img?.position ?? idx,
      }))
      .filter((img) => typeof img.image_url === "string" && img.image_url.trim().length > 0)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) || [];

  return {
    ...listing,
    images: normalizedImages,
  };
}

/** Normalize list of rows with listing_images relation into images[]. */
export function mapListingsWithImages(data) {
  return (data || []).map(mapListingWithImages);
}
