# BelizeListings — Complete Platform Capability Inventory

**Document version:** 1.0  
**Generated:** 2026-07-14  
**Repository:** `belizelistings-frontend` (branch: `main`)  
**Production URL:** https://belizelistings.bz  
**Purpose:** Official internal platform checklist for product analysis, release planning, investor/partner conversations, and V1.0 decisions.

### Status legend

| Symbol | Status |
|--------|--------|
| ✓ | **Live and operational** — implemented, deployed, and intended for production use |
| ~ | **Implemented, awaiting deployment or activation** — code/migration exists; env flag, cron, or migration not confirmed live |
| ? | **Implemented but not fully QA-verified** — automated tests pass; authenticated browser QA incomplete |
| ± | **Partially implemented** — works with known gaps or client-side-only behavior |
| ○ | **Planned but not implemented** — documented or stubbed only |
| 🔒 | **Internal / admin-only** |
| ↩ | **Legacy compatibility** — maintained for URL/data backward compatibility |
| × | **Deprecated or removed** |

---

## 1. Executive Platform Summary

### What BelizeListings is today

BelizeListings is a **Belize-focused real estate marketplace** with a **map-first public discovery experience**, **structured geography V1.0**, **multi-role dashboards**, and a **unified CRM** separating **Inbox** (messaging) from **Viewings** (appointment management). Listings move through an editorial lifecycle (draft → pending → published → closed/archived) with admin moderation, verification badges, and owner metrics. Notifications are **event-driven** via a durable queue and in-app Notification Center.

**Current release stage:** **Open Beta** — core marketplace, geography V1, CRM separation, and **8-event notification SQL matrix are live on production** (migrations applied 2026-07-14). **Notification Center UI** remains pending authenticated browser QA; database notification pipeline is operational.

### Headline counts (verified from repository)

| Metric | Count | Evidence |
|--------|------:|----------|
| Public + dashboard pages | **25** | `src/pages/` (excluding `_app`, `_document`, `api/`) |
| API routes | **10** | `src/pages/api/` |
| Supabase migrations | **31** | `supabase/migrations/` |
| Jest test suites | **103** | `npm test` output |
| Passing tests | **527** | `npm test` (2026-07-14) |
| Notification event types (JS registry) | **10** | `src/lib/notifications/notificationEvents.js` |
| Map regions (interactive) | **8** | `geo_map_regions` seed + `BelizeMap.jsx` |
| Administrative districts | **6** | `administrative_district_id` on geography seed |
| Geography seed records | **387** | `docs/geography/belize-v1-seed-reconciliation-report.md` |
| Communities | **232** | Geography V1 seed |
| Localities | **107** | Geography V1 seed |
| National highways | **5** | Geography V1 seed |
| Major dashboards | **5** | User, Agent, Broker, Admin, Operator (admin tab) |
| Supported `profiles.role` values | **7+** | user, agent, admin, broker, brokerage, property_manager, agent_pro |

### Model overview

| Domain | Current state |
|--------|-------------|
| **Marketplace model** | Owner/agent-published listings; public browse; tier-based listing caps |
| **User types** | Visitor, registered user, listing owner, buyer, agent, broker, admin, operator |
| **Listing lifecycle** | 11 canonical statuses; triple-column DB model (`status`, `lifecycle_status`, `moderation_status`) |
| **Communication** | Inbox (conversations/messages) + Viewings (`viewing_requests`); strict separation |
| **Geography** | V1 structured selectors + legacy field compatibility + 8-region map |
| **Moderation** | Admin pending queue; owner cannot self-approve; rejection reasons |
| **Discovery** | Client-side filter after full approved-listings fetch; URL-synced filters |
| **Notifications** | Queue → delivery RPC → `notifications` table; role-aware deep links |
| **Release stage** | Open Beta; Geographic Update launch window (Jul 2026) |

---

## 2. Public Marketplace

### Homepage (`/`)

| Capability | Status | Evidence |
|------------|--------|----------|
| Site navigation | ✓ | `src/components/SiteNav.jsx` |
| Map-first hero layout | ✓ | `src/pages/index.js`, `HomeMapFirst.module.css` |
| Hero copy & trust line | ✓ | `index.js` |
| Interactive Belize map in hero | ✓ | `BelizeMap.jsx` → district routes |
| Hero keyword search | ✓ | Routes to `/search?q=` |
| Advanced filters modal | ✓ | `HomeAdvancedFiltersModal.jsx` |
| Featured listings carousel | ± | Newest 12 by `created_at` (not editorial curation) |
| Recently added section | ✓ | Next 48 listings; local keyword filter |
| Marketplace statistics | ✓ | Active / for-sale / for-rent counts |
| Premium empty states | ✓ | `PremiumEmptyState.jsx` |
| Geographic Update modal | ✓ | `GeographicUpdateModal.jsx`; time-gated Jul 13–16 2026 |
| Sea-flow animation mode | 🔒 | Admin browser toggle; `useSeaFlowMode.js` |
| Responsive mobile layout | ? | CSS + mobile QA scripts; full browser QA incomplete |

### Search & Discovery (`/search`)

| Capability | Status | Evidence |
|------------|--------|----------|
| Keyword search | ✓ | `search.jsx`, `searchFilters.js` |
| Price, beds, baths filters | ✓ | `FilterBar.jsx` |
| Sale / rent market filter | ✓ | `searchFilters.js` |
| Property type filter | ✓ | `searchFilters.js` |
| Verified-only filter | ✓ | `searchFilters.js` |
| Sort options | ✓ | `searchFilters.js` |
| Geography V1 filters (region/community/locality) | ✓ | `GeographyDiscoveryFilters.jsx` |
| District / map-region filter | ✓ | URL keys `region`, `district`, `subregion` |
| Legacy URL compatibility | ↩ | `geographyLayer.js`, alias normalization |
| Filter pills & result counts | ✓ | `search.jsx` |
| URL persistence (shallow routing) | ✓ | `buildSearchRouterQuery` |
| Mobile filter bar | ? | `filterBarMobile.js`, `FilterBar.jsx` |
| Highway / mile public filter | ○ | Mile only on create/edit; not in `SearchFilterState` |
| Server-side filtered search | ○ | `docs/discovery/extension-points.md` |
| Lifestyle / curated featured search | ○ | Keyword-only stubs in docs |

