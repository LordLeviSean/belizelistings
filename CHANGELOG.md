# Changelog

All notable changes to BelizeListings follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.2] - 2026-06-26 — Sprint 3.1C stabilization

### Fixed

- **Event engine:** Emit `listing.created` on every successful listing insert; coerce `listing_id` to bigint for RPC/query; set `listing.created` visibility to public for Property History; document Netlify `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS=true` before build.
- **Media studio:** Remove blocking upload modal; background uploads with thumbnail progress/retry; persist photo order on reorder/autosave/continue; position 0 = cover across admin panels via `getListingCoverImageUrl`.

## [1.5.1] - 2026-06-26 — Production activation

### Milestone 3.1B rollout

- **Database:** `listing_events` migration applied to production Supabase (`listing_id bigint` aligned to production schema).
- **Backfill:** Historical events seeded for all listings (`listing.created`, `listing.published`, verification where applicable).
- **Dev flag:** `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS=true` in `.env.local`.
- **Production deploy:** Set `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS=true` on Netlify and redeploy.
- **Docs:** [event-engine-production-activation.md](docs/platform/event-engine-production-activation.md)


### Milestone

- **Phase 3 Milestone 3.1B — Property History (Public Timeline)** — collapsible `ListingTimelinePanel` on listing detail beneath `ListingTrustStrip`, lazy-loaded public `listing_events`, centralized event presentation config, and session expansion memory.

### Added

- **`ListingTimelinePanel`** — sea-glass collapsible “Property History” section with lazy fetch on first expand.
- **`src/lib/listingEvents/listingEventPresentation.js`** — event_type → icon, headline, description, relative time (sensible defaults for future types).
- **`src/lib/listingEvents/fetchListingTimeline.js`** — public timeline query gated by `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS`.

### Changed

- **`src/pages/listing/[id].js`** — integrates timeline panel between trust strip and listing body content (no layout redesign).

## [1.5.0] - 2026-06-26

### Milestone

- **Phase 3 Milestone 3.1 — Property Timeline Foundation** — append-only `listing_events` table, centralized event writer (`src/lib/listingEvents/`), RPC `append_listing_event` + atomic `apply_listing_verification_with_event`, verification and lifecycle mutation wiring, backfill script, and Workstream C/D design docs. Public `ListingTimelinePanel` deferred to 3.1B.

### Added

- **`supabase/migrations/20260626120000_listing_events.sql`** — `listing_events` table, RLS (public/owner/admin read), immutability triggers, `append_listing_event` and `apply_listing_verification_with_event` RPCs.
- **`src/lib/listingEvents/`** — `listingEventTypes.js`, `buildListingEventPayload.js`, `writeListingEvent.js` (single insert entry point).
- **`scripts/backfill-listing-events.mjs`** — seed events from `created_at`, `published_at`, `verified_at`, `sold_at`, `rented_at`, `archived_at`.
- **`docs/platform/phase-3-program.md`** — Workstreams A–F, milestone breakdown, delivery model.
- **`docs/platform/proposals/activity-engine-architecture.md`** — Workstream C design (read model).
- **`docs/platform/proposals/notification-framework-architecture.md`** — Workstream D design.
- **Feature flag** `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS` (default false).

### Changed

- **`listingVerificationMutations.js`** — emits `listing.verification.approved` / `listing.verification.removed` via RPC or fallback `writeListingEvent`.
- **`ownershipAttribution.js`** — `applyListingLifecycleAction` emits publish, archive, reject, republish events after successful PATCH.

### Deferred

- Milestone **3.2** — CRM tables (`listing_inquiries` official migration, conversations, messages).
- Milestone **3.1B** — public `ListingTimelinePanel` beneath `ListingTrustStrip`.
- Workstream **C/D implementation** — Activity Engine and Notification Framework (design only in 3.1).


### Milestone

- **Platform Foundation Complete** — frozen baseline for homepage v1.0, ListingCard DNA, Discovery 2.2, Listing Detail 2.3A/2.3B, verification, admin trust workflow, agent directory, and trust system. Phase 3 (**Marketplace Infrastructure**) begins with architecture proposals only.

### Added

