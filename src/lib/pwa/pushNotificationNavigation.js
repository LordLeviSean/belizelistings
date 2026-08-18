import { savePendingProtectedEntry } from "@/lib/auth/protectedEntry";

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
 * @param {{ push: (href: string) => void|Promise<void>, isReady?: boolean }} router
 * @param {{ pendingHrefRef?: { current: string | null } }} [options]
 */
export function handlePushNavigateMessage(data, router, options = {}) {
  if (!data || typeof data !== "object" || data.type !== PUSH_NAVIGATE_MESSAGE_TYPE) {
    return false;
  }
  const href = data.href;
  if (!isSafePushNavigateHref(href)) {
    return false;
  }

  const destination = href.trim();
  const pendingHrefRef = options.pendingHrefRef;

  savePendingProtectedEntry(destination);

  if (router?.isReady === false && pendingHrefRef) {
    pendingHrefRef.current = destination;
    return true;
  }

  void router.push(destination);
  return true;
}

/**
 * @param {{ current: string | null } | undefined} pendingHrefRef
 * @param {{ push: (href: string) => void|Promise<void>, isReady?: boolean }} router
 */
export function flushPendingPushNavigation(pendingHrefRef, router) {
  if (!pendingHrefRef?.current || router?.isReady === false) {
    return false;
  }

  const href = pendingHrefRef.current;
  pendingHrefRef.current = null;
  savePendingProtectedEntry(href);
  void router.push(href);
  return true;
}