### District browse (`/listings/district/[district]`)

| Capability | Status | Evidence |
|------------|--------|----------|
| District landing pages | ✓ | `[district].jsx` |
| Subregion query param | ✓ | `?subregion=` |
| Extended local filters | ± | Some filters local-only (not synced to `/search` URL) |
| Breadcrumbs / district copy | ✓ | `DistrictLayout` patterns |

### Interactive map

| Capability | Status | Evidence |
|------------|--------|----------|
| Eight clickable SVG regions | ✓ | `belizeMapRegions.js`, `clean-mainland-districts.svg` |
| Corozal, Orange Walk, Belize, Cayo, Stann Creek, Toledo | ✓ | Map region config |
| Ambergris Caye (island region) | ✓ | `geographyLayer.js` — parent Belize district |
| Caye Caulker (island region) | ✓ | `geographyLayer.js` |
| Click → district browse route | ✓ | `BelizeMap.jsx` fly animation + `router.push` |
| Active-region hover states | ✓ | `BelizeMap.jsx` |
| Mobile map sizing | ? | Responsive CSS; QA scripts exist |
| Listing counts on map overlays | ○ | Prop accepted but not rendered |
| Neighborhood polygons on map | ○ | Not implemented |
| District page embedded map | ○ | Not on `[district].jsx` |

### Listing cards

| Capability | Status | Evidence |
|------------|--------|----------|
| Image gallery swipe | ✓ | `ListingCard.jsx` |
| Title, price, property type | ✓ | `ListingCard.jsx` |
| Location display (V1 formatter) | ✓ | `formatListingLocation.js` |
| FOR SALE / FOR RENT badges | ✓ | `ListingCard.jsx` |
| Recently sold badge | ✓ | `ListingCard.jsx` |
| Verification shield | ✓ | `trustModel.js` |
| Favorite action | ✓ | `useFavorites.js` |
| Share action | ✓ | `ShareListingIconButton` |
| Lifecycle-aware display | ✓ | `canonicalListing.js` |
| Agent/owner context | ✓ | Card metadata |
| Responsive card layout | ✓ | Card CSS modules |

### Listing detail (`/listing/[id]`)

| Capability | Status | Evidence |
|------------|--------|----------|
| Image gallery + lightbox | ✓ | `[id].js` |
| Property information | ✓ | Detail sections |
| Structured location display | ✓ | Geography formatter |
| Message via BelizeListings | ~/? | `ListingMessageModal.jsx`; `BL_ENABLE_CONVERSATIONS` |
| Schedule Viewing | ~/? | `ListingViewingBookingModal.jsx`; `BL_ENABLE_VIEWING_PERSIST` |
| Contact agent modal | ✓ | `ContactAgentModal.jsx` |
| WhatsApp contact | ✓ | `ListingContactActions.jsx` |
| Favorites | ✓ | Detail favorite control |
| Property history timeline | ~ | `BL_ENABLE_LISTING_EVENTS` |
| Owner/agent information | ✓ | Contact resolver |
| Detail view tracking | ✓ | `recordListingDetailView` |
| Engagement gates (closed listings) | ✓ | `isListingEngagementEnabled()` |
| SEO title/description | ± | Client-side `PageHead`; no SSR/og:image |
| JSON-LD structured data | ○ | Not found |
| Unavailable/closed states | ✓ | Lifecycle presentation |

### Other public routes

| Route | Capability | Status |
|-------|------------|--------|
| `/favorites` | Saved listings (auth) | ✓ |
| `/agents`, `/agents/[username]` | Agent directory & public profiles | ✓ |
| `/agent/[username]` | Legacy redirect | ↩ |
| `/learn-more` | Product marketing | ✓ |
| `/login`, `/signup`, `/signin` | Auth entry | ✓ |
| `/forgot-password`, `/reset-password` | Password recovery | ✓ |

---

## 3. Accounts, Authentication & Profiles

| Capability | Status | Evidence |
|------------|--------|----------|
| Email/password sign-up | ✓ | `signup.jsx` |
| Login | ✓ | `login.jsx`, `signin.jsx` |
| Logout | ✓ | Auth hooks |
| Email verification / resend | ✓ | Supabase `auth.resend()` in login |
| Password recovery | ✓ | `forgot-password.jsx`, `reset-password.jsx` |
| Auth callback handler | ✓ | `auth/callback.jsx` |
| Session handling (Supabase) | ✓ | `supabaseClient.js` |
| Protected dashboard routes | ✓ | `useAuth`, `useRoleAccess` |
| Profile auto-creation on signup | ✓ | `handle_new_user()` migration |
| Profile editing | ✓ | Dashboard profile tabs |
| Profile completion gate | ✓ | `ProfileCompletionGateModal.jsx` |
| Username uniqueness check | ✓ | `/api/auth/check-username` |
| Public agent profiles | ✓ | `/agents/[username]` |
| Avatar / profile image | ± | Supported where profile fields exist |
| Contact details on profile | ✓ | `20260701120000_profile_contact_and_completion.sql` |
| Geographic Update modal seen marker | ✓ | `geographicUpdateLaunch.js` |
| Notification preferences UI | ○ | No dedicated preferences panel found |
| Admin-created users | 🔒 | `ManageUsersPanel` + `/api/admin/create-user` |

### Roles & practical permissions

| Role | DB `profiles.role` | Primary surface | Notes |
|------|-------------------|-----------------|-------|
| Public visitor | — | Marketplace | Browse, search, guest inquiry if enabled |
| Registered user | `user` | `/dashboard/user` | Buyer + optional owner if has listings |
| Listing owner | `user` (with listings) | User dashboard | Inbox + Viewings as owner |
| Buyer / renter | `user` | User dashboard | Inbox + Viewings as requester |
| Agent | `agent` | `/dashboard/agent` | Listings, Inbox, Viewings |
| Broker | `broker` / `brokerage` | `/dashboard/broker` | Team inventory oversight |
| Admin | `admin` | `/admin` | Full moderation + CRM |
| Operator | Presentation tone | Admin **Operator** tab | Cross-listing ops editor |

