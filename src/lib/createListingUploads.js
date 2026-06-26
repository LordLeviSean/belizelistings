import {
  buildListingUploadStoragePath,
  optimizeListingUploadFile,
} from "./optimizeListingUploadFile";
export { safeFileSlug } from "./listingUploadSlug";

/** Apply contiguous 0-based positions; position 0 is cover/hero everywhere. */
export function normalizeOrderedImageRows(orderedRows) {
  return (orderedRows || [])
    .filter(Boolean)
    .map((row, index) => ({ ...row, position: index }));
}

/**
 * Upload local files to listing-images bucket and insert listing_images rows.
 * Images are resized (max 1920px longest side) and encoded as WebP before upload.
 * @param {{ onProgress?: (done: number, total: number) => void }} [opts]
 * @returns {{ failures: string[], insertedRows: Array<Record<string, unknown>> }}
 */
export async function uploadListingImageFiles(
  supabase,
  { listingId, userId, files, startPosition = 0, onProgress } = {}
) {
  const failures = [];
  const insertedRows = [];
  const list = files.filter(Boolean);
  const total = list.length;
  if (typeof onProgress === "function" && total > 0) {
    onProgress(0, total);
  }
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    try {
      const { file: optimized } = await optimizeListingUploadFile(file);
      const filePath = buildListingUploadStoragePath(userId, startPosition + i, file.name);
      const { error: uploadError } = await supabase.storage.from("listing-images").upload(filePath, optimized, {
        upsert: false,
        contentType: "image/webp",
      });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("listing-images").getPublicUrl(filePath);
      const publicUrl = publicUrlData?.publicUrl;
      if (publicUrl) {
        const { data: row, error: imageError } = await supabase
          .from("listing_images")
          .insert({
            listing_id: listingId,
            image_url: publicUrl,
            position: startPosition + i,
          })
          .select("*")
          .single();
        if (imageError) throw imageError;
        if (row) insertedRows.push(row);
      }
      if (typeof onProgress === "function") {
        onProgress(i + 1, total);
      }
    } catch (e) {
      failures.push(file?.name || `image-${i + 1}`);
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[createListingUploads] upload failed", e?.message || e);
      }
    }
  }
  return { failures, insertedRows };
}

/**
 * Persist display order for listing_images rows (position 0 = cover/hero).
 * @returns {{ error: object|null, rows: object[] }}
 */
export async function persistListingImageOrder(supabase, orderedRows) {
  const normalized = normalizeOrderedImageRows(orderedRows);
  for (const row of normalized) {
    if (!row?.id) continue;
    const { error } = await supabase
      .from("listing_images")
      .update({ position: row.position })
      .eq("id", row.id);
    if (error) return { error, rows: null };
  }
  return { error: null, rows: normalized };
}

export async function deleteListingImageRow(supabase, imageRowId) {
  return supabase.from("listing_images").delete().eq("id", imageRowId);
}

/**
 * Optimize and upload a single listing image during submit flows (with progress hooks).
 */
export async function uploadOptimizedListingImage(supabase, { userId, listingId, file, position }) {
  const { file: optimized } = await optimizeListingUploadFile(file);
  const filePath = buildListingUploadStoragePath(userId, position, file.name);
  const { error: uploadError } = await supabase.storage.from("listing-images").upload(filePath, optimized, {
    upsert: false,
    contentType: "image/webp",
  });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from("listing-images").getPublicUrl(filePath);
  const publicUrl = publicUrlData?.publicUrl || null;
  if (publicUrl) {
    const { error: imageError } = await supabase.from("listing_images").insert({
      listing_id: listingId,
      image_url: publicUrl,
      position,
    });
    if (imageError) throw imageError;
  }
  return { publicUrl };
}
