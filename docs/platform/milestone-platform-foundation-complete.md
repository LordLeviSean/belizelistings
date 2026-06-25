# Platform Foundation Complete — Milestone v1.4.0

**Status:** Frozen baseline  
**Completion date:** June 25, 2026  
**Baseline commit:** `57e41ad` — *polish: Sprint 2.3B listing detail mobile final polish*  
**Recommended tag:** `v1.4.0-platform-foundation`  
**Prior tags:** `v1.0-homepage`, Phase 2 sprints through v1.3.2

---

## Executive Summary

BelizeListings has reached **Platform Foundation Complete**: a production-grade public discovery stack, canonical listing card DNA, verification and admin trust workflows, agent directory, listing detail (desktop + mobile), and property discovery search — all grounded in Supabase-direct architecture with careful schema-compat layers.

This milestone **freezes** the surfaces below. Phase 3 (**Marketplace Infrastructure**) begins with architecture-only proposals for Property Timeline and Inquiry/Lead Management — no UI or migrations shipped in v1.4.0.

---

## Completed Milestones

| Milestone | Version / Sprint | Status | Reference |
|-----------|------------------|--------|-----------|
| **Homepage v1.0** | v1.0.0 / tag `v1.0-homepage` | ✅ Frozen | [v1.0-homepage](../milestones/v1.0-homepage.md) |
| **ListingCard DNA** | v1.1.0 | ✅ Frozen | [BELIZELISTINGS_LISTING_CARD_DNA.md](../BELIZELISTINGS_LISTING_CARD_DNA.md) |
| **Verification + Agent Directory** | v1.1.0–v1.1.1 | ✅ Complete | Migrations `20260625120000_*`, `20260625130000_*` |
| **Admin verification workflow** | Sprint 2.1 / v1.1.1–v1.1.3 | ✅ Complete | [admin-operations.md](../admin-operations.md) |
| **Property Discovery** | Sprint 2.2 / v1.2.0 | ✅ Complete | [search-architecture.md](../discovery/search-architecture.md) |
| **Listing Detail 2.3** | v1.3.0 | ✅ Complete | [sprint-2.3.md](../listing-detail/sprint-2.3.md) |
| **Listing Detail 2.3A (desktop polish)** | v1.3.1 | ✅ Frozen | Desktop layout locked |
| **Listing Detail 2.3B (mobile polish)** | v1.3.2 | ✅ Frozen | Mobile sticky bar, thumb strip |
| **Trust system** | Cross-cutting | ✅ Foundation | `trustSignals.js`, `ListingTrustStrip`, verification columns |

---

## Major Architectural Decisions

### 1. Supabase-direct, no app backend

The browser talks to Supabase (Auth, Postgres, Storage, Realtime) via `@supabase/supabase-js`. Next.js API routes are limited to cap enforcement, admin user creation, username checks, and profile repair. All listing CRUD and inquiry inserts are client-scoped with RLS.

### 2. Canonical inventory core

`public.listings` is the single source of truth. Lifecycle is normalized in `src/utils/canonicalListing.js` and `src/constants/operationalModel.js` across overlapping fields (`status`, `lifecycle_status`, `moderation_status`). Writes pass through `listingWriteContract.js` and `listingsSchemaAllowlist.js` to prevent PostgREST column drift.

### 3. Card-level verification (not owner-role at render)

Public badges read **`listing.verification_status` only** via `isListingCardVerified()`. Admin can override; insert trigger defaults from owner role. Metadata (`verified_at`, `verified_by`) supports audit without exposing admin identity on public cards.

### 4. Separate mobile/desktop layout architectures

Homepage (≤800px gate) and listing detail (≤520px sticky bar) use intentional breakpoint splits — not a single responsive reflow. Reduces regression risk when polishing one surface.

### 5. Feature flags for optional tables

`BL_ENABLE_INQUIRIES` (`NEXT_PUBLIC_BL_ENABLE_INQUIRIES`) gates dashboard inquiry probes until `listing_inquiries` exists in PostgREST. Same pattern recommended for future tables.

### 6. Admin mutation modules

Trust-sensitive writes use dedicated `*Mutations.js` modules (`build*Patch` + `apply*Action`) with `sanitizeListingMutationPayload`. UI pattern: `AdminListingTrustAction` + `AdminListingActionConfirmModal`.

### 7. Discovery extension registry

Client-side search remains default; `discoveryExtensionPoints.js` registers future server-side query builders without rewriting `FilterBar` or URL schema.

---

## Canonical UI Components

Production components that define BelizeListings visual and behavioral DNA. **Do not fork** for new surfaces — extend via props or composition.

### Public discovery

