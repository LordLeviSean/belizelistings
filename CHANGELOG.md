# Changelog

All notable changes to BelizeListings follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] - 2026-06-25

### Added

- **Admin listing verification controls** in All Listings panel — verify / remove verification with immediate state updates, confirmation on revoke, and success toasts.
- **`AdminListingTrustAction`** and **`AdminListingActionConfirmModal`** — reusable admin trust/lifecycle action pattern for future ops (feature, approve, archive, etc.).
- **`listingVerificationMutations`** — targeted Supabase PATCH for `verification_status`, `verified_at`, `verified_by` only.
- **Supabase migration** `20260625130000_listing_verification_metadata.sql` — `verified_at` / `verified_by` columns with profile FK.
- **Audit script** `scripts/audit-listing-verification.mjs` — verification counts and trusted-role anomaly report.
- **`getListingVerificationTrustCopy`** helper — future public “Verified by BelizeListings” copy (not exposed in UI yet).

### Changed

- Admin listings rows show Verified / Unverified chip from `listing.verification_status` only; `ListingCard` remains single source of truth for public badges.

## [1.1.0] - 2026-06-25

### Added

- **Canonical `ListingCard`** — single production card across homepage, search, favorites, districts, agent profiles, operator/admin previews, and create workspace preview (`HomePropertyCard` re-exports for backward compatibility).
- **Listing verification badge** on cards beneath FOR SALE / FOR RENT (sea-glass verified, neutral unverified) driven by `listing.verification_status`.
- **Supabase migration** `20260625120000_listing_verification_status.sql` — column, owner-role backfill, insert trigger default, public agent/broker profile RLS for guest directory browsing.
- **Immediate media upload** in create workspace — photos upload on selection with Move Left/Right, Front/Back, Remove controls and numbered ordering without waiting for Continue.
- **`CHANGELOG.md`** and Phase 2 Marketplace Foundation release notes.

### Changed

- Search results grid uses the same editorial card layout as browse surfaces.
- Agent directory includes brokers; agent profiles expose guest contact paths and full card parity (carousel, favorite, share, verification).

## [1.0.0] - 2026-06-25

### Milestone

- **Homepage v1.0 FROZEN** — editorial map-first homepage, featured and recently-added rails, district exploration, and calm luxury card DNA.
- Reference tag: [`v1.0-homepage`](https://github.com/belizelistings/belizelistings-frontend/tree/v1.0-homepage) (`691db60`, also `3629a03`).

[Unreleased]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.0-homepage...v1.1.0
[1.0.0]: https://github.com/belizelistings/belizelistings-frontend/releases/tag/v1.0-homepage
