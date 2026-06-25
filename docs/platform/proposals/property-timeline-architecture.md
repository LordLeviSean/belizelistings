# Property Timeline — Architecture Proposal

**Phase:** Marketplace Infrastructure (Planning Sprint)  
**Status:** Proposal only — **no UI, migrations, or API implementation**  
**Baseline:** Platform Foundation Complete v1.4.0 (`57e41ad`)  
**Related:** [milestone-platform-foundation-complete.md](../milestone-platform-foundation-complete.md), [admin-operations.md](../../admin-operations.md), [sprint-2.3.md](../../listing-detail/sprint-2.3.md)

---

## 1. Problem Statement

Buyers and agents need a **trustworthy history** of listing activity: when a property was listed, verified, repriced, updated, or closed. Today BelizeListings infers activity from **mutable row timestamps** and heuristics — there is no append-only audit trail, no price history, and no admin-visible mutation log.

Sprint 2.3 documented a **Listing Trust Panel** (market status, price history, verification timeline) as a P2 extension point. This proposal defines the data and API foundation for that panel and for operator tooling.

---

## 2. Current Code Audit

### 2.1 What exists today

| Layer | Location | Behavior |
|-------|----------|----------|
| **Lifecycle constants** | `src/constants/operationalModel.js` | `LISTING_LIFECYCLE`: draft, pending, approved/published, rented, sold, archived, rejected, expired |
| **Timestamp extraction** | `src/utils/listingOperationalMeta.js` | `getLifecycleTimestamps()` reads `created_at`, `updated_at`, `published_at`, `verified_at`, `rented_at`, `sold_at`, `archived_at`, `reviewed_at` from listing row |
| **Activity heuristics** | `src/utils/trustSignals.js` | `getListingActivitySignals()` — time-window chips (recently added, updated today, newly approved, recently verified, recently sold/rented, fresh inventory) |
| **Public trust UI** | `src/components/listing/ListingTrustStrip.jsx` | Sea-glass **Verified Listing** badge + status chips from `buildPublicListingTrustChips()` |
| **Verification helpers** | `src/utils/listingVerification.js` | Card badge from `verification_status`; `getListingVerificationTrustCopy()` for future “Verified by BelizeListings” copy |
| **Admin verification** | `src/lib/listingVerificationMutations.js`, `AdminListingTrustAction.jsx` | PATCH `verification_status`, `verified_at`, `verified_by` only |
| **Trust model** | `src/constants/trustModel.js` | `ACTIVITY_SIGNAL_TYPES`, `VERIFICATION_STATUS`, visibility scopes (internal vs public) |
| **Derived agent feed** | `src/utils/listingIntel.js` | `deriveAgentActivityFeed()` synthesizes lifecycle events from listing rows — **not persisted** |
| **Schema allowlist** | `src/constants/listingsSchemaAllowlist.js` | Lifecycle + verification columns allowed on PATCH; no event table |
| **Audit script** | `scripts/audit-listing-verification.mjs` | Point-in-time verification_status report — not historical |

### 2.2 Database state

**Migrations applied (verification):**

- `20260625120000_listing_verification_status.sql` — column, owner-role backfill, insert trigger
- `20260625130000_listing_verification_metadata.sql` — `verified_at`, `verified_by` → `profiles.id`

**No dedicated event/audit tables** in `supabase/migrations/` or root SQL scripts. Grep confirms zero references to `listing_events`, `audit_log`, or `activity_log` in application code.

### 2.3 Gaps

| Gap | Impact |
|-----|--------|
| `updated_at` changes on **any** field edit | Cannot distinguish price change vs typo fix vs photo reorder |
| No price history | Cannot show “Price reduced” with prior value |
| Verification revoke loses narrative | `verified_at`/`verified_by` nulled on unverify — no record of prior stamp |
| Admin actions invisible | Approve, archive, sold — only final row state |
| Client-derived feeds | Agent activity feed recomputed; inconsistent across sessions |
| Sprint 2.3 P2 deferred | Trust panel documented but not built |

---

## 3. Architecture Proposal

### 3.1 Recommended pattern: append-only `listing_events`

**Decision:** Use an **append-only event log** (event sourcing *lite*) — not full CQRS. The `listings` row remains the **materialized current state**; `listing_events` is the **immutable history**.

Rationale:

- Unlimited event types via `event_type` text + JSON `payload` — no schema rewrite per new event
- Public timeline filters on `visibility = 'public'`
- Admin audit reads all rows including `visibility = 'internal'`
- Backfill possible from existing timestamps + one-time migration job
- Aligns with existing admin mutation pattern (write listing + append event in same transaction)

**Alternative rejected:** Postgres audit trigger only — harder to shape public-facing copy and price deltas without application context.

### 3.2 Event taxonomy (initial)