| Component | Path | Role |
|-----------|------|------|
| **ListingCard** | `src/components/ListingCard.jsx` | Canonical card — homepage, search, districts, favorites, agent profiles, admin previews |
| **HomePropertyCard** | `src/components/HomePropertyCard.jsx` | Re-exports ListingCard for homepage backward compatibility |
| **FilterBar** | `src/components/FilterBar.jsx` | Search filters, chips, sort |
| **BelizeMap** | `src/components/BelizeMap.jsx` | District map exploration |
| **SiteNav** | `src/components/SiteNav.jsx` | Global nav, mobile drawer portal |
| **PremiumEmptyState** | `src/components/ui/PremiumEmptyState.jsx` | Editorial empty states |
| **ListingImage** | `src/components/ui/ListingImage.jsx` | Optimized listing imagery |
| **ShareListingIconButton** | `src/components/ShareListingIconButton.jsx` | Share affordance |
| **Footer** | `src/components/Footer.jsx` | Global footer |

### Listing detail

| Component | Path | Role |
|-----------|------|------|
| **ListingTrustStrip** | `src/components/listing/ListingTrustStrip.jsx` | Verified badge + public status chips |
| **ListingDescriptionContent** | `src/components/listing/ListingDescriptionContent.jsx` | Structured description renderer |
| **ListingContactActions** | `src/components/listing/ListingContactActions.jsx` | Contact / schedule / share (sticky mobile) |
| **ContactAgentModal** | `src/components/listing/ContactAgentModal.jsx` | WhatsApp / email / inbox paths |
| **ListingMessageModal** | `src/components/listing/ListingMessageModal.jsx` | Site message form → `listing_inquiries` |
| **ListingViewingBookingModal** | `src/components/listing/ListingViewingBookingModal.jsx` | Preview scheduling UI (local-only confirm) |
| **ListingMediaImage** | `src/components/listing/ListingMediaImage.jsx` | Gallery imagery |

### Trust & verification

| Component | Path | Role |
|-----------|------|------|
| **ListingTrustStrip** (detail) | `src/components/listing/ListingTrustStrip.jsx` | Public trust layer |
| **TrustMetadataStrip** | `src/components/TrustMetadataStrip.jsx` | Operational trust metadata |
| **AdminListingTrustAction** | `src/components/admin/AdminListingTrustAction.jsx` | Admin verify / unverify |
| **AdminListingActionConfirmModal** | `src/components/admin/AdminListingActionConfirmModal.jsx` | Reusable confirm shell |

### Dashboard & admin

| Component | Path | Role |
|-----------|------|------|
| **DashboardShell** | `src/components/dashboard/DashboardShell.jsx` | Role-adaptive dashboard chrome |
| **RoleBadge** | `src/components/dashboard/RoleBadge.jsx` | Tier/role display |
| **AllListingsPanel** | `src/components/AllListingsPanel.jsx` | Admin inventory + trust actions |
| **PendingListingsPanel** | `src/components/PendingListingsPanel.jsx` | Moderation queue |
| **AgentInquiryList** | `src/components/inquiry/AgentInquiryList.jsx` | Agent inquiry inbox (when table exists) |
| **NotificationCenter** | `src/components/notifications/NotificationCenter.jsx` | Nav/drawer notifications |

### Auth

| Component | Path | Role |
|-----------|------|------|
| **AuthGateProvider** | `src/components/auth/AuthGateProvider.jsx` | Signed-in gate for CTAs |
| **GatedAccountCtaLink** | `src/components/auth/GatedAccountCtaLink.jsx` | Auth-aware links |
| **AlreadySignedInModal** | `src/components/auth/AlreadySignedInModal.jsx` | Account switch prompt |

### Design system

| Module | Path | Role |
|--------|------|------|
| **Design tokens** | `src/styles/tokens.css` | Breakpoints, elevation, motion, touch targets |
| **HomeMapFirst** | `src/styles/HomeMapFirst.module.css` | Homepage visual language (frozen) |
| **ListingDetail** | `src/styles/ListingDetail.module.css` | Detail page layout |

---

## Current Database Architecture

### Official migrations (`supabase/migrations/`)

| Migration | Purpose |
|-----------|---------|
| `20260512120000_handle_new_user_profile.sql` | `handle_new_user` trigger — auto-create profiles |
| `20260512140000_profiles_rls_and_trigger_hardening.sql` | Profile RLS + trigger refinements |
| `20260512160000_listings_user_dashboard_index.sql` | Dashboard listing index |
| `20260512180000_profiles_admin_rls.sql` | Admin profile policies via `is_admin()` |
| `20260512190000_profiles_admin_rls_fix.sql` | Admin RLS fix |
| `20260623120000_agent_upgrade_requests.sql` | Agent upgrade request queue |
| `20260625120000_listing_verification_status.sql` | `verification_status`, insert trigger, public agent RLS |
| `20260625130000_listing_verification_metadata.sql` | `verified_at`, `verified_by` FK |

### Key tables