**Multi-role on one account:** A `user` can simultaneously be a **buyer** (Inbox/Viewings as requester) and **owner** (Inbox/Viewings for owned listings). Admins can also use buyer + owner CRM surfaces on `/admin`. Agents have a dedicated dashboard; brokers see team listings.

**Permission helpers:** `useRoleAccess.js` — `canCreateListings`, `canModerateListings`, `canAccessDashboard`.

---

## 4. Listing Creation (`/dashboard/create`)

| Capability | Status | Evidence |
|------------|--------|----------|
| Multi-step create workspace | ✓ | `create.jsx` (~2300 lines) |
| Initial draft creation | ✓ | `listingPersistence.js` |
| Title, price, currency | ✓ | Create form |
| Property type | ✓ | Create form |
| Sale / rent status | ✓ | Create form |
| Bedrooms / bathrooms | ✓ | Create form |
| Land / property details | ✓ | Create form |
| Descriptions | ✓ | `listingDescriptionFormat.js` |
| Amenities | ✓ | `listingAmenities.js` |
| Image upload & ordering | ✓ | `createListingUploads.js` |
| Image optimization | ✓ | `optimizeListingUploadFile.js` |
| Validation | ✓ | `validateListingDraftContract` |
| Draft autosave | ✓ | `buildDraftAutosavePayload` |
| Save Draft / Save & Exit | ✓ | Create workspace actions |
| Resume draft | ✓ | Draft detection |
| Preview | ✓ | Create flow |
| Submit for review | ✓ | `submitDraftListingForReview` |
| Edit published listing | ✓ | Edit mode in create workspace |
| Rejected listing resubmission | ✓ | Pending tab flow |
| Mobile create behavior | ? | Native geography selects; QA incomplete |
| Tier listing cap enforcement | ✓ | `listingTierCaps.js`, enforce-active-cap API |

### Geography V1 on create

| Capability | Status | Evidence |
|------------|--------|----------|
| District / Region selector (native `<select>`) | ✓ | `GeographySelector.jsx` |
| City / Town / Village / Highway | ✓ | Community step |
| Neighborhood / Locality | ✓ | Locality step |
| Optional highway mile | ✓ | Mile field when highway selected |
| Eight map regions in selector order | ✓ | `MAP_REGION_SELECTOR_ORDER` |
| Duplicate-name parent scoping | ✓ | `belizeGeographyV1.js` |
| Aliases (Western Highway → George Price, etc.) | ✓ | `geo_aliases` seed |
| "Not Listed" locality workflow | ✓ | `locality_not_listed_text` column |
| Legacy `district` / `region_slug` compatibility | ↩ | `legacyGeoBackfill.js` |
| Structured fields persisted to listings | ✓ | `20260713215000_*` migration |
| Location formatter for display | ✓ | `formatListingLocation.js` |

**Example paths supported in data model:** Belize City → King's Park; San Ignacio → Maya Vista; Corozal Town → Finca Solana; San Pedro → Secret Beach; Independence/Mango Creek; Hopeville; John Smith Road; Ambergris Caye; Caye Caulker.

---

## 5. Listing Lifecycle

### Canonical statuses (11)

| Status | DB key | Who sets | Public visibility | Messaging/viewing |
|--------|--------|----------|-------------------|-------------------|
| Draft | `draft` | Owner | Hidden | Disabled |
| Pending Review | `pending` | Owner submit | Hidden | Disabled |
| Verified | `verified` | Admin verification action | As published rules | Per engagement gate |
| Published | `approved` | Admin approve | Browsable | Enabled |
| Recently Sold | `recently_sold` | Owner mark sold | 30-day public window | Gated |
| Recently Rented | `recently_rented` | Owner mark rented | 30-day public window | Gated |
| Sold | `sold` | Owner / lifecycle | Internal | Disabled |
| Rented | `rented` | Owner / lifecycle | Internal | Disabled |
| Archived | `archived` | Owner / admin | Hidden | Disabled |
| Rejected | `rejected` | Admin reject | Hidden | Disabled |
| Expired | `expired` | System/policy | Hidden | Disabled |

**Evidence:** `src/constants/operationalModel.js`, `20260712120000_p0_marketplace_security.sql` (engagement gates), `20260710200000_recently_closed_listing_lifecycle.sql`.

### Dashboard listing management tabs

**Current layout (not consolidated):** Active (**My Listings**), **Pending**, and **Archived** remain **separate top-level tabs** on the user dashboard. Consolidation under a single "My Listings" shell is **documented for a future milestone** — `docs/platform/listing-lifecycle-ux-milestone.md`.

| Tab | Actions | Status |
|-----|---------|--------|
| **My Listings** (active) | View, edit, mark sold/rented, archive, metrics | ✓ `UserMyListingsPanel.jsx` |
| **Pending** | View moderation state, edit, resubmit | ✓ Pending panels |
| **Archived** | View, edit, restore for review, permanent delete | ✓ `UserArchivedListingsPanel.jsx` |

| Metric | Status | Evidence |
|--------|--------|----------|
| Listing views | ± | `listing_detail_views` + RPC; flag-dependent |
| Saves count | ± | Favorites table |
| Inquiry counts | ~ | `BL_ENABLE_INQUIRIES` |
| Views/saves on row intel | ± | `UserListingRowIntel.jsx` — some placeholders |

---

## 6. Moderation & Verification