| `event_type` | Public? | Trigger source | Notes |
|--------------|---------|----------------|-------|
| `listing.created` | internal | Insert listing | Draft creation |
| `listing.published` | public | Admin approve / publish | Maps to `published_at` |
| `listing.verification.approved` | public | `applyListingVerificationAction(verified=true)` | Include `verified_by` in payload |
| `listing.verification.removed` | internal | Unverify confirm | Do not expose admin id publicly |
| `listing.price.reduced` | public | Price PATCH when new < old | Payload: `{ from, to, currency }` |
| `listing.price.increased` | public | Price PATCH when new > old | Optional public — product decision |
| `listing.photos.updated` | public | Image count/hero change | Payload: `{ photo_count, cover_changed }` |
| `listing.description.updated` | internal | Description PATCH | Public chip only: “Recently updated” |
| `listing.status.changed` | varies | Lifecycle transition | Payload: `{ from_status, to_status }` |
| `listing.archived` | public | Archive action | |
| `listing.republished` | public | Resubmit from archived | |
| `listing.sold` | public | Mark sold | Payload: optional closing verification |
| `listing.rented` | public | Mark rented | |
| `listing.under_contract` | public | Future lifecycle value | Requires lifecycle enum extension |
| `listing.moderation.approved` | internal | Admin approve | Distinct from publish if needed |
| `listing.moderation.rejected` | internal | Admin reject | |
| `*` future | configurable | Registry | JSON payload carries domain fields |

**Future events:** Register new types in `src/constants/listingEventTypes.js` (proposed) without ALTER TABLE — only CHECK constraint optional for documentation.

### 3.3 Proposed table schema

```sql
create table public.listing_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  event_type text not null,
  visibility text not null default 'public'
    check (visibility in ('public', 'internal')),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'app'
    check (source in ('app', 'admin', 'system', 'migration_backfill')),
  correlation_id uuid,
  created_at timestamptz not null default now()
);

create index listing_events_listing_occurred_idx
  on public.listing_events (listing_id, occurred_at desc);

create index listing_events_type_idx
  on public.listing_events (event_type);

comment on table public.listing_events is
  'Append-only listing activity log. Current state remains on listings row.';
```

**Payload conventions (JSONB):**

```json
{
  "from": { "price": 450000, "currency": "USD" },
  "to": { "price": 425000, "currency": "USD" },
  "delta_pct": -5.56,
  "verification_status": "verified",
  "verified_by": "uuid",
  "photo_count": 12,
  "lifecycle_status": "approved",
  "note": "optional human-readable summary"
}
```

**Idempotency:** `correlation_id` links listing PATCH + event insert; retries skip duplicate `(listing_id, correlation_id)`.

### 3.4 Integration with verification columns

| Current column | Timeline role |
|----------------|---------------|
| `verification_status` | Materialized current badge state |
| `verified_at` | Latest verification stamp — mirror of newest `listing.verification.approved` event |
| `verified_by` | Latest admin — **internal payload only** on public timeline |

**On verify:** Transaction: (1) PATCH listing via existing `applyListingVerificationAction`, (2) INSERT `listing.verification.approved` with `{ verified_by, verified_at }`.

**On unverify:** (1) PATCH clears metadata, (2) INSERT `listing.verification.removed` with `{ previous_verified_at, previous_verified_by }` as **internal** visibility.

Public timeline shows: “Verified by BelizeListings” when current status verified; historical “Verified on {date}” from last approved event even if later revoked (product choice — recommend showing current state only).

### 3.5 Write path architecture

```
┌─────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│ UI / Admin      │────▶│ listing*Mutations.js     │────▶│ Supabase        │
│ Dashboard       │     │ + listingEventWriter.js  │     │ listings PATCH  │
└─────────────────┘     │   (new module)           │     │ listing_events  │
                        └──────────────────────────┘     │ INSERT (RPC)    │
                                                         └─────────────────┘
```

**Recommended:** Postgres RPC `append_listing_event(...)` SECURITY DEFINER called from mutation modules — ensures event insert cannot be bypassed by client-only PATCH.

Extend allowlist pattern:

- `listingVerificationMutations.js` → call event writer after successful verify/unverify
- Future `listingLifecycleMutations.js` → publish, archive, sold, rented
- `listingPersistence.js` / price updates → detect price delta, emit price events

### 3.6 Read path / rendering strategy

#### Public trust layer (listing detail)

Evolve **`ListingTrustStrip`** — do not replace Sprint 2.3 frozen layout:

1. **Keep** verified badge + current status chips (backward compatible)
2. **Add** collapsible **“Listing activity”** panel below trust strip (Sprint 2.3 P2)
   - Show last 3–5 **public** events
   - Calm luxury: vertical timeline, sea-glass dots, no dense tables
   - Copy examples: “Listed 12 Jun 2026”, “Price reduced to $425,000”, “Verified by BelizeListings”

New hook: `useListingPublicTimeline(listingId)` — fetches public events, merges with `getListingVerificationTrustCopy()` for headline.

#### Admin audit

