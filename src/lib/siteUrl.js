import { AUTH_CALLBACK_PATH } from "../constants/authRoutes";

/** Canonical production origin — used when env is missing or localhost in prod builds. */
export const PRODUCTION_SITE_URL = "https://belizelistings.bz";

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Normalize a site URL string to origin only (no trailing slash).
 * @param {string|undefined|null} raw
 * @returns {string|null}
 */
export function normalizeSiteUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const href = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
    const { origin } = new URL(href);
    return origin;
  } catch {
    return null;
  }
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isLocalhostUrl(url) {
  try {
    return LOCALHOST_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * True for production Next.js builds (Netlify, etc.).
 * @param {string} [nodeEnv]
 * @returns {boolean}
 */
export function isProductionBuild(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "production";
}

/**
 * Resolve canonical site origin (testable via explicit inputs).
 * @param {{ siteUrlEnv?: string, nodeEnv?: string, windowOrigin?: string }} [options]
 * @returns {string}
 */
export function resolveSiteUrl(options = {}) {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const isProd = isProductionBuild(nodeEnv);
  const fromEnv = normalizeSiteUrl(options.siteUrlEnv ?? process.env.NEXT_PUBLIC_SITE_URL);

  if (fromEnv) {
    if (isProd && isLocalhostUrl(fromEnv)) {
      return PRODUCTION_SITE_URL;
    }
    return fromEnv;
  }

  const windowOrigin = options.windowOrigin;
  if (windowOrigin && !isProd) {
    return windowOrigin;
  }

  if (isProd) {
    return PRODUCTION_SITE_URL;
  }

  return "http://localhost:3000";
}

/**
 * Canonical site origin for auth redirects and absolute links.
 * Production builds never fall back to localhost.
 * @returns {string}
 */
export function getSiteUrl() {
  const windowOrigin =
    typeof window !== "undefined" && window.location?.origin ? window.location.origin : undefined;
  return resolveSiteUrl({ windowOrigin });
}

/**
 * Absolute URL for Supabase auth email redirects (signup, resend, password reset).
 * @param {string} [path]
 * @returns {string}
 */
export function getAuthRedirectUrl(path = AUTH_CALLBACK_PATH) {
  const site = getSiteUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${site}${normalizedPath}`;
}

/**
 * Build auth redirect URL with explicit site resolution (for tests).
 * @param {string} [path]
 * @param {Parameters<typeof resolveSiteUrl>[0]} [options]
 * @returns {string}
 */
export function buildAuthRedirectUrl(path = AUTH_CALLBACK_PATH, options = {}) {
  const site = resolveSiteUrl(options);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${site}${normalizedPath}`;
}
