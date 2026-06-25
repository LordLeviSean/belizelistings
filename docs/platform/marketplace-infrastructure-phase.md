# Marketplace Infrastructure Phase

**Phase 3** — follows **Platform Foundation Complete v1.4.0**  
**Status:** Milestone 3.1 shipped (v1.5.0-timeline-foundation)  
**Program doc:** [phase-3-program.md](./phase-3-program.md)  
**Milestone doc:** [milestone-platform-foundation-complete.md](./milestone-platform-foundation-complete.md)

---

## Overview

Platform Foundation delivered frozen public discovery, listing detail, verification, admin trust ops, and discovery search. **Marketplace Infrastructure** adds the data and workflow layers required for buyer trust history and agent lead conversion — without redesigning frozen surfaces.

This phase is **documentation-first** in v1.4.0. Implementation proceeds in controlled sprints behind feature flags.

---

## Architecture Proposals

| # | Feature | Document | Summary |
|---|---------|----------|---------|
| 1 | **Property Timeline** | [property-timeline-architecture.md](./proposals/property-timeline-architecture.md) | Append-only `listing_events` table; public trust timeline + admin audit; integrates with `verification_status` / `verified_at` / `verified_by` |
| 2 | **Inquiry & Lead Management** | [inquiry-lead-management-architecture.md](./proposals/inquiry-lead-management-architecture.md) | Evolve `listing_inquiries` → conversations, messages, viewing_requests; CRM pipeline from existing contact modals |

---

## Next Phase Priorities

| Priority | Work item | Rationale |
|----------|-----------|-----------|
| **P0** | Promote `listing_inquiries` to official migration | Unblocks lead capture in production; modals already call insert |
| **P0** | `listing_events` schema + RPC | Foundation for trust panel and admin audit |
| **P1** | Emit events on verification + lifecycle mutations | Low UI risk; validates write path |
| **P1** | Persist viewing requests | `ListingViewingBookingModal` UX exists — wire backend |
| **P2** | Public `ListingTimelinePanel` | Sprint 2.3 P2 trust panel |
| **P2** | Conversation threading + agent inbox v2 | Replace single-body inquiries |
| **P3** | Buyer inquiry tracker (user dashboard) | Requires conversations |
| **P3** | Email notifications | Edge function; depends on stable lead create RPC |
| **P4** | Broker pipeline board | Blocked on `brokerage_id` profile scope |

---

## Recommended Implementation Order

### Why Timeline first (schema + emit), then CRM persist

```
┌─────────────────────────────────────────────────────────────┐
│  Sprint A: listing_events migration + event writer RPC      │
│  Sprint B: Wire verification + lifecycle mutations          │
│  Sprint C: Backfill script + audit                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Sprint D: listing_inquiries official migration             │
│  Sprint E: viewing_requests + booking modal persist           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Sprint F: Public ListingTimelinePanel (detail page)        │
│  Sprint G: conversations + messages + inbox v2              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Sprint H: Pipeline stages + deal closed → listing events   │
│  Sprint I: Notifications + buyer dashboard                   │
└─────────────────────────────────────────────────────────────┘
```

### Dependencies

| Task | Depends on | Independent? |
|------|------------|--------------|
| Event writer on verify | `listing_events` table | ✅ Can ship alone |
| Public timeline UI | Events emitted + backfill | Needs A–C |
| Inquiry migration | None | ✅ Parallel with A |
| Viewing persist | `viewing_requests` table | Needs inquiry/conversation id optionally |
| Conversations | Official inquiries | Needs D |
| Deal closed stage | CRM pipeline + listing sold/rented mutations | Needs timeline event writer |
| Broker board | Profile brokerage scope | Separate track |

**Parallel track:** Sprint A (timeline schema) and Sprint D (inquiries migration) can run **simultaneously** — no shared tables.

**CRM-first alternative rejected:** Viewing modal and message modal already insert to `listing_inquiries` when table exists; timeline adds cross-cutting trust value for all users (including non-inquiring browsers) and admin ops. Timeline emit on verification is a **small, high-value** first wire.

---

## Feature Flags (Recommended)

| Flag | Default | Enables |
|------|---------|---------|
| `BL_ENABLE_LISTING_EVENTS` | false | Event insert + read APIs |
| `BL_ENABLE_INQUIRIES` | false | Existing — inquiry fetch/count |
| `BL_ENABLE_VIEWING_PERSIST` | false | Booking modal → `viewing_requests` |
| `BL_ENABLE_CONVERSATIONS` | false | Thread UI + messages table |

---

## Frozen Surface Compliance

All Phase 3 UI must:

- Compose beneath or beside **`ListingTrustStrip`** and **`ListingContactActions`** — no layout rearchitecture
- Reuse **admin mutation module** pattern from [admin-operations.md](../admin-operations.md)
- Extend **`discoveryExtensionPoints.js`** only for search personalization — not timeline data
- Follow **BelizeListings design DNA** — calm luxury, sea-glass, editorial spacing

---

## Success Criteria (Phase 3 Complete)

| Criterion | Measure |
|-----------|---------|
| Public timeline | Approved listing shows ≥3 event types on detail page |
| Verification audit | Admin can see verify/unverify history |
| Lead capture | Site message + viewing create DB rows in staging |
| Agent inbox | Agent sees unread leads with pipeline stage |
| Zero regression | Homepage v1.0 + Listing Detail 2.3A/B QA pass |
| Build gate | `npm run build` + `npm test` green |

---

## Related

- [CHANGELOG.md](../../CHANGELOG.md) — v1.4.0 Platform Foundation Complete
- [Roadmap](../roadmap.md) — update when Phase 3 sprints begin
- [BELIZELISTINGS_ARCHITECTURE.md](../BELIZELISTINGS_ARCHITECTURE.md)
