import { safeFileSlug } from "./listingUploadSlug";

export const LISTING_UPLOAD_MAX_SIDE_PX = 1920;
export const LISTING_UPLOAD_WEBP_QUALITY = 0.82;

/**
 * Resize dimensions for listing uploads — never upscale.
 * @returns {{ width: number, height: number, scaled: boolean }}
 */
export function computeListingUploadDimensions(width, height, maxSide = LISTING_UPLOAD_MAX_SIDE_PX) {
  const w = Math.max(1, Math.round(Number(width) || 1));
  const h = Math.max(1, Math.round(Number(height) || 1));
  const longest = Math.max(w, h);
  if (longest <= maxSide) {
    return { width: w, height: h, scaled: false };
  }
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    scaled: true,
  };
}

/** Storage path: `{userId}/{timestamp}-{position}-{slug}.webp` */
export function buildListingUploadStoragePath(userId, position, originalName) {
  const slug =
    safeFileSlug(originalName).replace(/\.(webp|jpe?g|png|gif|avif|heic|heif|bmp|tiff?)$/i, "") ||
    "image";
  return `${userId}/${Date.now()}-${position}-${slug}.webp`;
}

/**
 * Client-side resize + WebP encode before Supabase upload.
 * Example metrics: 4.2 MB JPEG 4032×3024 → 312 KB WebP 1920×1440 (~93% smaller).
 *
 * @param {File} file
 * @param {{ maxSide?: number, quality?: number }} [opts]
 * @returns {Promise<{ file: File, metrics: object|null }>}
 */
export async function optimizeListingUploadFile(file, opts = {}) {
  if (!file || typeof window === "undefined") {
    return { file, metrics: null };
  }

  const maxSide = opts.maxSide ?? LISTING_UPLOAD_MAX_SIDE_PX;
  const quality = opts.quality ?? LISTING_UPLOAD_WEBP_QUALITY;
  const originalBytes = file.size;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { file, metrics: null };
  }

  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  const { width, height, scaled } = computeListingUploadDimensions(sourceWidth, sourceHeight, maxSide);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return { file, metrics: null };
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("WebP encode failed"))),
      "image/webp",
      quality
    );
  });

  const baseName =
    safeFileSlug(file.name).replace(/\.(webp|jpe?g|png|gif|avif|heic|heif|bmp|tiff?)$/i, "") || "image";
  const optimized = new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });

  return {
    file: optimized,
    metrics: {
      originalBytes,
      optimizedBytes: optimized.size,
      originalWidth: sourceWidth,
      originalHeight: sourceHeight,
      outputWidth: width,
      outputHeight: height,
      scaled,
      savingsPct:
        originalBytes > 0
          ? Math.round((1 - optimized.size / originalBytes) * 1000) / 10
          : 0,
    },
  };
}
