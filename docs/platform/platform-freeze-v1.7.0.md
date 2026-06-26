# Platform Freeze Report — v1.7.0

**Tag:** `v1.7.0-platform-freeze`  
**Baseline:** Marketplace Security v1.6.7 (`972e2f2` / `v1.6.7-marketplace-security`)  
**Date:** June 26, 2026  
**Phase:** 3 Final — Platform Stabilization & Production Readiness

---

## Executive summary

BelizeListings Phase 3 marketplace infrastructure is **feature-complete for v1.7.0**: property timeline foundation, CRM, staged activation, notification delivery, and security hardening (3.7) ship behind feature flags with migrations, tests, and ops docs. This release adds **no new platform features** — only cleanup, documentation, safe performance optimizations, and targeted accessibility fixes.

**Recommendation:** **Private Beta** — ready for invited agents/brokers with staged flag rollout and ops monitoring. Public Beta requires Turnstile enabled for guest leads and email delivery provider wired. Full Production Ready requires Activity Engine (3.5), SEO milestone (3.8), and transactional email.

---

## Platform maturity

| Area | Score | Notes |
|------|-------|-------|
| Public discovery | ✅ Stable | Homepage, search, ListingCard, listing detail frozen since v1.4.0 |
| Trust & verification | ✅ Stable | Admin workflow + card badges production-grade |
| Marketplace CRM | 🟡 Flag-gated | RPC + inbox v2; requires migration + staged flags |
| Notifications | 🟡 Flag-gated | In-app durable inbox + cron; email channel skipped when `RESEND_API_KEY` unset |
| Security | 🟡 Partial | DB rate limits always on; Turnstile path optional via flag |
| Ops visibility | ✅ Good | `/admin/marketplace-health` aggregates CRM + security metrics |

---

## Architecture summary

```
Browser (frozen surfaces)
  → Supabase client (RLS) + feature flags (build-time inlined)
  → Next.js API routes (inquiry create, cron, admin health)
  → SECURITY DEFINER RPCs (CRM, events, notifications)
  → Postgres + Realtime
```

| Module | Path | Role |
|--------|------|------|
| Feature flags | `src/lib/featureFlags.js` | Static `NEXT_PUBLIC_*` inlining |
| Listing events | `src/lib/listingEvents/` | Append-only timeline writer |
| CRM | `src/lib/crm/` | Inquiries, conversations, viewings |
| CRM compat | `src/lib/crm/crmCompat.js` | Shared `isCrmUnavailable`, `coerceListingIdForDb` |
| Notifications | `src/lib/notifications/` | Enqueue, deliver, fetch, copy registry |
| Security | `src/lib/security/` | Turnstile, rate-limit error map, audit log |
| Contracts | `src/lib/listingWriteContract.js` | Listing mutation allowlist |

**Consolidation (v1.7.0):** No duplicate error mappers found — `mapInquiryRpcError` is the single RPC→HTTP mapper for inquiry API. `crmCompat` remains the shared CRM availability helper (used by CRM + notifications). No behavior changes.

---

## Files removed

Confirmed unused via repo grep (no doc, test, or import references):

| File | Reason |
|------|--------|
| `scripts/debug-drawer-dom.mjs` | One-off drawer DOM debug |
| `scripts/debug-drawer-parent.mjs` | One-off drawer debug |
| `scripts/repro-drawer-aggressive.mjs` | Account drawer repro |
| `scripts/repro-drawer-admin.mjs` | Account drawer repro |
| `scripts/repro-account-drawer-crash.mjs` | Account drawer repro |
| `scripts/repro-account-drawer-mock-auth.mjs` | Account drawer repro |
| `scripts/investigate-timeline-production.mjs` | Timeline investigation one-off |
| `scripts/verify-account-drawer-fix.mjs` | Drawer fix verification one-off |
| `scripts/verify-account-drawer.mjs` | Drawer verification one-off |
| `scripts/verify-mobile-redesign.mjs` | Mobile redesign one-off |
| `scripts/capture-mobile-final-screenshots.mjs` | Polish screenshot one-off |
| `scripts/capture-mobile-fix-screenshots.mjs` | Fix screenshot one-off |
| `scripts/capture-master-polish-screenshots.mjs` | Polish screenshot one-off |
| `scripts/inspect-db-schema.mjs` | Schema dump one-off |
| `scripts/get-supabase-ref.mjs` | Unused helper |
| `scripts/capture-timeline-console.mjs` | Untracked timeline audit |
| `scripts/timeline-fetch-direct.mjs` | Untracked timeline audit |
| `scripts/timeline-layer-audit.mjs` | Untracked timeline audit |
| `scripts/timeline-service-role-audit.mjs` | Untracked timeline audit |

**Retained scripts:** All `scripts/qa/*`, verification/audit scripts referenced in milestone docs (`verify-crm-activation`, `validate-marketplace-workflow`, `audit-*`, `repair-crm-integrity`, `backfill-listing-events`, `apply-supabase-migrations`, `check-flag-inlining`).

---

## Files consolidated / optimized

