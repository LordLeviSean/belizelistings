export function safeFileSlug(name = "") {
  return String(name || "image")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Upload local files to listing-images bucket and insert listing_images rows.
 * @returns {{ failures: string[] }}
 */
export async function uploadListingImageFiles(supabase, { listingId, userId, files, startPosition = 0 }) {
  const failures = [];
  const list = files.filter(Boolean);
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
        const { error: imageError } = await supabase.from("listing_images").insert({
          listing_id: listingId,
          image_url: publicUrl,
          position: startPosition + i,
        });
        if (imageError) throw imageError;
      }
    } catch (e) {
      failures.push(file?.name || `image-${i + 1}`);
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[createListingUploads] upload failed", e?.message || e);
      }
    }
  }
  return { failures };
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