| Capability | Status | Evidence |
|------------|--------|----------|
| Pending listing queue (admin) | ✓ | `PendingListingsPanel.jsx` |
| Approve listing | ✓ | Admin moderation actions |
| Reject listing with reasons | ✓ | `RejectListingModal.jsx`, `rejectionModel.js` |
| Bulk approve / reject | ✓ | `admin/index.jsx` |
| Verified badge | ✓ | `listing_verification_status` migration |
| Admin trust actions | ✓ | `AdminListingTrustAction.jsx` |
| Owner cannot self-approve | ✓ | `enforce_listing_owner_moderation_boundary()` |
| Owner notification on decision | ± | Listing lifecycle events; email stub |
| Resubmission after reject | ✓ | Pending tab + create edit |
| Archived / closed handling | ✓ | Lifecycle transitions |
| Duplicate prevention | ± | Conversation/viewing dedupe; listing dedupe limited |
| Admin error toasts | ✓ | `ToastProvider` |

---

## 7. Favorites & Saved Listings

| Capability | Status | Evidence |
|------------|--------|----------|
| Save favorite (auth) | ✓ | `useFavorites.js` |
| Remove favorite | ✓ | `useFavorites.js` |
| Saved Favorites tab | ✓ | User dashboard + `/favorites` |
| Guest prompt to sign up | ✓ | `ListingCard.jsx` |
| Persistence (`favorites` table) | ✓ | Referenced in delete RPCs |
| Realtime favorites sync | ± | Subscription in hook |
| Closed/archived listing display | ✓ | Filtered in favorites fetch |
| Favorite notifications | ○ | No favorite-specific notification event |
| Empty states | ✓ | `PremiumEmptyState` variant `favorites` |

---

## 8. Inbox & Internal Messaging

**Final tab naming:** **Inbox** (all roles). Legacy: Messages, Owner Inbox, Inquiries → Inbox.

| Capability | Status | Evidence |
|------------|--------|----------|
| Buyer sends Message via BelizeListings | ~/? | `ListingMessageModal` + `create_inquiry_with_conversation` |
| Owner receives message | ~/? | Inbox panels; `BL_ENABLE_CONVERSATIONS` |
| Owner / agent replies | ~/? | `sendAgentReply` |
| Buyer replies in thread | ~/? | `sendBuyerReply` |
| Admin buyer + owner CRM surfaces | ~/? | `admin/index.jsx` dual panels |
| Conversation grouping by listing | ✓ | `OwnerInquiriesPanel`, grouping tests |
| Unread state | ✓ | `isAgentConversationUnread`, `buyer_unread` |
| Realtime message updates | ~/? | `useConversationMessagesRealtime.js` |
| Archive conversation | ✓ | `archiveConversation*` |
| Delete conversation (participant) | ✓ | `participant_delete_conversation` RPC |
| Notification per message | ~/? | `NEW_INQUIRY`, `AGENT_REPLIED` |
| Role-aware deep links | ✓ | `resolveMessageConversationPath` |
| Synthetic viewing threads excluded | ✓ | `filterInboxConversations` |
| Mobile Inbox | ? | Dashboard responsive; QA incomplete |

**Buyer access:** `UserInboxPanel` on `/dashboard/user`.  
**Owner access:** `AdminOwnerInboxPanel` section=`inquiries` (user + admin when has listings).  
**Agent access:** `OwnerInquiriesPanel` on `/dashboard/agent`.

---

## 9. Viewings

**Final tab naming:** **Viewings** (all roles). Legacy: Viewing Requests, My Viewings → Viewings.

| Capability | Status | Evidence |
|------------|--------|----------|
| Schedule Viewing modal | ~/? | `ListingViewingBookingModal.jsx` |
| Requested date & time | ✓ | `createViewingRequest` |
| Belize-time slot display | ✓ | `formatViewingSlotLabel` (America/Belize) |
| Viewing statuses: requested, confirmed, declined, rescheduled, cancelled, completed | ✓ | `VIEWING_STATUS` in `crmConstants.js` |
| Expired status | ○ | Not in `VIEWING_STATUS` enum |
| Owner confirm / decline / propose time | ~/? | `AgentViewingsPanel.jsx` |
| Buyer accept / decline proposed time | ~/? | `BuyerViewingsPanel.jsx`, `rejectViewingReschedule` |
| Cancel (both parties notified) | ~/? | `cancelViewing` |
| Mark completed | ~/? | `markViewingCompleted` |
| Delete (participant-only) | ✓ | `participant_delete_viewing` RPC |
| Message Buyer (explicit only) | ~/? | `viewingMessaging.js`, `ensure_messaging_conversation` RPC |
| No auto Inbox thread on viewing create | ✓ | `conversation_id: null` in `createViewingRequest` |
| Realtime viewing updates | ~/? | `useViewingsRealtime.js` |
| Appointment-style card layout | ✓ | `AgentViewingsPanel.jsx` (Jul 2026 polish) |

### Viewing notification matrix

| Event | Actor | Recipient | Notification | Destination |
|-------|-------|-----------|--------------|-------------|
| Viewing requested | Buyer | Owner/agent | New viewing request + slot | `?tab=viewings&viewing=` |
| Viewing confirmed | Owner/agent | Buyer | Viewing confirmed + slot | Viewings |
| Viewing declined | Owner/agent | Buyer | Viewing declined | Viewings |
| Viewing rescheduled | Either party | Other party | Viewing rescheduled + slot | Viewings |
| Proposed time accepted | Either party | Other party | Viewing confirmed | Viewings |
| Proposed time declined | Buyer | Owner | Reschedule declined | Viewings |
| Viewing cancelled | Either party | **Both** | Viewing cancelled | Viewings |
| Viewing completed | Owner/agent | **Both** | Viewing completed | Viewings |

**Evidence:** `notificationMatrix.test.js`, `20260714180000_crm_notification_matrix.sql`, `viewingMutations.js`, `scripts/verify-crm-notification-matrix.mjs` — **verified live 2026-07-14**.

---

## 10. Notification System

