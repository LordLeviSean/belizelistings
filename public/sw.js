/**
 * BelizeListings minimal PWA service worker — network-only foundation.
 *
 * Policy:
 * - No precache or runtime cache writes.
 * - No fetch interception (browser default network behavior).
 * - Activate may delete only belizelistings-sw-* caches owned by prior versions.
 * - Push + notificationclick handlers for lock-screen delivery (Step 5C).
 */
/* eslint-disable no-restricted-globals */

importScripts("/sw-push-logic.js");

const CACHE_PREFIX = "belizelistings-sw";

self.addEventListener("install", (event) => {
  // Install without precaching; do not call skipWaiting() to avoid reload loops.
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX))
          .map((key) => caches.delete(key))
      );
    })()
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(self.BL_PUSH.handlePushEvent(event, self.registration));
});

self.addEventListener("notificationclick", (event) => {
  event.waitUntil(
    self.BL_PUSH.handleNotificationClick(event, self.clients, self.location.origin)
  );
});

// Intentionally no "fetch" listener — requests are not intercepted or cached.
