# Dashboard Redesign Log — July 15, 2026

Operational record of structural and visual dashboard work, homepage splash, confirmed bug fixes, and legacy cleanup completed in this pass.

**Related:** [open-beta-readiness.md](./open-beta-readiness.md) · [production-readiness-checklist.md](./production-readiness-checklist.md)

---

## Summary

| Area | Status |
|------|--------|
| Platform-wide dashboard nav + contrast | Shipped (`DashboardTabNav` Workspace/Activity clusters, solid surfaces, corrected status badges) |
| Admin-only Desk premium theme | Shipped — scoped to `/admin` chrome only |
| Homepage session splash | Shipped — once per browser session, 3s hold, skip/tap, reduced-motion bypass |
| Notification viewing branches regression | Fixed — migration `20260715190000_fix_geo_backfill_santa_elena.sql` |
| Santa Elena district-blind geo backfill | Fixed — SQL + `legacyGeoBackfill.js` |
| Legacy cleanup | Shipped — orphan files removed, `react-router-dom` dropped, href helper consolidated |

---

## 1. Platform-wide dashboard redesign

### Nav structure (all roles)

`DashboardTabNav` now partitions tabs into **Workspace** and **Activity** clusters via `partitionDashboardTabs()` (`src/lib/dashboardTabGroups.js`). Optional count chips surface pending inbox/viewing totals without changing tab IDs or query-param routing.

| Role | Workspace tabs | Activity tabs |
|------|----------------|---------------|
| **User** (`/dashboard/user`) | Overview, My Listings, Favorites | Inbox, Viewings, Notifications |
| **Agent** (`/dashboard/agent`) | Overview, Listings, Profile | Inbox, Viewings, Notifications |
| **Broker** (`/dashboard/broker`) | Overview, Roster, Listings | Inbox (when enabled) |
| **Admin** (`/admin`) | Pending, Listings, Users, Operator | Inbox, Viewings, Upgrades (feature-gated) |

Tab `onSelect` handlers and deep-link query params (`?tab=`, `?conversation=`, `?viewing=`) are unchanged — restyle is presentational only.

### Tokens / surfaces / status badges

- **Solid workspace surfaces** — `.dashboardWorkspace` in `Dashboard.module.css` replaces translucent glass panels with opaque `--surface-*` tokens for readable body copy on all dashboards.
- **Status badge colors** — `resolveLifecycleStatusBadgeSuffix()` (`src/lib/dashboardStatusBadges.js`) maps lifecycle states to contrast-tested `.status*` classes (Approved, Pending, RecentlySold, Archived, etc.). Badges inherit the same token set on user, agent, broker, and admin data surfaces.
- **Broker dashboard** — uses the same `DashboardShell` + `DashboardTabNav` pattern as user/agent; no admin premium layer.

### Admin-only Desk premium theme

Scoped strictly to `src/pages/admin/index.jsx` + `src/styles/AdminDashboardPremium.module.css`:

| Layer | Treatment |
|-------|-----------|
| Page backdrop | Mahogany wood-grain gradient (`.adminPage`) |
| Valance | Black silk curtain strips — `.silkHeader`, `.silkLeft`, `.silkRight` (fixed, `pointer-events: none`, `aria-hidden`) |
| Lamp hover | `.lampTarget` warm radial glow on hover/focus-within for shell cards and quick-action aside |
| Neon accents | `.adminTabNeonActive` on active nav tab; `.adminPrimaryAction` on sidebar CTAs |

**Constraint honored:** operational data lives inside `.dataSurface`, which resets to standard dashboard tokens. Tables, status pills, form inputs, and row density are **not** restyled by the premium module — chrome only.

---

## 2. Homepage session splash

**Files:** `src/lib/homeSessionSplash.js`, `src/components/home/HomeSessionSplash.jsx`, wired in `src/pages/index.js`.

| Behavior | Implementation |
|----------|------------------|
| Timing | 3s hold (`HOME_SPLASH_HOLD_MS = 3000`); homepage fetches and renders underneath during hold |
| Session scope | `sessionStorage` key `bl_home_splash_seen_v1` — once per fresh browser session, not on internal navigation |
| Skip | Click/tap or Escape ends immediately |
| Reduced motion | `shouldShowHomeSessionSplash()` returns false when `prefers-reduced-motion: reduce` |
| Accessibility | Splash is `aria-hidden`; on resolve, focus moves to `#home-main-content` |
| Visual | Pure black viewport; BL mark with animated blend of map district palette (mint/lagoon/coral/gold) |

If homepage data is not ready at 3s, cross-fade reveals the existing skeleton/loading state — splash never blocks unbounded.

---

## 3. Confirmed bug fixes

### 3a. `notification_presentation_for_event()` viewing branches

**Problem:** `20260713230000_geographic_update_notification.sql` replaced the function and dropped `viewing_requested`, `viewing_declined`, and `viewing_rescheduled` branches. Those events fell through to generic "Operational update" with `entity_id = NULL`, breaking viewing deep links.