| Capability | Status | Evidence |
|------------|--------|----------|
| `notifications` table (durable inbox) | ✓ | `20260627120000_notification_delivery.sql` |
| `notification_queue` (async) | ✓ | `20260626160000_crm_foundation.sql` |
| `enqueue_notification_event` RPC | ✓ | `20260712120000_p0_marketplace_security.sql` |
| `deliver_notification` / batch RPC | ✓ | `20260627120000_*` |
| Dedupe keys | ✓ | Per-event keys in registry + SQL |
| Read/unread state | ✓ | `read_at`, NotificationCenter |
| Notification Center UI | ? | `NotificationCenter.jsx` — **UI pending QA**; DB pipeline live |
| Realtime notification refresh | ± | Polling/subscription patterns |
| `notification_presentation_for_event` SQL | ✓ | `20260714180000_*` — **8-event matrix verified** |
| Geographic Update broadcast | ~ | `broadcast_geographic_update_v1()` |
| Service-role broadcast | 🔒 | Geographic update RPC |
| Cron endpoint | ? | `/api/cron/process-notifications` |
| Netlify scheduled cron (5 min) | ? | `process-notifications-cron.mjs` |
| Email channel (Resend) | ○ | Stub — skipped without `RESEND_API_KEY` |

### Implemented notification event types

| Event | Enqueued in app | Copy registry | Deep links | Notes |
|-------|----------------|---------------|------------|-------|
| `new_inquiry` | ✓ | ✓ | Inbox | Includes buyer messages |
| `agent_replied` | ✓ | ✓ | Inbox | |
| `viewing_requested` | ✓ | ✓ | Viewings | |
| `viewing_confirmed` | ✓ | ✓ | Viewings | |
| `viewing_declined` | ✓ | ✓ | Viewings | |
| `viewing_rescheduled` | ✓ | ✓ | Viewings | Includes decline variant |
| `viewing_cancelled` | ✓ | ✓ | Viewings | Both parties |
| `viewing_completed` | ✓ | ✓ | Viewings | Both parties |
| `inquiry_archived` | ○ | ✓ | Inbox | Registry only — no enqueue found |
| `geographic_update_v1` | ✓ | ✓ | Listings by role | One-time broadcast |

**Listing lifecycle / moderation / upgrade notifications:** Routed via `resolveNotificationDestination` default branch for `listing_id` / `to_status` — not all have dedicated `NOTIFICATION_EVENT_TYPES` constants.

---

## 11. Dashboards by Role

### Platform User (`/dashboard/user`)

| Tab | Status | Notes |
|-----|--------|-------|
| Overview | ✓ | Metrics, CTAs |
| My Listings | ✓ | Active inventory |
| Pending | ✓ | Separate tab (not consolidated) |
| Archived | ✓ | Separate tab |
| Saved Favorites | ✓ | |
| Profile | ✓ | |
| **Inbox** | ~/? | CRM flag-gated |
| **Viewings** | ~/? | CRM flag-gated |

Deep links: `?tab=`, `?conversation=`, `?viewing=`, `?listing=`.  
Loading: skeleton panels. Empty: `PremiumEmptyState`. Mobile: tab scroll in shell.

### Agent (`/dashboard/agent`)

| Tab | Status |
|-----|--------|
| Overview | ✓ |
| Listings (inventory filters) | ✓ |
| **Inbox** | ~/? |
| **Viewings** | ~/? |
| Profile | ✓ |

Inventory filters: All, Active, Pending, Rejected, Archived, Drafts. Public agent profile linked. Welcome modal on first visit.

### Admin (`/admin`)

| Tab | Status |
|-----|--------|
| Pending | ✓ |
| Listings (all) | ✓ |
| Users (create, roles, delete) | ✓ |
| Operator | ✓ |
| Upgrades | ✓ |
| **Inbox** | ~/? |
| **Viewings** | ~/? |

URL-synced tabs. Marketplace health at `/admin/marketplace-health`. Geography panel component exists but **not wired** into admin index.

### Broker (`/dashboard/broker`)

| Capability | Status |
|------------|--------|
| Team listing overview | ✓ |
| District / health insights | ✓ |
| Agent activity feed | ✓ |
| Inbox / Viewings | × | Not on broker dashboard |

### Operator (admin tab)

| Capability | Status |
|------------|--------|
| Cross-listing operator editor | ✓ `OperatorListingsPanel.jsx` |
| Property/unit page | ± | `/dashboard/operator/property/[id]` |
| Inbox / Viewings | ~/? | Via admin CRM tabs when admin user |

---

## 12. Geography System (V1.0)

| Entity | Live total | Evidence |
|--------|----------:|----------|
| Map regions | **8** | Seed + runtime |
| Administrative districts | **6** | `administrative_district_id` |
| Communities | **232** | Seed |
| Localities | **107** | Seed |
| National highways | **5** | Seed |
| Highway–region links | **11** | `geo_highway_map_regions` |
| Road corridors | **20** canonical | Seed |
| Aliases | **17** rows | `geo_aliases` |
| Total geography records | **387** | Reconciliation report |

| Capability | Status |
|------------|--------|
| Static JS runtime data | ✓ `belizeGeographyV1Data.js` |
| Database geography tables | ~ `geo_*` migrations |
| Seed reconciliation | ✓ `belize-v1-seed-reconciliation-report.md` |
| Listing backfill RPC | ~ `backfill_listing_geography_v1()` |
| Search integration | ✓ `geographySearchFilters.js` |
| Display formatting | ✓ `formatListingLocation.js` |
| Mile filter on search | ○ Deferred |
| Parent-scoped duplicate names | ✓ |
| San Pedro / Santa Elena / Hopeville / Independence-Mango Creek / Alta Mira / John Smith Road / Cayes | ✓ In seed data |

---

## 13. Admin Geography Management

| Capability | Status | Evidence |
|------------|--------|----------|
| Hierarchy viewer (read-only) | ± | `AdminGeographyPanel.jsx` — **not wired** to admin page |
| Add localities (DB tools) | ~ | Documented; no full admin CRUD UI |
| Alias management | ~ | DB seed + docs |
| Disable/enable records | ~ | `active` column; admin RLS |
| Not Listed user submissions | ✓ | Create listing field → `locality_not_listed_text` |
| Unmatched legacy review | ~ | `geo_backfill_status` on listings |
| Production admin UI completeness | ± | Read-only panel exists; not in nav |

