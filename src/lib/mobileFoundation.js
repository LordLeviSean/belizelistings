/**
 * Mobile foundation (Phase 7 prep) — contracts and boundaries for future native apps.
 *
 * Principles:
 * - Listing mutations and media uploads go through shared libs (`lib/*`, `utils/*`), not page-local glue.
 * - Auth/session: isolate in hooks (`useAuth`, `useUserRole`); native clients will swap transport only.
 * - Media: use `ListingMediaImage` / `resolveListingImageUrl` so upload URLs and crop behavior stay consistent.
 *
 * When adding Capacitor/React Native, prefer importing from `@/lib/*` and `@/utils/*` over duplicating fetch logic in pages.
 */

export const MOBILE_FOUNDATION_VERSION = 1;
