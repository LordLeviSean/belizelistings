# Activity Engine — Architecture Proposal

**Phase:** Marketplace Infrastructure — Workstream C  
**Status:** Design only (Milestone 3.1) — **no implementation**  
**Baseline:** v1.5.0 timeline foundation  
**Related:** [property-timeline-architecture.md](./property-timeline-architecture.md), [inquiry-lead-management-architecture.md](./inquiry-lead-management-architecture.md)

---

## 1. Problem Statement

Today BelizeListings synthesizes agent activity **client-side** via `deriveAgentActivityFeed()` in `listingIntel.js` — recomputing lifecycle hints from mutable listing rows and merging inquiry rows. This is inconsistent across sessions, incomplete for admin audit, and duplicates logic that `listing_events` and CRM tables will own.

The **Activity Engine** is a unified **read model** that merges persisted domain events into one chronological feed for agent dashboard, admin ops, and (optionally) buyer-facing summaries.

---

## 2. Goals

| Goal | Measure |
|------|---------|
| Single query surface | One hook/store per dashboard role |
| Source of truth | Read from DB tables, not heuristics |
| Extensible | New event sources register without UI rewrite |
| Frozen UI compatible | `AgentActivityFeed` evolves data layer only |

---

## 3. Proposed Architecture

### 3.1 Event sources (read)

| Source | Table | Primary consumer |
|--------|-------|------------------|
| Listing timeline | `listing_events` | Agent inventory, admin AllListingsPanel expand |
| Leads | `listing_inquiries` → `conversations` | Agent inbox |
| Viewings | `viewing_requests` | Agent calendar panel |
| System | `agent_upgrade_requests`, moderation queue | Admin NotificationCenter |

### 3.2 Activity record shape (normalized)

```js
{
  id: "listing_events:uuid",
  source: "listing_events",
  occurredAt: "2026-06-26T12:00:00Z",
  entityType: "listing",
  entityId: "listing-uuid",
  activityType: "listing.verification.approved",
  visibility: "public",
  headline: "Listing verified",
  payload: { /* domain fields */ },
  actorId: "admin-uuid",
}
```

Headline/copy resolved in **`activityCopyRegistry.js`** (new) — maps `activityType` + payload → editorial strings matching calm luxury tone.

### 3.3 Read API

| Function | Scope |
|----------|-------|
| `fetchAgentActivityFeed(agentUserId, { limit, cursor })` | Owned listings' events + leads |
| `fetchAdminActivityFeed({ listingId?, filters })` | All sources including internal |
| `fetchListingActivityTimeline(listingId, { publicOnly })` | Detail page / admin expand |

Implementation: Supabase queries with union or parallel fetch + merge sort (Milestone 3.5). Prefer **server-side view** `activity_feed_v1` only if query cost exceeds client merge at scale.

### 3.4 Compatibility layer

When `BL_ENABLE_LISTING_EVENTS` is false or table missing, fall back to existing `deriveAgentActivityFeed()` — same pattern as inquiries flag.

---

## 4. UI Integration (Future)

| Surface | Change |
|---------|--------|
| `AgentActivityFeed` | Swap data source; keep card CSS |
| `AllListingsPanel` | Row expand → `ListingEventAuditList` |
| `ListingTimelinePanel` | Subset of public listing events (3.1B) |

---

## 5. Dependencies

| Milestone | Requirement |
|-----------|-------------|
| 3.1 | `listing_events` schema + writer ✅ |
| 3.2 | Official inquiries / pipeline |
| 3.5 | Activity Engine implementation |

---

## 6. Non-Goals (This Proposal)

- Realtime WebSocket subscriptions (pull on tab focus first)
- Full-text search across activity
- Buyer-global activity (buyer scope limited to own inquiries)

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| N+1 queries per feed | Batch by listing ids; index `(listing_id, occurred_at desc)` |
| Copy drift vs timeline panel | Shared `activityCopyRegistry` |
| Feed spam on autosave | Writer debounce (3.7 price/description events) |
