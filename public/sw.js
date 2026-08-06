/**
 * BelizeListings minimal PWA service worker — network-only foundation.
 *
 * Policy:
 * - No precache or runtime cache writes.
 * - No fetch interception (browser default network behavior).
 * - Activate may delete only belizelistings-sw-* caches owned by prior versions.
 */
/* eslint-disable no-restricted-globals */

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

// Intentionally no "fetch" listener — requests are not intercepted or cached.
