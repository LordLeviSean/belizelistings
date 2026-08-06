/**
 * Minimal Web Push payload contract for later lock-screen delivery.
 * In-app notifications remain authoritative; push is a concise alert channel.
 */

const MAX_TITLE_LENGTH = 64;
const MAX_BODY_LENGTH = 180;
const MAX_TAG_LENGTH = 128;

/**
 * Validate same-origin relative paths for notification click targets.
 * @param {string} href
 */
export function isSafePushDeepLink(href) {
  if (typeof href !== "string") return false;
  const value = href.trim();
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  if (!value.startsWith("/")) return false;
  if (value.includes("\0")) return false;
  return true;
}

function truncate(value, max) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Build a minimal push payload from a durable in-app notification row/presentation.
 * Excludes auth tokens, message bodies with excessive detail, and external URLs.
 *
 * @param {{
 *   notificationId: string,
 *   eventType: string,
 *   title: string,
 *   body?: string|null,
 *   href?: string|null,
 *   tag?: string|null,
 * }} input
 */
export function buildPushPayload(input = {}) {
  const notificationId = String(input.notificationId ?? "").trim();
  const eventType = String(input.eventType ?? "").trim();

  if (!notificationId || !eventType) {
    return { ok: false, error: "missing_notification_identity" };
  }

  const href = input.href == null ? null : String(input.href).trim();
  if (href && !isSafePushDeepLink(href)) {
    return { ok: false, error: "unsafe_deep_link" };
  }

  const title = truncate(input.title, MAX_TITLE_LENGTH) || "BelizeListings";
  const body = truncate(input.body, MAX_BODY_LENGTH);
  const tag = truncate(input.tag || `${eventType}:${notificationId}`, MAX_TAG_LENGTH);

  const payload = {
    notificationId,
    eventType,
    title,
    body,
    href: href || "/",
    tag,
  };

  return { ok: true, payload };
}

/**
 * JSON envelope for encrypted Web Push send (Step 5B+).
 * @param {ReturnType<typeof buildPushPayload> & { ok: true }} built
 */
export function serializePushPayload(built) {
  if (!built?.ok || !built.payload) {
    return null;
  }
  return JSON.stringify(built.payload);
}

export const PUSH_PAYLOAD_LIMITS = Object.freeze({
  MAX_TITLE_LENGTH,
  MAX_BODY_LENGTH,
  MAX_TAG_LENGTH,
});
