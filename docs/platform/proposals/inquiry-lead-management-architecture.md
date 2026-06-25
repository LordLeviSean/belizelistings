# Inquiry & Lead Management — Architecture Proposal

**Phase:** Marketplace Infrastructure (Planning Sprint)  
**Status:** Proposal only — **no UI, migrations, or CRM implementation**  
**Baseline:** Platform Foundation Complete v1.4.0 (`57e41ad`)  
**Related:** [milestone-platform-foundation-complete.md](../milestone-platform-foundation-complete.md), [property-timeline-architecture.md](./property-timeline-architecture.md)

---

## 1. Problem Statement

BelizeListings has **conversion UI** (Contact agent, Schedule viewing, site message) but **no end-to-end lead pipeline**: inquiries may not persist (table optional), viewing booking is local-only preview, and agents lack conversation threading, pipeline stages, or broker analytics.

This proposal defines a CRM-ready schema and React architecture that **evolves from existing modals** without redesigning listing detail contact chrome.

---

## 2. Current Code Audit

### 2.1 Public conversion surface

| Component | Path | Current behavior |
|-----------|------|------------------|
| **ListingContactActions** | `src/components/listing/ListingContactActions.jsx` | Primary/secondary CTAs + share; mobile sticky bar with footer IntersectionObserver clearance (2.3B) |
| **ContactAgentModal** | `src/components/listing/ContactAgentModal.jsx` | WhatsApp / mailto deep links; routes to site message |
| **ListingMessageModal** | `src/components/listing/ListingMessageModal.jsx` | Email + body form → `submitListingInquiry()` |
| **ListingViewingBookingModal** | `src/components/listing/ListingViewingBookingModal.jsx` | Full calendar UX — **preview only** (“nothing is sent yet”, local confirm) |
| **ListingViewingModal** | `src/components/listing/ListingViewingModal.jsx` | Alternate viewing form → `submitListingInquiry` with `INQUIRY_CHANNEL.VIEWING` (legacy path) |

**Auth:** `ListingMessageModal` accepts optional `user` for `sender_user_id`; guests provide email. No auth gate on contact buttons — intentional conversion funnel.

### 2.2 Agent / dashboard surfaces

| Component | Path | Behavior |
|-----------|------|----------|
| **AgentInquiryList** | `src/components/inquiry/AgentInquiryList.jsx` | Lists `listing_inquiries` rows; mark responded |
| **NotificationCenter** | `src/components/notifications/NotificationCenter.jsx` | Agent: polls new inquiries; admin: moderation + upgrade requests |
| **useAgentDashboardStore** | `src/stores/useAgentDashboardStore.js` | Fetches inquiries when `BL_ENABLE_INQUIRIES`; `unreadInquiryCount` |
| **useUserDashboardStore** | `src/stores/useUserDashboardStore.js` | User-side inquiry count (flag-gated) |
| **AgentActivityFeed** | `src/components/operational/AgentActivityFeed.jsx` | Merges inquiry rows into derived feed via `listingIntel.js` |

### 2.3 Data layer

| Module | Path | Behavior |
|--------|------|----------|
| **inquiryModel** | `src/constants/inquiryModel.js` | Channels: contact, viewing, question; Status: new, responded, scheduled, closed; `scoreInquiryBody()` spam gate |
| **listingInquiries** | `src/lib/listingInquiries.js` | `submitListingInquiry`, `fetchInquiriesForAgent`, `updateInquiryStatus`, `markInquiryRead` |
| **featureFlags** | `src/lib/featureFlags.js` | `BL_ENABLE_INQUIRIES` — default **false** when env unset |

### 2.4 Database

**Script only (not in `supabase/migrations/`):** `supabase-listing-inquiries.sql`

```sql
listing_inquiries (
  id, listing_id, agent_user_id, sender_user_id,
  sender_name, sender_email, sender_phone,
  channel, body, status, quality_score,
  read_at, created_at, updated_at
)
```

**RLS:**

- Agent SELECT/UPDATE own rows
- Sender SELECT own rows when logged in
- INSERT when listing approved and `agent_user_id` matches listing owner

**Gaps:**