- **`docs/platform/milestone-platform-foundation-complete.md`** — completed milestones, architectural decisions, canonical UI inventory, database architecture, extension points, frozen systems policy.
- **`docs/platform/proposals/property-timeline-architecture.md`** — append-only `listing_events` proposal (no implementation).
- **`docs/platform/proposals/inquiry-lead-management-architecture.md`** — CRM / lead pipeline proposal (no implementation).
- **`docs/platform/marketplace-infrastructure-phase.md`** — Phase 3 priorities and implementation order.

### Policy

- **Frozen baseline** — homepage v1.0, ListingCard, Listing Detail 2.3A (desktop), 2.3B (mobile), Discovery 2.2 FilterBar/URL schema, and verification admin workflow must not be redesigned without explicit product instruction. See milestone doc for permitted exception classes (bug fixes, a11y, performance, SEO).

## [1.3.2] - 2026-06-25

### Changed

- **Listing detail mobile final polish (Sprint 2.3B)** — sticky contact bar slides away when site footer enters view (IntersectionObserver + safe-area padding), horizontal thumb strip with smooth auto-scroll and premium active state, `+N` overflow chip, hero gallery height/spacing refinements, mobile density and visual rhythm pass, and clearer separation before “About this property”. Desktop layout unchanged (Sprint 2.3A frozen).

## [1.3.1] - 2026-06-25

### Changed

- **Listing detail desktop polish (Sprint 2.3A)** — refined gallery proportions and thumbnail strip, adaptive “click/tap to expand” hint via pointer capability query, share button alignment in contact row, editorial description typography and measure, increased footer breathing room, and desktop vertical rhythm audit. Mobile layout unchanged (Sprint 2.3B follow-up).

## [1.3.0] - 2026-06-25

### Added

- **Listing detail mobile optimization (Sprint 2.3)** — swipeable hero with compact horizontal thumbnail strip (`+N` overflow), structured description formatting (phones, URLs, sections, bullets), and sticky mobile contact bar.
- **`listingDescriptionFormat`** utility and **`ListingDescriptionContent`** component for rich description rendering on listing detail.
- **`docs/listing-detail/sprint-2.3.md`** — sprint summary and QA checklist.

### Changed

- Listing detail **Verified Listing** trust badge separated from status chips (sea-glass styling via `verification_status`); removed **Verified inventory signal** from mixed trust chips.
- Mobile gallery height reduced; highlight chips and info cards slightly denser; increased bottom spacing before page end.

## [1.2.0] - 2026-06-25

### Added

- **Property discovery foundation (Sprint 2.2)** — canonical `src/lib/searchFilters.js` for URL parse/build, client filter apply, sort, and active filter chips.
- **`FilterBar` on `/search`** — keyword debounce, Enter to search, market/price/beds/baths/sort, advanced verified + property type, reset filters, removable chips.
- **Discovery docs** — `docs/discovery/search-architecture.md`, `filter-audit.md`, `extension-points.md`.
- **`discoveryExtensionPoints.js`** — architecture stubs for saved searches, analytics, recommendations, and server-side query builder registration.

### Changed

- Search results use shallow URL updates for filter combos (back/forward safe deep links).
- Improved skeleton loading pulse and `PremiumEmptyState` reset CTA on zero results.
- Homepage advanced filters hand off via `buildSearchRouterQuery()` for param consistency.
- District **Verified only** filter reads `listing.verification_status` via `isListingCardVerified()`.

### Fixed

- Removed duplicated inline filter logic from `search.jsx` in favor of canonical `searchFilters` + `filterListings`.

## [1.1.3] - 2026-06-25

### Fixed

- **Remove Verification workflow (Sprint 2.1.2)** — unverify confirm modal lifted to `AllListingsPanel` (same pattern as archive), so postgres realtime refetches no longer fight row-level modal state; action-key guard refs update synchronously before mutations; verify and unverify share one panel-level mutation runner.

## [1.1.2] - 2026-06-25

### Fixed

- **Remove Verification modal** — confirm dialog no longer flickers or stays stuck; background listing refetches no longer unmount admin trust controls mid-action, and verify/unverify mutations share a `try/finally` cleanup path that always clears busy state and closes the modal on success.

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

[Unreleased]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.3.2...v1.4.0
[1.3.2]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.1.3...v1.2.0
[1.1.3]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/belizelistings/belizelistings-frontend/compare/v1.0-homepage...v1.1.0
[1.0.0]: https://github.com/belizelistings/belizelistings-frontend/releases/tag/v1.0-homepage
