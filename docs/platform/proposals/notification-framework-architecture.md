# Notification Framework — Architecture Proposal

**Phase:** Marketplace Infrastructure — Workstream D  
**Status:** Design only (Milestone 3.1) — **no implementation**  
**Baseline:** v1.5.0 timeline foundation  
**Related:** [inquiry-lead-management-architecture.md](./inquiry-lead-management-architecture.md), [activity-engine-architecture.md](./activity-engine-architecture.md)

---

## 1. Problem Statement

`NotificationCenter` today **polls ad hoc sources** — new inquiries, pending listings, agent upgrade requests — with no unified notification store, no delivery guarantees, and no email/push channel. As CRM and timeline events grow, polling becomes fragile and duplicates business logic.

---

## 2. Goals

| Goal | Measure |
|------|---------|
| Durable notifications | `notifications` table with read/unread |
| Channel abstraction | in-app first; email second; push future |
| Event-driven | Triggered by domain writes, not UI polling |
| Role-aware | Agent, admin, buyer scopes via RLS |

---

## 3. Proposed Schema (Layer 1)

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,          -- inquiry, moderation, listing_event, system
  event_type text not null,        -- e.g. lead.new_inquiry, listing.price.reduced
  entity_type text,                -- listing, conversation, inquiry
  entity_id uuid,
  title text not null,
  body text,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
```

Index: `(recipient_user_id, created_at desc)` where `read_at is null` for unread badge.

---

## 4. Delivery Pipeline

```
Domain write (lead insert, listing event, admin action)
        │
        ▼
┌───────────────────┐
│ notify_enqueue()  │  SECURITY DEFINER RPC or Edge Function
│ (idempotent key)  │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
 in_app      email (async)
 row         Edge Function + Resend/SendGrid
```

### 4.1 Trigger points (initial)

| Event | Recipient | Channel |
|-------|-----------|---------|
| New inquiry / message | Listing agent | in-app + email (opt-in) |
| Viewing request | Agent | in-app |
| Listing approved | Owner agent | in-app |
| Price reduced (owned listing) | Saved-search users | future / 3.6+ |
| Admin upgrade request | Admins | existing poll → migrate |

### 4.2 Idempotency

`payload.dedupe_key` or `(recipient_user_id, event_type, entity_id)` unique partial index prevents duplicate notifications on retry.

---

## 5. React Integration (Future)

| Module | Role |
|--------|------|
| `useNotificationStore` | Unread count, mark read, fetch page |
| `NotificationCenter` | Evolve to read `notifications` table |
| `notificationCopyRegistry.js` | Editorial titles matching design DNA |

Feature flag: `NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS` (default false).

---

## 6. Relationship to Activity Engine

| System | Purpose |
|--------|---------|
| **Activity Engine** | Chronological operational feed (read-heavy, multi-source) |
| **Notifications** | Actionable alerts requiring user acknowledgment |

Listing verification events → activity feed for admin audit; **not** buyer notifications unless product requests it.

---

## 7. Dependencies

| Milestone | Requirement |
|-----------|-------------|
| 3.2 | Stable lead create path |
| 3.6 | Notification framework MVP |

---

## 8. Non-Goals (This Proposal)

- Web push subscriptions
- SMS / WhatsApp delivery
- Marketing campaigns
- Per-user notification preference center (P2)

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Email deliverability | Edge function + verified domain; queue retries |
| Notification fatigue | Category mute settings (P2); batch digest |
| PII in payload | Never store buyer email in notification title; reference conversation id |
