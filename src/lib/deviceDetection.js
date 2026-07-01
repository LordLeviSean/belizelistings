/** Match media query aligned with listing contact sticky bar breakpoint. */
export const MOBILE_CONTACT_MQ = "(max-width: 640px)";

/**
 * Coarse mobile detection for contact actions (tap-to-call vs copy).
 * Prefers viewport width; falls back to touch + narrow screen when available.
 */
export function isMobileContactDevice() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.(MOBILE_CONTACT_MQ)?.matches) return true;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrow = window.innerWidth <= 640;
  return Boolean(coarse && narrow);
}

/**
 * Copy text to clipboard with graceful fallback.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyTextToClipboard(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement("textarea");
    el.value = value;
    el.setAttribute("readonly", "");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