| Gap | Detail |
|-----|--------|
| No `conversations` or `messages` tables | Single `body` text per inquiry — no threading |
| No `viewing_requests` table | Booking modal does not persist |
| Status enum too coarse | Missing: read, viewing confirmed, negotiation, offer, deal closed |
| No buyer dashboard | Senders cannot track inquiry status in UI |
| No notifications table | NotificationCenter polls sources ad hoc |
| No broker pipeline | No assignment, no team inbox |
| External channels untracked | WhatsApp/email opens not logged |

### 2.5 Auth flow

| Module | Role |
|--------|------|
| **UserRoleProvider** | Single auth subscription in `_app.js` |
| **useAuth** | Thin wrapper over `useUserRole` |
| **AuthGateProvider** | “Already signed in” modal for login CTAs |
| **ensureProfile** | Client profile repair post-sign-in |
| **/login** | Canonical auth path |

Inquiries work for **guests** (email required) and **authenticated** users (`sender_user_id`).

### 2.6 Grep summary — inquiry / lead / contact / viewing

- **Persisted:** `listing_inquiries` insert from `ListingMessageModal`, `ListingViewingModal`
- **Not persisted:** `ListingViewingBookingModal` (Sprint 2.3 preview)
- **Dashboard intel:** `inquiry_count` referenced in `listingDashboardSelectContract.js` — optional column, often stripped in production selects
- **Agents page:** `src/pages/agents.jsx` — live directory via `fetchAgentDirectory`, not lead-related

---

## 3. Recommended Schema

Evolve in **layers** — each layer additive, no breaking rename of `listing_inquiries`.

### 3.1 Layer 1 — Formalize `listing_inquiries` as `leads`

Promote `supabase-listing-inquiries.sql` to official migration. Extend columns:

```sql
alter table public.listing_inquiries
  add column if not exists conversation_id uuid,
  add column if not exists pipeline_stage text not null default 'new_inquiry',
  add column if not exists agent_notified_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Expand status check or migrate to pipeline_stage as source of truth
```

**Map existing `status` → `pipeline_stage`:**

| Legacy `status` | Proposed `pipeline_stage` |
|-----------------|---------------------------|
| `new` | `new_inquiry` |
| `responded` | `responded` |
| `scheduled` | `viewing_requested` |
| `closed` | `archived` |

### 3.2 Layer 2 — `conversations`

One conversation per buyer ↔ agent ↔ listing (or merge per buyer-agent pair — product choice).

```sql
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_user_id uuid references auth.users(id) on delete set null,
  agent_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_email text,
  buyer_name text,
  buyer_phone text,
  status text not null default 'open',
  pipeline_stage text not null default 'new_inquiry',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_user_id) -- when buyer authenticated
);
```

Guest buyers: `buyer_user_id` null, keyed by email hash in metadata for dedup.

### 3.3 Layer 3 — `messages`

```sql
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('buyer', 'agent', 'system')),
  body text not null,
  channel text not null default 'in_app'
    check (channel in ('in_app', 'email', 'whatsapp', 'sms', 'system')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
```

Initial inquiry `body` migrates to first message row; `listing_inquiries` retains pointer for backward compat or becomes a view.

### 3.4 Layer 4 — `viewing_requests`

