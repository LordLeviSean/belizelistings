/**
 * Copy sanitized diagnostic text to clipboard with graceful fallback.
 *
 * @param {string} text
 */
export async function copyDiagnosticTextToClipboard(text) {
  const value = String(text || "");
  if (!value) {
    return { ok: false, error: "empty_content" };
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || "clipboard_write_failed" };
    }
  }

  if (typeof document === "undefined") {
    return { ok: false, error: "clipboard_unavailable" };
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied ? { ok: true } : { ok: false, error: "clipboard_exec_failed" };
  } catch (error) {
    return { ok: false, error: error?.message || "clipboard_fallback_failed" };
  }
}
