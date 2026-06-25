# Phase 3 — Marketplace Infrastructure Program

**Baseline:** Platform Foundation v1.4.0 (`v1.4.0-platform-foundation`, commit `36f2302`)  
**Current milestone:** 3.1 — Property Timeline Foundation (`v1.5.0-timeline-foundation`)  
**Parent doc:** [marketplace-infrastructure-phase.md](./marketplace-infrastructure-phase.md)

---

## Executive Summary

Phase 3 adds marketplace infrastructure — trust history, lead conversion, activity feeds, and notifications — while preserving frozen public surfaces (Homepage, Discovery, ListingCard, Listing Detail 2.3A/B). Work proceeds in **deployable milestones** with feature flags, migrations, tests, and annotated tags.

---

## Workstreams

| ID | Workstream | Scope | Primary doc |
|----|------------|-------|-------------|
| **A** | **Property Timeline** | Append-only `listing_events`, event writer, public trust timeline, admin audit | [property-timeline-architecture.md](./proposals/property-timeline-architecture.md) |
| **B** | **Inquiry & Lead Management (CRM)** | `listing_inquiries` migration, conversations, messages, viewing_requests, pipeline | [inquiry-lead-management-architecture.md](./proposals/inquiry-lead-management-architecture.md) |
| **C** | **Activity Engine** | Unified read model merging listing events, inquiries, and dashboard signals | [activity-engine-architecture.md](./proposals/activity-engine-architecture.md) |
| **D** | **Notification Framework** | In-app, email, and future push delivery on domain events | [notification-framework-architecture.md](./proposals/notification-framework-architecture.md) |
| **E** | **Viewing & Conversion Persist** | Wire `ListingViewingBookingModal` to DB; agent notified on new leads | CRM + Workstream D |
| **F** | **Broker & Buyer Surfaces** | Pipeline board, buyer inquiry tracker, broker scope when `brokerage_id` exists | CRM + Activity Engine |

---

## Milestone Breakdown

```
3.1  Timeline foundation (schema + writer + verify/lifecycle emit)     ← THIS RELEASE
3.1B Public ListingTimelinePanel (optional fast-follow)
3.2  CRM Layer 1 — listing_inquiries official migration + pipeline_stage
3.3  Viewing persist (viewing_requests + booking modal)
3.4  Conversations + messages + LeadInboxPanel v2
3.5  Activity Engine implementation (replace deriveAgentActivityFeed)
3.6  Notification framework MVP (in-app + email edge function)
3.7  Price/lifecycle event emit on listingWriteContract paths
3.8  Broker pipeline board + buyer dashboard tracker
```

### Dependencies

| Milestone | Depends on | Ships independently? |
|-----------|------------|----------------------|
| **3.1** | Platform Foundation v1.4.0 | ✅ |
| **3.1B** | 3.1 + backfill (recommended) | Needs 3.1 |
| **3.2** | None (parallel with 3.1) | ✅ |
| **3.3** | 3.2 (conversation id optional) | Needs 3.2 |
| **3.4** | 3.2 | Needs 3.2 |
| **3.5** | 3.1 events + 3.2 leads | Needs 3.1, 3.2 |
| **3.6** | 3.2 create-lead RPC stable | Needs 3.2+ |
| **3.7** | 3.1 event writer | Needs 3.1 |
| **3.8** | 3.4 + profile brokerage scope | Needs 3.4 |

**Parallel track:** Workstreams A (3.1) and B (3.2) share no tables — may run simultaneously.

---

## Milestone 3.1 Deliverables (v1.5.0)

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | `supabase/migrations/20260626120000_listing_events.sql` | ✅ |
| 2 | `src/lib/listingEvents/` — types, payload builders, `writeListingEvent` | ✅ |
| 3 | RPC `append_listing_event` + `apply_listing_verification_with_event` | ✅ |
| 4 | Wire `listingVerificationMutations.js` + `applyListingLifecycleAction` | ✅ |
| 5 | Feature flag `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS` | ✅ |
| 6 | `scripts/backfill-listing-events.mjs` | ✅ |
| 7 | Unit tests (types, writer, verification emit) | ✅ |
| 8 | Design docs: Activity Engine (C), Notifications (D) | ✅ |
| 9 | `ListingTimelinePanel` public UI | ⏸ Deferred → 3.1B / 3.2 |

---

## Delivery Model

Each milestone must:

1. **Migrate** — SQL in `supabase/migrations/` with rollback notes
2. **Implement** — single source of truth modules; no duplicated event logic
3. **Test** — `npm test` + targeted unit tests for new modules
4. **Build** — `npm run build` green
5. **QA** — `npm run qa` (or scoped QA when full suite blocked)
6. **Document** — CHANGELOG entry + milestone section in this file
7. **Tag** — annotated semver tag (`v1.5.0-timeline-foundation`)
8. **Flag** — default-off env flag until migration applied in target environment

---

## Feature Flags

| Flag | Default | Milestone |
|------|---------|-----------|
| `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS` | false | 3.1 |
| `NEXT_PUBLIC_BL_ENABLE_INQUIRIES` | false | existing / 3.2 |
| `NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST` | false | 3.3 |
| `NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS` | false | 3.4 |

---

## Frozen Surface Compliance

- **ListingTrustStrip** — timeline composes *beneath* (Milestone 3.1B+); no layout changes in 3.1
- **ListingContactActions** — CRM evolves internals only (Workstream B+)
- **Admin mutations** — extend `*Mutations.js` + event writer; follow [admin-operations.md](../admin-operations.md)

---

## Integration Points (Workstreams B–F)

| Consumer | Reads from | Writes via |
|----------|------------|------------|
| **CRM deal closed** | `listing_events` public timeline | `writeListingEvent` on sold/rented |
| **Activity Engine** | `listing_events` + `listing_inquiries` + messages | Read-only aggregation |
| **Notifications** | Domain events (RPC insert hooks / edge functions) | Subscribes to lead + listing event types |
| **Agent dashboard** | Replace `deriveAgentActivityFeed()` with events query | 3.5 |
| **Public detail** | `useListingPublicTimeline` hook | 3.1B |

---

## Related

- [CHANGELOG.md](../../CHANGELOG.md)
- [milestone-platform-foundation-complete.md](./milestone-platform-foundation-complete.md)
- [property-timeline-architecture.md](./proposals/property-timeline-architecture.md)