```sql
create table public.viewing_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  agent_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_user_id uuid references auth.users(id) on delete set null,
  requested_date date not null,
  requested_time time not null,
  timezone text not null default 'America/Belize',
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'completed', 'cancelled')),
  agent_notes text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Wire **`ListingViewingBookingModal`** confirm → INSERT here + advance pipeline to `viewing_requested`.

### 3.5 Lead lifecycle (pipeline stages)

```
New Inquiry → Agent Notified → Read → Responded → Viewing Requested →
Viewing Confirmed → Negotiation → Offer Submitted → Deal Closed → Archived
```

| Stage | Trigger | Timestamps |
|-------|---------|------------|
| `new_inquiry` | INSERT inquiry/message | `created_at` |
| `agent_notified` | Notification dispatched | `agent_notified_at` |
| `read` | Agent opens thread | `read_at` |
| `responded` | Agent reply or mark responded | `responded_at` |
| `viewing_requested` | Viewing modal submit | `viewing_requests.created_at` |
| `viewing_confirmed` | Agent confirms slot | `viewing_requests.confirmed_at` |
| `negotiation` | Manual or message intent | metadata |
| `offer_submitted` | Future offer module | metadata |
| `deal_closed` | Link to sold/rented listing event | timeline integration |
| `archived` | Agent or auto-close stale | `archived_at` |

**Every inquiry links:** Listing (`listing_id`), Buyer (`buyer_user_id` / email), Agent (`agent_user_id`), Conversation (`conversation_id`), Status (`pipeline_stage`), Timestamps (above).

Store stage in **`conversations.pipeline_stage`** as canonical; denormalize to `listing_inquiries` during transition.

---

## 4. Recommended APIs

### 4.1 Supabase client modules (extend pattern)

| Module | Functions |
|--------|-----------|
| `listingInquiries.js` | Keep; add deprecation shim → `leads.js` |
| **`leads.js`** (new) | `createLeadFromListingContact`, `fetchLeadsForAgent`, `advancePipelineStage` |
| **`conversations.js`** (new) | `getOrCreateConversation`, `fetchConversation`, `listMessages`, `sendMessage` |
| **`viewingRequests.js`** (new) | `createViewingRequest`, `confirmViewing`, `declineViewing` |

### 4.2 RPC functions (recommended)

| RPC | Purpose |
|-----|---------|
| `create_inquiry_with_conversation(...)` | Atomic: conversation + message + lead row + optional viewing |
| `notify_agent_new_inquiry(...)` | Queue notification (future edge function) |
| `advance_lead_stage(conversation_id, stage)` | Validates transitions |

### 4.3 RLS sketch

| Table | Buyer | Agent | Admin |
|-------|-------|-------|-------|
| `conversations` | SELECT own | SELECT/UPDATE where `agent_user_id = auth.uid()` | ALL |
| `messages` | INSERT/SELECT in own conversations | INSERT/SELECT in assigned conversations | ALL |
| `viewing_requests` | INSERT/SELECT own | UPDATE status | ALL |
| `listing_inquiries` | SELECT own (legacy) | SELECT/UPDATE own | ALL |

Public INSERT policy remains: approved listing + correct agent routing.

### 4.4 Notifications (future)

| Channel | Integration |
|---------|-------------|
| **In-app** | Extend `NotificationCenter` to subscribe to `messages` INSERT |
| **Email** | Supabase Edge Function + Resend/SendGrid on new inquiry |
| **Push** | Web push subscription table (future) |

Do not block Layer 1 on email — in-app polling sufficient for MVP.

---

## 5. Recommended React Architecture

### 5.1 CRM evolution from Contact / Schedule buttons

**Do not replace** `ListingContactActions` shell (frozen 2.3B mobile sticky). Evolve internals:

```
ListingContactActions (frozen chrome)
├── ContactAgentModal (frozen paths)
│   └── onOpenSiteMessage → ListingMessageModal
│       └── createLeadFromListingContact() → conversations + messages
└── ListingViewingBookingModal
    └── onConfirm → createViewingRequest() + createLead(...)
