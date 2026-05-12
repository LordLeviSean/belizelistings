/**
 * Share or copy a listing URL. Uses Web Share API when available; otherwise clipboard.
 */
export async function shareListingLink({ id, title }) {
  if (typeof window === "undefined") {
    return { ok: false, reason: "ssr" };
  }
  const url = `${window.location.origin}/listing/${encodeURIComponent(String(id))}`;
  const shareTitle = title ? String(title).trim() : "Belize listing";

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: shareTitle, text: shareTitle, url });
      return { ok: true, method: "share" };
    } catch (err) {
      if (err && err.name === "AbortError") {
        return { ok: false, reason: "aborted" };
      }
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return { ok: true, method: "clipboard" };
  } catch {
    return { ok: false, reason: "clipboard" };
  }
}