| Table | Purpose | Migration status |
|-------|---------|------------------|
| `auth.users` | Supabase Auth | Platform |
| `public.profiles` | Identity, role, username | Migrations ✅ |
| `public.listings` | Canonical inventory | Root SQL scripts + partial migrations |
| `public.listing_images` | Gallery rows | Root SQL scripts |
| `public.favorites` | Saved listings | Root SQL scripts |
| `public.listing_inquiries` | Lead capture | **`supabase-listing-inquiries.sql` only** — not in migrations/ |
| `public.agent_upgrade_requests` | Agent onboarding | Migration ✅ |

### Listings column surface (allowlist)

`src/constants/listingsSchemaAllowlist.js` defines allowed INSERT/UPDATE keys including lifecycle timestamps (`published_at`, `archived_at`, `sold_at`, `rented_at`), verification fields, and moderation metadata. Operator occupancy columns intentionally omitted until canonical alignment script applied.

### No event store yet

There is **no** `listing_events`, `audit_log`, or activity table in migrations. Timeline signals are **derived client-side** from listing row timestamps (`getLifecycleTimestamps`) and trust heuristics (`trustSignals.js`).

---

## Extension Points Already Created

| Extension | Location | Purpose |
|-----------|----------|---------|
| **Discovery query builder** | `src/lib/discoveryExtensionPoints.js` | Register server-side search |
| **Saved searches / recently viewed** | `discoveryExtensionPoints.js` stubs | Personalization hooks |
| **Search filter schema** | `src/lib/searchFilters.js` | Extend filters without URL breakage |
| **Discovery docs** | `docs/discovery/extension-points.md` | Feature wiring guide |
| **Listing detail P2** | `docs/listing-detail/sprint-2.3.md` | Trust panel / price history extension |
| **Admin ops patterns** | `docs/admin-operations.md` | Reusable admin mutation + modal pattern |
| **Verification audit script** | `scripts/audit-listing-verification.mjs` | Verification anomaly report |
| **Verification trust copy** | `getListingVerificationTrustCopy()` | Future public attribution text |
| **Inquiry model** | `src/constants/inquiryModel.js` | Channel/status enums + spam gate |
| **Listing inquiries API** | `src/lib/listingInquiries.js` | Insert/fetch/update when table exists |
| **Agent activity feed (derived)** | `src/utils/listingIntel.js` | Client-side feed from listing rows + inquiries |
| **Operational intel** | `ListingIntelStrip`, `AgentActivityFeed` | Dashboard signals without event store |

---

## Future Roadmap → Marketplace Infrastructure Phase

See **[marketplace-infrastructure-phase.md](./marketplace-infrastructure-phase.md)** for Phase 3 priorities.

| Priority | Feature | Doc |
|----------|---------|-----|
| 1 | Property Timeline (event-sourced trust history) | [property-timeline-architecture.md](./proposals/property-timeline-architecture.md) |
| 2 | Inquiry & Lead Management (CRM evolution) | [inquiry-lead-management-architecture.md](./proposals/inquiry-lead-management-architecture.md) |

Downstream (not scoped in v1.4.0): saved searches, server-side discovery, broker dashboards, market intelligence, push/email notifications, internal messaging threads.

---

## Frozen Systems Policy

**Do not redesign without explicit product instruction.**

| System | Freeze scope | Permitted without new milestone |
|--------|--------------|--------------------------------|
| **Homepage v1.0** | Layout, visual language, 800px split | Bug fixes, a11y, performance, SEO |
| **ListingCard DNA** | Card layout, verification badge placement | Bug fixes, new optional props |
| **Listing Detail 2.3A (desktop)** | Gallery proportions, contact row, typography | Bug fixes, a11y |
| **Listing Detail 2.3B (mobile)** | Sticky bar, thumb strip, footer clearance | Bug fixes, a11y |
| **Discovery 2.2 FilterBar + URL schema** | Filter keys, chip behavior | New filter keys via `searchFilters.js` extension |
| **Verification workflow** | Column semantics, admin mutation contract | New admin actions following `admin-operations.md` pattern |
| **Design tokens** | Palette, elevation, motion | Token additions only when extending existing scale |

Phase 3 implementation must **compose** from frozen components — e.g. timeline renders beneath `ListingTrustStrip`, CRM evolves from `ListingContactActions` without replacing modal shells wholesale.

---

## Verification & Release

| Gate | Command |
|------|---------|
| Build | `npm run build` |
| Unit tests | `npm test` |
| Mobile QA | `npm run qa:mobile` |
| Listing detail QA | `scripts/qa/run-listing-detail-mobile-screenshots.mjs` |

---

## Related Documentation

- [Platform architecture](../BELIZELISTINGS_ARCHITECTURE.md)
- [System rules](../BELIZELISTINGS_SYSTEM_RULES.md)
- [Admin operations](../admin-operations.md)
- [Discovery architecture](../discovery/search-architecture.md)
- [Listing detail sprint 2.3](../listing-detail/sprint-2.3.md)
- [Marketplace Infrastructure phase](./marketplace-infrastructure-phase.md)