```

### 5.2 New dashboard modules (incremental)

| Surface | Component | Data |
|---------|-----------|------|
| Agent inbox | **`LeadInboxPanel`** (evolve `AgentInquiryList`) | `conversations` list with unread badge |
| Thread view | **`ConversationThread`** | `messages` + reply composer |
| Viewing calendar | **`AgentViewingPanel`** | `viewing_requests` |
| Buyer tracker | **`BuyerInquiriesPanel`** (user dashboard tab) | buyer's conversations |
| Broker (future) | **`BrokerPipelineBoard`** | team agents filter |

### 5.3 State management

| Store | Scope |
|-------|-------|
| **`useAgentLeadsStore`** (evolve `useAgentDashboardStore`) | Inbox, unread counts, realtime |
| **`useConversationStore`** | Active thread messages |
| Keep Zustand | Match existing dashboard pattern |

### 5.4 Feature flags

| Flag | Purpose |
|------|---------|
| `BL_ENABLE_INQUIRIES` | Layer 1 — existing |
| `BL_ENABLE_CONVERSATIONS` | Layer 2+ messaging |
| `BL_ENABLE_VIEWING_PERSIST` | Wire booking modal to DB |

---

## 6. Scalability Without DB Redesign

| Concern | Approach |
|---------|----------|
| New pipeline stages | `pipeline_stage` text + app enum — no ALTER |
| New message metadata | JSONB `metadata` on messages |
| External channel logging | `channel` column + metadata `{ external_url, opened_at }` |
| Broker teams | Add `brokerage_id` on conversations + RLS via profile join (when profile column exists) |
| Analytics | Read replica or nightly aggregate table — **do not** query messages full scan in UI |
| High volume | Partition `messages` by month (future); index `(conversation_id, created_at)` |

---

## 7. Integration with Property Timeline

When [Property Timeline](./property-timeline-architecture.md) ships:

| CRM event | Listing event |
|-----------|---------------|
| Deal closed stage | `listing.sold` / `listing.rented` |
| Listing archived after close | `listing.archived` |
| Public visibility | Do **not** expose buyer PII on public timeline |

Timeline answers “what happened to the listing”; CRM answers “who inquired and where is the deal”.

**Dependency:** Timeline can ship independently; CRM deal-closed stage should emit listing events when both exist.

---

## 8. Design Language Integration

| Element | Guidance |
|---------|----------|
| **Inbox cards** | Reuse `AgentInquiryList.module.css` card language — sea-glass unread state |
| **Thread composer** | Match `ListingMessageModal` typography and spacing |
| **Pipeline pills** | Same chip rhythm as `ListingTrustStrip` status chips — muted, not CRM-neon |
| **Empty states** | `PremiumEmptyState` variant `inquiries` |
| **Modals** | Extend existing modal shells (focus trap, escape, body scroll lock) — no new modal framework |
| **Dashboard** | `DashboardShell` + existing agent metrics strip |

---

## 9. Migration Strategy

### Phase 1 — Leads table official

1. Migration from `supabase-listing-inquiries.sql` + `pipeline_stage` column
2. Enable `BL_ENABLE_INQUIRIES=true` in staging
3. Wire `ListingMessageModal` only (already calls `submitListingInquiry`)

### Phase 2 — Viewing persistence

1. Create `viewing_requests`
2. Replace local confirm in `ListingViewingBookingModal` with API call behind `BL_ENABLE_VIEWING_PERSIST`
3. Agent notification on new viewing

### Phase 3 — Conversations + messages

1. Backfill: one conversation per existing inquiry
2. `AgentInquiryList` → `LeadInboxPanel` with thread navigation
3. Buyer dashboard tab

### Phase 4 — Pipeline + broker

1. Full stage enum UI
2. Broker scope when `brokerage_id` on profiles migrated
3. Email notifications edge function

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Table missing in production | Keep feature flags + graceful toasts (already in modals) |
| Spam inquiries | Retain `scoreInquiryBody()`; add rate limit RPC |
| Guest email duplication | Conversation dedup by `(listing_id, lower(buyer_email))` |
| WhatsApp bypasses CRM | Optional “Log external contact” agent action |
| RLS complexity | RPC for create; integration tests with anon + agent JWT |
| Scope creep | Layer gates; booking persist before full pipeline board |

---

## 11. Reusable Components (Existing)

| Component | Reuse for |
|-----------|-----------|
| `ListingContactActions` | Entry point — keep frozen |
| `ContactAgentModal` | Channel picker |
| `ListingMessageModal` | Message composer pattern |
| `ListingViewingBookingModal` | Calendar UX — wire to API |
| `AgentInquiryList` | Inbox card layout |
| `NotificationCenter` | Agent alerts |
| `PremiumEmptyState` | Zero leads |
| `DashboardShell` | CRM pages |
| `ToastProvider` | Success/error feedback |
| `AuthGateProvider` | Optional gated buyer dashboard |

---

## 12. What Is NOT in Scope (This Proposal)

- Implementation of any schema migration
- CRM UI beyond existing modal/inbox patterns
- Email/push delivery
- Offer submission workflow
- Broker dashboard
- Payment or commission tracking

---

## 13. Open Product Questions

1. One conversation per listing per buyer, or one per buyer-agent across listings?
2. Should WhatsApp clicks create a passive lead row for analytics?
3. Auto-archive stale leads after N days?
4. Buyer-visible status tracker on user dashboard — P0 or P2?
