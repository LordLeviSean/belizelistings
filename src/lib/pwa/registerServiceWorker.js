export const SERVICE_WORKER_URL = "/sw.js";
export const SERVICE_WORKER_SCOPE = "/";

function isSecureServiceWorkerContext(location) {
  if (!location) return false;
  const hostname = String(location.hostname || "");
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
  return location.protocol === "https:" || isLocalhost;
}

/**
 * Register the BelizeListings network-only service worker.
 * Browser-only, secure-origin gated; failures are swallowed.
 *
 * @param {{ navigator?: ServiceWorkerContainer, location?: Location }} [env]
 */
export function registerBelizeListingsServiceWorker(env = {}) {
  const nav = env.navigator ?? (typeof navigator !== "undefined" ? navigator : undefined);
  const loc = env.location ?? (typeof window !== "undefined" ? window.location : undefined);

  if (!nav?.serviceWorker?.register || !loc) {
    return { registered: false, reason: "unsupported" };
  }

  if (!isSecureServiceWorkerContext(loc)) {
    return { registered: false, reason: "insecure-origin" };
  }

  const registrationPromise = nav.serviceWorker
    .register(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE })
    .then(() => ({ registered: true, reason: null }))
    .catch(() => ({ registered: false, reason: "registration-failed" }));

  return { registered: true, reason: "pending", registrationPromise };
}
