/**
 * Client-side navigation fallback when a focused PWA window cannot use Client.navigate().
 */
export const PUSH_NAVIGATE_MESSAGE_TYPE = "bl-push-navigate";

export function isSafePushNavigateHref(href) {
  if (typeof href !== "string") return false;
  const value = href.trim();
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  if (value.includes("\0")) return false;
  return true;
}

/**
 * @param {unknown} data
 * @param {{ push: (href: string) => void|Promise<void> }} router
 */
export function handlePushNavigateMessage(data, router) {
  if (!data || typeof data !== "object" || data.type !== PUSH_NAVIGATE_MESSAGE_TYPE) {
    return false;
  }
  const href = data.href;
  if (!isSafePushNavigateHref(href)) {
    return false;
  }
  void router.push(href.trim());
  return true;
}