**Fix:** `supabase/migrations/20260715190000_fix_geo_backfill_santa_elena.sql` re-applies the full CRM matrix from `20260714180000`, preserving `geographic_update_v1` **and** all viewing branches with `entity_type := 'viewing'` and `entity_id := v_viewing_id`.

**Regression tests:** `notificationCopyRegistry.test.js` (entityId + href for declined/rescheduled), `geoSantaElenaFixMigration.test.js` (SQL content assertions).

### 3b. District-blind Santa Elena / missing Corozal San Pedro

**Problem:** `backfill_listing_geography_v1()` and `legacyGeoBackfill.js` routed any `subregion_slug = 'santa-elena'` to Cayo. JS also lacked Corozal `san-pedro`.

**Fix:**

- SQL: district-scoped `ELSIF` branches for Toledo vs Cayo Santa Elena (mirrors existing `san-pedro` + Corozal pattern).
- JS: `mapLegacyListingToGeography()` — explicit `corozal`+`san-pedro` and `toledo`/`cayo`+`santa-elena` branches; blind slug map no longer includes ambiguous slugs.

**Regression tests:** `legacyGeoBackfill.test.js`, `geoSantaElenaFixMigration.test.js`.

---

## 4. Legacy cleanup

| Item | Action |
|------|--------|
| `docs/geography/belize-v1-location-seed.preview.json` | Removed (superseded by v3) |
| `docs/geography/belize-v1-location-seed.preview.v2.json` | Removed |
| `docs/geography/belize-v1-location-seed.preview.v2.md` | Removed |
| `src/components/inquiry/AgentInboxPanel.jsx` | Removed (orphan; CSS module retained for `UserInboxPanel`) |
| `src/components/listing/ListingViewingModal.jsx` + `.module.css` | Removed (zero imports) |
| `react-router-dom` in `package.json` | Removed (zero `src/` imports; Pages Router only) |
| `resolveGeographicUpdateListingsHref(role)` | Consolidated to `src/lib/geography/resolveGeographicUpdateListingsHref.js`; re-exported from `geographicUpdateLaunch.js` and `dashboardCrmRoutes.js` |
| `src/pages/listings/district/[district].jsx` header | Uses `formatListingLocation()` on sample listing + `getMapRegionLabel()` fallback — matches card granular location |

**Not touched:** `geographyLayer.js`, `PLATFORM_GEOGRAPHY`, `belizeGeographyV1.js` normalize dependency, `BelizeMap.jsx`, `agents.jsx` flat model usage.

---

## 5. Button / action QA (post-restyle)

Verified via automated suite + code-path review (handlers unchanged; restyle is CSS/className only):

| Control | Role / surface | Handler path | Focus-visible |
|---------|----------------|--------------|---------------|
| Dashboard tab buttons | All dashboards | `DashboardTabNav` → `onSelect(tab.id)` → router `?tab=` | `DashboardTabNav.module.css` `:focus-visible` ring |
| Edit / Archive / Mark Sold | User My Listings | Existing panel mutation handlers | `Dashboard.module.css` button `:focus-visible` |
| Approve / Reject | Admin Pending | `buildModerationApprovePatch` / `buildModerationRejectPatch` | Standard dashboard button tokens inside `.dataSurface` |
| Confirm / Decline / Reply / Send | Inbox / Viewings | CRM mutation modules (`conversationMutations`, `viewingMutations`) | Unchanged event bindings |
| Admin sidebar CTAs | Admin | `router.push` + `setActiveTab` on premium-wrapped buttons | Neon outline on `:focus-visible` via `.adminPrimaryAction` |
| Lamp-hover trigger | Admin | CSS-only `.lampTarget:hover` — no handler change | `:focus-within` inherits lamp glow |
| Admin nav items | Admin | Same `DashboardTabNav` + `adminTabNeonActive` when active | Tab `role="tab"` + `aria-selected` preserved |
| Homepage splash skip | Home | `onClick` / Escape → `markHomeSplashSeenThisSession` + focus `#home-main-content` | Decorative (`aria-hidden`); not in tab order |

**Keyboard:** Tab order skips splash (presentation only). After dismiss, focus lands on `<main id="home-main-content">`. Dashboard tablists remain roving-tab compatible via native `<button role="tab">` elements.

---

## 6. Migrations to apply

After prior CRM/geography migrations:

| # | Migration | Purpose |
|---|-----------|---------|
| 1 | `20260715190000_fix_geo_backfill_santa_elena.sql` | Santa Elena district fix + notification matrix restore |

```bash
node scripts/apply-supabase-migrations.mjs
```

---

## 7. Test / build gate

```bash
npm test
npm run build
```

Expected: all Jest suites green including new `homeSessionSplash`, `legacyGeoBackfill` district tests, `resolveGeographicUpdateListingsHref`, `geoSantaElenaFixMigration`, and extended `notificationCopyRegistry` viewing entity_id cases. Production build completes without regression on user/agent/broker/admin dashboard routes.

---

*Last updated: 2026-07-15*
