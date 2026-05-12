export function safeFileSlug(name = "") {
  return String(name || "image")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Upload local files to listing-images bucket and insert listing_images rows.
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
      const fileName = safeFileSlug(file.name);
      const filePath = `${userId}/${Date.now()}-${startPosition + i}-${fileName}`;
      const { error: uploadError } = await supabase.storage.from("listing-images").upload(filePath, file, {
        upsert: false,
        contentType: file.type || undefined,
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

export async function persistListingImageOrder(supabase, orderedRows) {
  for (let i = 0; i < orderedRows.length; i++) {
    const row = orderedRows[i];
    if (!row?.id) continue;
    const { error } = await supabase.from("listing_images").update({ position: i }).eq("id", row.id);
    if (error) return { error };
  }
  return { error: null };
}

export async function deleteListingImageRow(supabase, imageRowId) {
  return supabase.from("listing_images").delete().eq("id", imageRowId);
}