| Change | File | Notes |
|--------|------|-------|
| Dynamic modal imports | `ListingContactActions.jsx` | Contact, message, viewing modals loaded on demand (`ssr: false`) |
| `aria-selected` on inbox rows | `AgentInboxPanel.jsx` | Conversation list selection |
| `aria-busy` on notification panel | `NotificationCenter.jsx` | Loading state exposure |
| Static flag inlining test | `featureFlags.test.js` | Regression guard for build-time env |

---

## Health assessments

### Repository — ✅ Good

19 one-off scripts removed. QA and milestone verification scripts preserved. No secrets in tracked files.

### Architecture — ✅ Good

Clear module boundaries; feature flags centralized; CRM compat shared. Activity Engine (3.5) still deferred — agent feed uses legacy derivation when events flag off.

### Security — 🟡 See v1.6.7 doc

Reference: [marketplace-security-v1.6.7.md](./marketplace-security-v1.6.7.md)

- DB rate limits in RPC: **mitigated**
- Notification RPC grants hardened: **fixed**
- Cron fail-closed without `CRON_SECRET`: **fixed**
- Direct anon RPC when Turnstile flag off: **partial** — enable Turnstile before Public Beta

### Performance — ✅ Acceptable

- Listing detail modals dynamically imported (Turnstile bundle deferred until modal open)
- No risky useMemo/useCallback additions
- Lighthouse QA optional in `npm run qa`

### Accessibility — 🟡 Improved, not audited

| Surface | Status |
|---------|--------|
| ContactAgentModal | ✅ `role="dialog"`, labelled title, close button |
| ListingMessageModal | ✅ dialog + labelled title + honeypot hidden |
| ListingViewingBookingModal | ✅ dialog + calendar aria |
| NotificationCenter | ✅ trigger labels; panel `aria-busy` added v1.7.0 |
| AgentInboxPanel | ✅ group nav labels; `aria-selected` added v1.7.0 |

Focus trap not added to modals (existing Escape + backdrop pattern preserved — no behavioral change).

### Documentation — ✅ Good

Platform index, production checklist, freeze report, milestone cross-links. README updated with platform overview.

### Responsive — ✅ Documented (no regressions fixed)

| Surface | Mobile | Desktop | Notes |
|---------|--------|---------|-------|
| Homepage | ✅ Frozen | ✅ Frozen | v1.0 |
| Listing detail | ✅ Frozen | ✅ Frozen | 2.3B sticky bar |
| ListingCard | ✅ Frozen | ✅ Frozen | DNA locked |
| Agent inbox | ✅ Usable | ✅ Split pane | QA pass expected |
| Marketplace health | ✅ Scroll | ✅ Cards | Admin only |

---

## Error handling

- **`POST /api/inquiries/create`** — uses `mapInquiryRpcError` for 429/404/400 mapping
- **`submitListingInquiry`** — guest secure API when Turnstile flag on; toast messages for rate limits and missing table
- **CRM mutations** — `isCrmUnavailable` graceful fallback when migration not applied
- **Agent inbox** — reply errors surfaced via toast

No behavioral changes in v1.7.0.

---

## Technical debt

| Item | Priority | Milestone |
|------|----------|-----------|
| Activity Engine replaces `deriveAgentActivityFeed` | High | 3.5 |
| Email delivery (`RESEND_API_KEY` + edge function) | High | 3.6+ |
| Broker pipeline board | Medium | 3.8 |
| SEO / structured data | Medium | Phase 4 / 3.8 |
| Focus trap in modals | Low | Post-freeze UX |
| Direct anon RPC when Turnstile off | Medium | Enable flag in prod |

---

## Known limitations

- Viewing booking preview mode when `BL_ENABLE_VIEWING_PERSIST` off (no DB write)
- Notification email channel skipped without provider key
- Guest leads without Turnstile flag use direct RPC (DB limits only)
- Timeline public panel requires `BL_ENABLE_LISTING_EVENTS` + backfill for historical data

---

## Future milestones (Phase 4 preview)

| ID | Scope |
|----|-------|
| **3.5** | Activity Engine — unified agent feed |
| **3.8** | SEO, broker pipeline, buyer tracker |
| **4.x** | Public beta hardening, transactional email at scale |

---

## Production checklist

See [production-readiness-checklist.md](./production-readiness-checklist.md) for migrations, env vars, Netlify/Supabase steps, RPC grants, and verification scripts.

---

## Release gates (v1.7.0)

| Command | Required |
|---------|----------|
| `npm test` | ✅ Pass |
| `npm run build` | ✅ Pass |
| `npm run qa` | ✅ Pass (lighthouse optional) |

---

## Recommendation justification

| Tier | Fit |
|------|-----|
| **Private Beta** | ✅ **Recommended now** — core discovery frozen; marketplace infra flag-gated; ops dashboard + audit scripts; security baseline with optional Turnstile |
| **Public Beta** | Requires Turnstile on, cron scheduled, Stages 1–4 flags enabled in prod, 2+ weeks ops monitoring |
| **Production Ready** | Requires email delivery, Activity Engine, SEO 3.8, penetration review of RPC surface |

---

## Related docs

- [README.md](../../README.md)
- [CHANGELOG.md](../../CHANGELOG.md)
- [phase-3-program.md](./phase-3-program.md)
- [production-readiness-checklist.md](./production-readiness-checklist.md)
- [marketplace-security-v1.6.7.md](./marketplace-security-v1.6.7.md)