- **AllListingsPanel** row expand → full event list (internal + public)
- Filter by `event_type`, date range
- Reuse `AdminListingActionConfirmModal` pattern for destructive actions that should emit events

#### Agent dashboard

- Replace derived-only `deriveAgentActivityFeed()` with query against `listing_events` for owned listings
- Fall back to derived feed when table missing (compat layer like inquiries)

### 3.7 API plan (Supabase RLS)

| Role | SELECT | INSERT |
|------|--------|--------|
| **anon** | `visibility = 'public'` AND listing is publicly visible (approved lifecycle) | ❌ |
| **authenticated buyer** | Same as anon | ❌ |
| **listing owner** | Public events on own listings + internal for own listings | ❌ (via RPC only) |
| **admin** | All events | Via RPC / service role |

**Policies (sketch):**

```sql
-- Public read
create policy listing_events_select_public
  on public.listing_events for select to anon, authenticated
  using (
    visibility = 'public'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and coalesce(l.status, '') in ('approved', 'published')
    )
  );

-- Owner read (includes internal)
create policy listing_events_select_owner
  on public.listing_events for select to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.user_id = auth.uid()
    )
  );

-- Admin read all (via is_admin())
-- Insert: revoke direct INSERT from clients; grant EXECUTE on append_listing_event RPC
```

**Realtime:** Optional `listing_events` subscription for agent dashboard — low priority vs pull on tab focus.

---

## 4. Migration Plan

### Phase A — Schema (no UI)

1. Add migration `202606XX_listing_events.sql` to `supabase/migrations/`
2. Create table, indexes, RLS, `append_listing_event` RPC
3. Add `src/constants/listingEventTypes.js` + `src/lib/listingEventWriter.js`
4. Feature flag `BL_ENABLE_LISTING_EVENTS` (default false)

### Phase B — Emit on new mutations only

1. Wire `listingVerificationMutations.js` → event writer
2. Wire admin approve/archive/sold paths
3. Wire price change detection in listing update flow

### Phase C — Backfill

1. Script `scripts/backfill-listing-events.mjs`:
   - `created_at` → `listing.created`
   - `published_at` → `listing.published`
   - `verified_at` (if status verified) → `listing.verification.approved`
   - `sold_at` / `rented_at` / `archived_at` → respective events
2. Mark `source = 'migration_backfill'`
3. Run audit: compare event count vs listing count

### Phase D — Public UI

1. `ListingTimelinePanel` component (new)
2. Integrate below `ListingTrustStrip` on detail page
3. QA: mobile 390px, verified + price reduced scenarios

---

## 5. Design Language Integration

| Principle | Timeline application |
|-----------|---------------------|
| **Calm luxury** | Vertical timeline with generous whitespace; no red “alert” styling for price increases |
| **Sea-glass verification** | Verification events use existing verified badge palette from `ListingTrustStrip.module.css` |
| **Editorial hierarchy** | Event headline + muted timestamp; payload details collapsed |
| **Reduction over addition** | Max 5 public events above fold; “View full history” deferred |
| **Trust strip evolution** | Badge = current state; timeline = narrative — do not duplicate “Recently verified” chip if timeline shows same |

Reuse tokens: `--dur-*`, `--ease-*`, `--elev-*` from `tokens.css`. No new gradients.

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Schema drift** — migrations folder vs production | RPC + feature flag; compat fallback like inquiries |
| **Event spam** on autosave | Debounce description events; batch photo uploads into one event |
| **PII in payload** | Never store buyer email in listing events; admin ids internal-only |
| **Backfill inaccuracy** | Label backfill events; do not infer price history without data |
| **RLS leaks draft listings** | Public policy joins approved listing check |
| **Dual-write failure** | RPC transaction: PATCH + INSERT atomic |
| **Performance** | Index `(listing_id, occurred_at desc)`; paginate public timeline |

---

## 7. What Is NOT in Scope (This Proposal)

- UI components or CSS modules
- Supabase migration files in repo
- Price chart / market analytics
- Buyer-facing “under contract” unless lifecycle enum extended first
- Email notifications on price drop

---

## 8. Open Product Questions

1. Show price **increases** on public timeline or only reductions?
2. Display verification history after admin revoke?
3. How many public events before “Show more”?
4. Should `listing.description.updated` ever surface as public “Recently updated” or only via existing chip heuristic?

---

## 9. File Touch List (Future Implementation)

| File | Change |
|------|--------|
| `supabase/migrations/202606XX_listing_events.sql` | New |
| `src/lib/listingEventWriter.js` | New |
| `src/constants/listingEventTypes.js` | New |
| `src/lib/listingVerificationMutations.js` | Emit events |
| `src/lib/listingWriteContract.js` | Price delta detection |
| `src/components/listing/ListingTimelinePanel.jsx` | New UI |
| `src/components/listing/ListingTrustStrip.jsx` | Slot timeline below |
| `docs/listing-detail/sprint-2.3.md` | Mark P2 implemented |
| `scripts/backfill-listing-events.mjs` | Backfill |
