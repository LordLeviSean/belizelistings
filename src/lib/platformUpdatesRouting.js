import { normalizeReturnTo } from "@/lib/authEngagementReturn";
import { resolveGeographicUpdateListingsHref } from "@/lib/geography/geographicUpdateLaunch";
import {
  getDefaultPlatformUpdate,
  getPlatformUpdateBySlug,
  PLATFORM_UPDATE_IDS,
} from "@/constants/platformUpdates";

export const LEARN_MORE_PATH = "/learn-more";

/**
 * @param {string} slug
 * @returns {string}
 */
export function buildLearnMoreUpdateHref(slug) {
  const clean = String(slug || "").trim();
  return clean ? `${LEARN_MORE_PATH}#${encodeURIComponent(clean)}` : LEARN_MORE_PATH;
}

/**
 * Parse hash or ?update= query into a platform update slug.
 * @param {{ hash?: string, update?: string|string[] }} [source]
 * @returns {string|null}
 */
export function parseLearnMoreUpdateSlug(source = {}) {
  const fromQuery = Array.isArray(source.update) ? source.update[0] : source.update;
  if (fromQuery) {
    const q = String(fromQuery || "").trim();
    if (q) return q;
  }
  const hash = String(source.hash || "").replace(/^#/, "").trim();
  if (!hash) return null;
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

/**
 * @param {string|null|undefined} slugOrHash
 */
export function resolvePlatformUpdateFromRoute(slugOrHash) {
  const slug = parseLearnMoreUpdateSlug({ hash: slugOrHash ? `#${slugOrHash}` : "" });
  if (!slug) return getDefaultPlatformUpdate();
  return getPlatformUpdateBySlug(slug) || getDefaultPlatformUpdate();
}

/**
 * Role-aware or auth-safe primary CTA for an update entry.
 * @param {import('@/constants/platformUpdates').PlatformUpdate} update
 * @param {{ role?: string, authenticated?: boolean }} [ctx]
 */
export function resolveUpdatePrimaryCtaHref(update, { role, authenticated } = {}) {
  const cta = update?.primaryCta;
  if (!cta) return LEARN_MORE_PATH;
  if (cta.type === "role-aware-listings") {
    if (authenticated) return resolveGeographicUpdateListingsHref(role);
    const returnTo = resolveGeographicUpdateListingsHref("user");
    return `/login?signup=1&returnTo=${encodeURIComponent(returnTo)}`;
  }
  if (cta.type === "auth-signup") {
    const returnTo = normalizeReturnTo(LEARN_MORE_PATH) || LEARN_MORE_PATH;
    return `/login?signup=1&returnTo=${encodeURIComponent(returnTo)}`;
  }
  return cta.href || LEARN_MORE_PATH;
}

/**
 * @param {import('@/constants/platformUpdates').PlatformUpdate} update
 */
export function resolveUpdateSecondaryCtaHref(update) {
  const cta = update?.secondaryCta;
  if (!cta?.href) return "/";
  return cta.href;
}

export function getGeographicUpdateLearnMoreHref() {
  return buildLearnMoreUpdateHref(PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1);
}
