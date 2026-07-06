# BelizeListings Mobile UX Version Log

| Field | Value |
| --- | --- |
| **Date** | July 6, 2026 |
| **Branch** | `main` |
| **Baseline commit** | `c4211a3` (Apply final mobile UX micro-polish refinements) |
| **Audit commit** | `53f5302` |
| **Scope** | Final mobile scroll quality + loading states (no redesign, no new features) |

---

## Summary of mobile UI state

Mobile surfaces (≤800px) use **document scroll** on homepage and district (`home-map-page-root`), **safe-area-aware** padding on footers/modals/sticky CTAs, and **glass skeleton loaders** aligned with existing card dimensions. Interaction modals (Contact Agent, Schedule Viewing, Message, Home Advanced Filters) lock body scroll with scrollbar-gap compensation and `overscroll-behavior: none` to prevent iOS scroll bleed. Listing detail retains Sprint 2.3 sticky contact bar with footer IntersectionObserver clearance.

---

## Major mobile systems verified

- **Navigation:** SiteNav mobile drawer scroll lock (`site-nav-drawer-open`), sea-glass sheet with `overscroll-behavior: contain`
- **Homepage:** Map-first hero (`100dvh` map pane), document overscroll guard, featured/recent listing rails
- **Search:** FilterBar sticky offset + safe-area top; skeleton grid during fetch
- **District:** Collapsible filter panel, listing grid skeletons, safe-area bottom padding
- **Listing detail:** Gallery thumb strip momentum scroll, fullscreen lightbox scroll lock, sticky contact CTA + spacer
- **Favorites / Dashboard / Messages / Notifications:** Existing hydrating panels and inbox skeletons (unchanged baseline)
- **Auth:** Login/register submission disabled + label states; session hydration loader
- **Modals:** Unified `ListingInteractionModal` shell + Home Advanced Filters overlay

---

## Scroll fixes completed

- Modal body scroll lock: `overscroll-behavior: none` + scrollbar gap on **ListingInteractionModal**, **HomeAdvancedFiltersModal**, listing **gallery lightbox**
- Modal panel scroll containment: `overscroll-behavior: contain` on interaction modal and filter dialog scroll regions
- Listing gallery thumb strip: `overscroll-behavior-x: contain` (horizontal momentum without page rubber-band)
- Lightbox mobile safe-area padding for backdrop and close control (notch / home indicator)
- Search FilterBar sticky `top` includes `env(safe-area-inset-top)` at ≤800px
- Search, Learn More, District wrappers: bottom padding includes `env(safe-area-inset-bottom)`
- Homepage mobile page: existing `overscroll-behavior-y: none` on `.page` (Phase 2 — preserved, not duplicated)

---

## Loading fixes completed

- **Homepage:** `listingsLoading` state with featured carousel + recent grid **card skeletons** (fixed dimensions, no CLS)
- **Listing detail:** Replaced blank “Loading listing…” with hero + body **skeleton shell** matching mobile gallery height
- **District:** Router-not-ready blank screen replaced with **4-card skeleton grid** (was `return null`)
- **Login:** Primary submit button `aria-busy` while submitting (duplicate-tap guard already via `disabled`)
- **Search / Favorites / District listings:** Existing skeleton patterns confirmed (no change required)
- **Contact / Viewing / Message modals:** Submit buttons already show Sending… / disabled states (confirmed)

---

## Known limitations / deferred items

- **Global search modal:** No dedicated overlay — search routes to `/search` (by design)
- **Playwright mobile QA (`npm run qa:mobile`):** Defaults to production URL (`QA_BASE_URL`); local audit relied on `npm test` + `npm run build` + code review
- **Dashboard operator panels:** Heavy admin tables not re-audited (out of public mobile scope)
- **Map touch on homepage:** Fixed-height map pane; district drill-down via tap (no pinch map scroll)
- **iOS Safari URL bar:** `100dvh` used throughout; minor resize on bar show/hide is browser-level, mitigated via min-height not fixed page lock

---

## Test / build results

| Check | Result |
| --- | --- |
| `npm test` | **PASS** — 76 suites, 413 tests |
| `npm run build` | **PASS** — Next.js 16.0.10 production build |
| `npm run qa:mobile` | Not run against local dev (requires `QA_BASE_URL` or live deploy) |

---

## Mobile QA checklist

Use viewports **390×844** and **414×896** (iPhone 12 / XR class).

### Scroll

- [ ] Homepage: scroll past map hero without rubber-band jank; featured carousel horizontal scroll isolated
- [ ] Search: sticky FilterBar clears site nav; filter expand/collapse without layout jump
- [ ] District: filter summary ↔ panel toggle; list scroll with collapsed filters
- [ ] Listing detail: thumb strip scroll; lightbox open/close — no background scroll bleed
- [ ] Sticky contact bar hides when footer visible; content not hidden behind home indicator
- [ ] Site nav drawer: scroll inside drawer only; backdrop dismiss; body locked

### Modals

- [ ] Contact Agent — full-screen sheet on ≤640px; safe-area top/bottom; dismiss restores scroll
- [ ] Schedule Viewing — calendar scroll inside body; confirm step footer pinned
- [ ] Message agent — textarea scroll; Send disabled while sending
- [ ] Home Advanced Filters — full-screen mobile sheet; Apply navigates to search

### Loading

- [ ] Homepage: skeleton featured + recent cards before listings hydrate
- [ ] Search: 6 skeleton cards on first load
- [ ] District: skeleton grid on route load and listing fetch
- [ ] Listing detail: skeleton hero + lines (not blank screen)
- [ ] Favorites: 6-card skeleton while auth/favorites hydrate
- [ ] Login: button shows Creating account… / Signing in…; no double submit

### Safe areas

- [ ] Bottom content clears home indicator on listing detail, search, district, learn-more
- [ ] Modal footers and sticky CTAs respect `env(safe-area-inset-bottom)`
- [ ] Toast stack above safe area (ToastProvider)

---

*Maintainers: append new dated sections above this entry when shipping mobile UX changes; do not delete historical rows.*