---

## 14. Property Management / Operator

| Capability | Status | Evidence |
|------------|--------|----------|
| Operator property page | ± | `operator/property/[id].jsx` |
| Properties / units UI | ± | `PropertiesPanel.jsx`, `VacancyPanel.jsx` |
| `properties` / `units` DB tables | ○ | **Not in repo migrations** — frontend references only |
| Structured geography on properties | ○ | Not unified with marketplace listings |
| Tenant / lease management | ○ | Not found in migrations |
| Marketplace ↔ property records unified | ○ | Separate models |

---

## 15. SEO, Routing & Metadata

| Capability | Status |
|------------|--------|
| Homepage metadata | ± `siteMetadata.js`, `PageHead.jsx` |
| Listing page title (client) | ± |
| District landing pages | ✓ |
| Public agent profile URLs | ✓ |
| Legacy agent URL redirect | ↩ `/agent/` → `/agents/` |
| Canonical listing URLs | ✓ `/listing/[id]` |
| Locality landing pages | ○ |
| Sitemap | ○ Not found |
| JSON-LD | ○ |
| og:image | ○ |
| Breadcrumbs | ± District pages |

---

## 16. Realtime Systems

| Surface | Status | Evidence |
|---------|--------|----------|
| Conversation messages | ~/? | `useConversationMessagesRealtime` |
| Inbox thread list | ~/? | Conversation subscriptions |
| Viewing requests | ~/? | `useViewingsRealtime` |
| Notifications | ± | Fetch on load; limited realtime |
| Favorites | ± | `useFavorites` subscription |
| Listing changes on dashboard | ± | Refetch on focus / manual refresh |
| Subscription cleanup | ✓ | Hook teardown patterns |

---

## 17. Security & Data Access

| Capability | Status | Evidence |
|------------|--------|----------|
| RLS on profiles | ✓ | Profile migrations |
| RLS on listings (public browse gate) | ✓ | `is_listing_publicly_browsable()` |
| RLS on CRM tables (participant scope) | ✓ | CRM foundation |
| RLS on geography (public read) | ✓ | Geo schema migration |
| Admin `is_admin()` bypass | ✓ | SECURITY DEFINER helpers |
| Owner moderation boundary trigger | ✓ | P0 security migration |
| Engagement gates (inquiry/viewing) | ✓ | `is_listing_engagement_enabled()` |
| Service-role cron/auth routes | 🔒 | Cron + admin APIs |
| Inquiry rate limiting | ✓ | `20260628120000_inquiry_rate_limits.sql` |
| Turnstile guest protection | ~ | `BL_ENABLE_TURNSTILE` |
| Participant-only delete RPCs | ✓ | Permanent delete migrations |
| Anti-enumeration (username check) | ± | API exists |

---

## 18. Emails & External Communication

| Channel | Status |
|---------|--------|
| Supabase auth emails | ✓ Signup, reset, verification |
| Resend transactional | ○ Stub in `deliverNotifications.js` |
| Moderation emails | ○ |
| Message/viewing emails | ○ |
| WhatsApp on listing detail | ✓ `ListingContactActions.jsx` |
| Direct phone/email display | ✓ Contact resolver |

---

## 19. Mobile Experience

| Capability | Status |
|------------|--------|
| Responsive homepage & map | ? |
| Mobile search & filters | ? `filterBarMobile.js` |
| Mobile listing cards | ✓ |
| Contact / viewing modals | ? |
| Native geography `<select>` on create | ✓ |
| Dashboard tab scrolling | ✓ |
| Inbox / Viewings on mobile | ? |
| 44px touch targets | ± Design tokens |
| Safari / Facebook in-app browser | ? QA scripts exist |
| Playwright mobile viewports | ✓ 390px, 414px in `playwright.config.mjs` |

---

## 20. Design System & UX Components

| Component / system | Status | Path |
|--------------------|--------|------|
| PremiumEmptyState | ✓ | `components/ui/PremiumEmptyState.jsx` |
| ToastProvider | ✓ | `components/ui/ToastProvider.jsx` |
| DeleteConfirmationModal | ✓ | `DeleteConfirmationModal.jsx` |
| ListingInteractionModal | ✓ | Listing modals |
| useModalController | ✓ | `hooks/useModalController.js` |
| DashboardShell | ✓ | `components/dashboard/` |
| Design tokens | ✓ | `styles/tokens.css` |
| Lifecycle status pills | ✓ | Dashboard + cards |
| Loading skeletons | ✓ | `loadingStyles` patterns |
| Error boundaries | ± | Limited coverage |

---

## 21. Analytics & Operational Metrics

| Metric | Status | Evidence |
|--------|--------|----------|
| Listing detail views | ~ | `listing_detail_views`, RPC |
| Owner listing metrics RPC | ~ | `get_owner_listing_metrics` |
| Saves (favorites) | ✓ | `favorites` table |
| Inquiry counts | ~ | Flag-gated |
| Viewing request counts | ~ | Flag-gated |
| Geographic modal events | ± | Launch helper |
| Admin marketplace health | ✓ | `/admin/marketplace-health` |
| Dashboard stat placeholders | ± | Some chips static or flag-gated |

---

## 22. Feature Flags & Environment

| Flag | Env variable | Code default | Production typical |
|------|--------------|--------------|-------------------|
| Inquiries metric | `NEXT_PUBLIC_BL_ENABLE_INQUIRIES` | false | ~ Enable after migration |
| Conversations / Inbox | `NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS` | false | ~ Enable for CRM |
| Viewing persist | `NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST` | false | ~ Enable for Viewings |
| Notifications | `NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS` | false | ~ Enable for Notification Center |
| Listing events | `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS` | false | ~ Property history |
| Turnstile | `NEXT_PUBLIC_BL_ENABLE_TURNSTILE` | false | Optional |
| Cron secret | `CRON_SECRET` | — | Required for cron |
| Service role | `SUPABASE_SERVICE_ROLE_KEY` | — | Required for admin/cron |
| Resend | `RESEND_API_KEY` | — | Optional (email stub) |

