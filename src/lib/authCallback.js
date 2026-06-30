import { LOGIN_PATH, RESET_PASSWORD_PATH } from "../constants/authRoutes";

/**
 * Parse `#access_token=…&type=signup` style hash fragments.
 * @param {string|undefined|null} hash
 * @returns {Record<string, string>}
 */
export function parseHashParams(hash) {
  if (hash == null || hash === "") return {};
  const raw = String(hash).startsWith("#") ? String(hash).slice(1) : String(hash);
  if (!raw) return {};
  try {
    return Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return {};
  }
}

/**
 * Resolve Supabase link type from hash, query, or auth event.
 * @param {{ hashType?: string|null, queryType?: string|null, authEvent?: string|null }} [params]
 * @returns {string|null}
 */
export function pickAuthLinkType({ hashType, queryType, authEvent } = {}) {
  if (authEvent === "PASSWORD_RECOVERY") return "recovery";
  const type = hashType || queryType || null;
  return type && typeof type === "string" ? type : null;
}

/**
 * @param {{ hashParams?: Record<string, string>, queryParams?: Record<string, string> }} [params]
 * @returns {string|null}
 */
export function pickAuthError({ hashParams = {}, queryParams = {} } = {}) {
  const err =
    hashParams.error_description ||
    hashParams.error ||
    queryParams.error_description ||
    queryParams.error;
  if (!err) return null;
  try {
    return decodeURIComponent(String(err));
  } catch {
    return String(err);
  }
}

/**
 * @param {{ linkType?: string|null, hasUser?: boolean }} params
 * @returns {{ status: "success"|"error", message: string, dest: string }}
 */
export function resolveAuthCallbackDestination({ linkType, hasUser }) {
  if (!hasUser) {
    return {
      status: "error",
      message: "Verification link expired or invalid. Sign in or request a new link.",
      dest: `${LOGIN_PATH}?verified=0`,
    };
  }
  if (linkType === "recovery") {
    return {
      status: "success",
      message: "Redirecting to reset your password…",
      dest: RESET_PASSWORD_PATH,
    };
  }
  return {
    status: "success",
    message: "Email verified. Redirecting…",
    dest: "/dashboard",
  };
}

/**
 * True when the URL still carries tokens or link metadata to process.
 * @param {{ hashParams?: Record<string, string>, code?: string|null }} [params]
 * @returns {boolean}
 */
export function hasAuthTokensInUrl({ hashParams = {}, code } = {}) {
  if (code) return true;
  return Boolean(
    hashParams.access_token || hashParams.refresh_token || hashParams.code || hashParams.type
  );
}

/**
 * @param {string|null|undefined} linkType
 * @returns {boolean}
 */
export function shouldEnsureProfile(linkType) {
  return linkType !== "recovery";
}

/**
 * @param {string|string[]|undefined|null} queryValue
 * @returns {string|null}
 */
export function normalizeQueryParam(queryValue) {
  if (queryValue == null) return null;
  if (Array.isArray(queryValue)) return queryValue[0] ?? null;
  return String(queryValue);
}
