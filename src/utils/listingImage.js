/**
 * Ensure static / public URLs work on every route. Paths without a leading `/`
 * resolve relative to the current page (e.g. `listings/x.png` on `/listing/5`
 * becomes `/listing/listings/x.png` and 404s).
 */
const LISTING_IMAGES_BUCKET = "listing-images";
const STORAGE_PUBLIC_PREFIX = "/storage/v1/object/public/";

/** Collapse accidental `listing-images/listing-images/…` segments in storage paths. */
export function dedupeListingImagesBucketPath(pathOrUrl) {
  if (pathOrUrl == null) return "";
  let s = String(pathOrUrl);
  const nested = `${LISTING_IMAGES_BUCKET}/${LISTING_IMAGES_BUCKET}/`;
  while (s.includes(nested)) {
    s = s.replace(nested, `${LISTING_IMAGES_BUCKET}/`);
  }
  return s;
}

/** Normalize `images[]` entry: string URL or `{ image_url }` object. */
export function normalizeListingImageEntry(entry) {
  if (entry == null) return "";
  if (typeof entry === "string") return resolveListingImageUrl(entry);
  return resolveListingImageUrl(listingImageRowToRawUrl(entry));
}

function supabasePublicStorageOrigin() {
  const base = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : "";
  return base ? String(base).replace(/\/$/, "") : "";
}

function buildSupabasePublicStorageUrl(objectPath) {
  const origin = supabasePublicStorageOrigin();
  if (!origin) return "";
  const clean = dedupeListingImagesBucketPath(String(objectPath || "").replace(/^\/+/, ""));
  if (!clean) return "";
  return `${origin}${STORAGE_PUBLIC_PREFIX}${clean}`;
}

function isLocalStaticListingAssetPath(pathname) {
  return pathname === "/listings" || pathname.startsWith("/listings/") || pathname === "/placeholder.jpg";
}

/** Bare object keys from upload (`{userId}/{timestamp}-{position}-{file}`) without bucket or origin. */
function isBareListingImagesObjectKey(value) {
  if (!value || value.includes("://")) return false;
  const trimmed = String(value).replace(/^\/+/, "");
  if (!trimmed || trimmed.startsWith("listings/")) return false;
  if (/^storage\/v1\/object\/public\//i.test(trimmed)) return false;
  if (trimmed.startsWith(`${LISTING_IMAGES_BUCKET}/`)) return true;
  return /^[^/]+\/\d+-\d+-/.test(trimmed) || /^[0-9a-f-]{8,}[0-9a-f-]*\//i.test(trimmed);
}

export function resolveListingImageUrl(url) {
  if (url == null) return "";
  const s = String(url).trim();
  if (s === "") return "";
  /* Local preview URLs must pass through unchanged (browser-local blobs / data URIs). */
  if (/^blob:/i.test(s) || /^data:/i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) {
    const normalized = dedupeListingImagesBucketPath(s);
    /* Next/Image remotePatterns require https for Supabase hosts. */
    if (/^http:\/\//i.test(normalized) && /\.supabase\.co\//i.test(normalized)) {
      return normalized.replace(/^http:\/\//i, "https://");
    }
    return normalized;
  }
  if (s.startsWith("//")) return `https:${s}`;

  const unrooted = s.replace(/^\/+/, "");
  if (/^storage\/v1\/object\/public\//i.test(unrooted)) {
    const built = buildSupabasePublicStorageUrl(unrooted.slice("storage/v1/object/public/".length));
    if (built) return built;
  }

  if (isBareListingImagesObjectKey(unrooted)) {
    const objectPath = dedupeListingImagesBucketPath(
      unrooted.startsWith(`${LISTING_IMAGES_BUCKET}/`)
        ? unrooted
        : `${LISTING_IMAGES_BUCKET}/${unrooted}`
    );
    const built = buildSupabasePublicStorageUrl(objectPath);
    if (built) return built;
  }

  const rooted = s.startsWith("/") ? s : `/${s}`;

  /* Rows sometimes store `/storage/v1/object/public/...` without the project origin. */
  if (rooted.startsWith(STORAGE_PUBLIC_PREFIX)) {
    const built = buildSupabasePublicStorageUrl(rooted.slice(STORAGE_PUBLIC_PREFIX.length));
    if (built) return built;
  }

  if (rooted.startsWith(`/${LISTING_IMAGES_BUCKET}/`)) {
    const built = buildSupabasePublicStorageUrl(rooted.slice(1));
    if (built) return built;
  }

  // Many records are stored as "/listings/house1" while files are ".png" in public/.
  // If no extension is present, default to .png for local static assets.
  if (isLocalStaticListingAssetPath(rooted)) {
    const hasQueryOrHash = rooted.includes("?") || rooted.includes("#");
    if (hasQueryOrHash) return rooted;
    const lastSegment = rooted.split("/").pop() ?? "";
    const hasExtension = /\.[A-Za-z0-9]+$/.test(lastSegment);
    if (!hasExtension) return `${rooted}.png`;
  }

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
    .map((img) => {
      if (typeof img === "string") return resolveListingImageUrl(img);
      return resolveListingImageUrl(listingImageRowToRawUrl(img));
    })
    .filter((url) => url !== "");
}

/** Raw URL from a listing_images table row (column names vary by schema). */
export function listingImageRowToRawUrl(row) {
  if (!row || typeof row !== "object") return "";
  const raw = row.image_url ?? row.url ?? row.path ?? row.public_url ?? "";
  return raw == null ? "" : String(raw).trim();
}

/** Ordered gallery rows for listing detail (resolves every URL tier). */
export function getListingGalleryImages(listing) {
  if (!listing) return [];
  const rows =
    Array.isArray(listing.listing_images) && listing.listing_images.length > 0
      ? listing.listing_images
      : Array.isArray(listing.images)
        ? listing.images
        : [];

  return rows
    .map((entry, idx) => {
      if (entry == null) return null;
      if (typeof entry === "string") {
        const image_url = resolveListingImageUrl(entry);
        return image_url ? { image_url, position: idx } : null;
      }
      const raw = listingImageRowToRawUrl(entry);
      const image_url = resolveListingImageUrl(raw);
      if (!image_url) return null;
      return {
        id: entry.id,
        image_url,
        position: entry.position ?? idx,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/** Normalize Supabase row with listing_images relation into images[]. */
export function mapListingWithImages(listing) {
  const normalizedImages = getListingGalleryImages(listing);

  return {
    ...listing,
    listing_images: normalizedImages,
    images: normalizedImages,
  };
}

/** Normalize list of rows with listing_images relation into images[]. */
export function mapListingsWithImages(data) {
  return (data || []).map(mapListingWithImages);
}