**Required infrastructure:** Supabase URL + anon key; Netlify build; migrations applied to linked Supabase project.

---

## 23. Database Inventory (high level)

| Table | Feature |
|-------|---------|
| `profiles` | Identity, roles, contact |
| `listings` | Core inventory + geo columns |
| `listing_images` | Gallery (referenced) |
| `favorites` | Saved listings |
| `listing_inquiries` | CRM inquiry records |
| `conversations` | Inbox threads |
| `messages` | Thread messages |
| `viewing_requests` | Viewings workflow |
| `notification_queue` | Async notification pipeline |
| `notifications` | In-app notification inbox |
| `listing_events` | Property history audit |
| `listing_detail_views` | View metrics |
| `agent_upgrade_requests` | Agent onboarding |
| `security_events` | Abuse audit |
| `geo_map_regions` … `geo_locality_requests` | Geography V1 |
| `admin_user_deletion_audit` | Admin audit |

**Key RPCs:** `create_inquiry_with_conversation`, `ensure_messaging_conversation`, `enqueue_notification_event`, `deliver_notification`, `process_notification_queue_batch`, `notification_presentation_for_event`, `backfill_listing_geography_v1`, `broadcast_geographic_update_v1`, `permanently_delete_listing`, `permanently_delete_user`, listing lifecycle helpers in P0 security migration.

---

## 24. Test & Build Coverage

| Area | Test files (approx) | Status |
|------|--------------------:|--------|
| CRM / Inbox / Viewings | 14+ | ✓ 527 total passing |
| Notifications | 8+ | ✓ Matrix tests added |
| Geography V1 | 7+ | ✓ |
| Search / filters | 3+ | ✓ |
| Listing persistence | 25+ | ✓ |
| Security (P0) | 4+ | ✓ |
| Dashboard routes | 5+ | ✓ |
| Components | 10+ | ✓ |
| E2E Playwright | 3 specs | ? Staging flows |
| Production build | — | ✓ `npm run build` succeeds |

**Note:** Passing unit tests do not prove live browser behavior or production flag activation.

---

## 25. Deployment & Operations

| Item | Status | Evidence |
|------|--------|----------|
| Netlify production deploy | ✓ | https://belizelistings.bz |
| Latest production commit | ✓ | `1351b61` (2026-07-14) |
| Supabase linked project | ~ | Env in `.env.local` (not documented here) |
| Migrations in repo | ✓ | 31 files |
| Migrations applied to production DB | ~ | Requires verification per environment |
| Geography backfill | ~ | RPC exists; run status environment-specific |
| Notification cron scheduled | ~ | Netlify `*/5 * * * *` when `CRON_SECRET` set |
| Rollback | ✓ | Git revert + Netlify deploy prior commit |
| Open Beta status | ✓ | Communication loop migrations dated Jul 2026 |

---

## 26. Complete Feature Checklist (condensed)

### Marketplace
- [✓] Map-first homepage with interactive 8-region Belize map
- [✓] Public search with URL-synced filters
- [✓] District / region browse pages
- [✓] Listing cards with favorites, share, badges
- [✓] Listing detail with contact actions
- [±] Featured listings (newest-12 heuristic)
- [±] SEO metadata (no SSR / og:image)
- [○] Server-side search indexing
- [○] Highway mile public filter
- [○] Map listing count overlays

### Accounts
- [✓] Sign-up, login, logout, password recovery
- [✓] Email verification resend
- [✓] Protected dashboards by role
- [✓] Profile completion gate
- [✓] Public agent profiles
- [○] Notification preference settings

### Listings
- [✓] Multi-step create with draft autosave
- [✓] Image upload and ordering
- [✓] Submit for review / moderation lifecycle
- [✓] Edit, mark sold/rented, archive, restore
- [✓] Tier-based listing caps
- [±] Owner analytics (views metric RPC)

### Geography
- [✓] V1 structured selectors on create (8 regions)
- [✓] 387-record seed (232 communities, 107 localities, 5 highways)
- [✓] Aliases and legacy field compatibility
- [✓] Discovery filters on search
- [~] Database geography tables (migration-dependent)
- [○] Public mile filter on search

### Search
- [✓] Keyword, price, beds, baths, market, type, verified
- [✓] Geography region/community/locality filters
- [±] Client-side post-fetch filtering only

### Map
- [✓] Eight regions with click-to-browse
- [✓] Ambergris Caye & Caye Caulker as regions
- [○] Neighborhood polygons
- [○] District listing counts on map

### Favorites
- [✓] Save/remove (auth)
- [✓] Saved Favorites tab and `/favorites` page

### Inbox
- [~] Buyer ↔ owner/agent messaging (flag-dependent)
- [✓] Viewing-only thread exclusion
- [✓] Archive / participant delete
- [~] Realtime messages
- [~] Per-message notifications

### Viewings
- [~] Full appointment workflow (flag-dependent)
- [✓] Inbox separation (no auto thread)
- [✓] Message Buyer on explicit click
- [~] Notification matrix (code complete; activation-dependent)
- [○] Expired viewing status

### Notifications
- [~] Durable queue + inbox (migration + flag)
- [✓] Event copy registry + SQL presentation
- [✓] Role-aware deep links
- [~] Netlify cron batch delivery
- [○] Email delivery (Resend)

### Dashboards
- [✓] User: Overview, My Listings, Pending, Archived, Favorites, Profile
- [✓] User/Agent/Admin: Inbox + Viewings tabs (renamed)
- [✓] Agent inventory dashboard
- [✓] Admin moderation + users + operator
- [✓] Broker team dashboard
- [○] My Listings consolidated sub-filters (planned)

### Admin
- [✓] Pending queue approve/reject
- [✓] User creation and permanent delete
- [✓] Verification / trust actions
- [±] Geography admin panel (unwired)
- [✓] Marketplace health page

### Property Management
- [±] Operator property page (frontend)
- [○] Unified properties/units database in repo migrations

### SEO
- [±] Basic PageHead metadata
- [○] Sitemap, JSON-LD, locality landing pages

### Mobile
- [?] Responsive layouts (QA incomplete)
- [✓] Native geography selects
- [?] Full authenticated mobile CRM QA

### Security
- [✓] RLS + engagement gates + moderation boundary
- [✓] Participant-scoped CRM deletes
- [~] Turnstile guest protection (optional flag)

### Operations
- [✓] Netlify CI build + deploy
- [✓] Supabase migrations (31/31 applied to production, Jul 2026)
- [?] Notification cron (CRON_SECRET configured; delivery QA pending)

---

## 27. Known Limitations (factual)

1. **Notification Center UI pending QA** — Database notification queue, SQL presentation matrix, and enqueue paths are live; authenticated browser verification of Notification Center display remains open.
2. **Supabase migrations applied to production** — All 31 repo migrations applied (verified 2026-07-14); CRM pair `20260714150000` + `20260714180000` confirmed via `verify:crm-notification-matrix`.
3. **Authenticated browser QA incomplete** — E2E staging flows exist; full two-account production smoke test required for release sign-off.
4. **Email notifications stubbed** — Resend integration marks channel `skipped` without API key.
5. **Client-side-only search** — Full approved listings fetched then filtered in browser.
6. **Highway mile filter deferred** on public search (create/edit only).
7. **Admin Geography panel unwired** — Component exists; not in admin nav.
8. **Properties/units tables** — Operator UI references tables not created in repo migrations.
9. **Listing lifecycle tabs not consolidated** — Active, Pending, Archived remain separate (documented future milestone).
10. **Inquiry archived notification** — Copy exists; no enqueue path in app code.
11. **Tests ≠ live browser proof** — 527 unit tests pass; mobile Safari / Facebook IA browser QA open.
12. **SEO depth limited** — No SSR listing meta, og:image, or sitemap in repo.

### CRM migrations (production)

| Migration | Status | Applied |
|-----------|--------|---------|
| `20260714150000_crm_viewing_inbox_separation.sql` | Applied | 2026-07-14 |
| `20260714180000_crm_notification_matrix.sql` | Applied + verified | 2026-07-14 |

---

## 28. Removed or Replaced Features

| Before | After | Evidence |
|--------|-------|----------|
| Owner Inbox | **Inbox** | `dashboardUserConfig.js` |
| Viewing Requests | **Viewings** | Jul 2026 CRM polish |
| Messages tab | **Inbox** | Legacy alias |
| My Viewings tab | **Viewings** | Legacy alias |
| Agent Inquiries tab | **Inbox** | `dashboardAgentConfig.js` |
| Flat / datalist geography selector | Native `<select>` GeographySelector | Geography fix commit |
| Viewing creates Inbox thread | Viewing-only in Viewings; Inbox filtered | `conversationFilters.js` |
| Western/Northern Highway names | Canonical highway aliases | Geography V1 seed |
| Simulated viewing confirm (no persist) | `viewing_requests` when flag on | `featureFlags.js` |

---

## 29. Final Product Snapshot

### What BelizeListings can do today

A visitor can explore Belize real estate through a **living property map**, search and filter listings (including **V1 geography**), view rich listing detail, and contact owners via **WhatsApp** or gated **in-app messaging and viewing scheduling**. Registered users can **create listings** with structured geography, manage **draft → pending → published → closed** lifecycles, **save favorites**, and use unified **Inbox** and **Viewings** dashboards. Agents and admins have **inventory, moderation, verification, and CRM tools**. The platform enforces **RLS-backed security**, **tier listing caps**, and an **event-driven notification architecture** ready for Open Beta.

### Operationally required before public release

1. Confirm all **31 Supabase migrations** applied to production (especially CRM + notification matrix).
2. Enable **staged feature flags** on Netlify production build (inquiries → conversations → viewings → notifications).
3. Configure **`CRON_SECRET`** and verify notification cron delivers queue items.
4. Complete **authenticated end-to-end QA** (messaging, viewings, notifications, mobile).
5. Verify **Geographic Update** owner onboarding window behavior in production.

### After V1.0 (post-release enhancements)

- Consolidated **My Listings** sub-navigation (Active / Pending / Archived)
- Server-side search and discovery indexing
- Public highway mile filter
- Resend email notification channel
- Locality landing pages and full SEO (SSR, og:image, sitemap)
- Unified property management database for operator module
- Map overlays (counts, heat)
- Expired viewing status and analytics depth
- Wired admin geography CRUD UI

### Platform maturity scores (1–10)

| Area | Score | Brief rationale |
|------|------:|-----------------|
| Core marketplace | **8** | Map-first browse, cards, detail, favorites solid; client-side search limits scale |
| Listing management | **8** | Full lifecycle, create workspace, caps, moderation |
| Geography | **9** | V1 seed, selectors, aliases, backfill — mile search deferred |
| Search / discovery | **6** | Rich filters but all client-side post-fetch |
| Map | **7** | 8 regions live; overlays and polygons missing |
| CRM / messaging | **7** | Clean Inbox/Viewings split; flag + migration dependent |
| Viewings | **7** | Full workflow + matrix in code; production activation pending |
| Notifications | **7** | Durable architecture complete; email stub, cron verification needed |
| Admin | **8** | Moderation, users, operator, health — geography UI unwired |
| Mobile | **6** | Responsive + native selects; authenticated QA incomplete |
| Security | **8** | RLS, gates, rate limits, participant deletes |
| Operations | **7** | Netlify deploy solid; migration/cron/env discipline required |
| **Overall readiness** | **7.5** | Strong Open Beta platform; activation + QA gate full public launch |

---

## 30. Recommendation

**Yes — use this document as the official BelizeListings V1.0 internal reference**, alongside environment-specific runbooks for migration apply order and feature-flag activation. Refresh after each major release or when production flag/cron state changes.

**Companion machine-readable inventory:** `belizelistings-complete-capability-inventory.json`

---

*Generated from repository state at commit `1351b61` on branch `main`. Verify live production flags and Supabase migration state independently.*
