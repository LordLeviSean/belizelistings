# Marketplace Activation v1.6.5 — Milestone 3.3

**Tag:** `v1.6.5-marketplace-active`  
**Baseline:** CRM Foundation v1.6.0 (`v1.6.0-crm-foundation`, commit `29f7660`)  
**Program:** [phase-3-program.md](./phase-3-program.md)  
**CRM schema:** [crm-foundation-v1.6.md](./crm-foundation-v1.6.md)  
**Event engine:** [event-engine-production-activation.md](./event-engine-production-activation.md)

---

## Summary

Milestone 3.3 activates the CRM foundation in production: migration applied, staged feature-flag rollout, verification scripts, admin marketplace health dashboard, and E2E workflow validation. No new visual language — integration and production readiness only.

---

## 1. Database migration

Apply (once per environment):

```bash
npx supabase link --project-ref xyepbzezoroaeagzzzui
npx supabase db push --linked --yes

# Or direct Postgres / Management API:
node scripts/apply-supabase-migrations.mjs 20260626160000_crm_foundation.sql
```

**Verify:**

```bash
node scripts/verify-crm-activation.mjs
```

Expected: all CRM tables accessible, `create_inquiry_with_conversation` RPC callable.

### Rollout result (dev/staging — 2026-06-26)

| Check | Result |
|-------|--------|
| `20260626160000_crm_foundation.sql` applied | ✅ via `supabase db push --linked` |
| `listing_inquiries`, `conversations`, `messages`, `viewing_requests`, `notification_queue` | ✅ |
| `create_inquiry_with_conversation` RPC | ✅ |

---

## 2. Feature flag rollout (staged)

Flags are **build-time** (`NEXT_PUBLIC_*`). Redeploy after each stage.

| Stage | Variable | Enables | Prerequisite |
|-------|----------|---------|--------------|
| **1** | `NEXT_PUBLIC_BL_ENABLE_INQUIRIES=true` | Buyer inquiry tab, inquiry fetch/count, legacy insert path | Migration applied |
| **2** | `NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS=true` | RPC lead create, `AgentInboxPanel`, threading, conversation events | Stage 1 |
| **3** | `NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST=true` | `ListingViewingBookingModal` → `viewing_requests`, viewing timeline events | Stage 2 |
| **4** | `NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS=true` | Durable inbox in NotificationCenter, queue → notifications delivery | Stage 3 + [notification migration](./notification-delivery-v1.6.6.md) |

**Recommended production order:** Stage 1 → monitor 24h → Stage 2 → monitor → Stage 3 → apply notification migration → Stage 4 → full redeploy.

### Local dev (all stages on)

`.env.local`:

```
NEXT_PUBLIC_BL_ENABLE_INQUIRIES=true
NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS=true
NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST=true
NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS=true
```

Restart dev server after changing flags.

### Netlify production

Set in **Site settings → Environment variables** (all scopes that build production):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_BL_ENABLE_INQUIRIES` | `true` |
| `NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS` | `true` |
| `NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST` | `true` |
| `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS` | `true` (from 3.1B — keep enabled) |

Trigger a **new deploy** after each stage (or all at once when ready). Flags must be present **before** `npm run build`.

---

## 3. E2E workflow transitions

Documented flow (Contact Agent → notification):

| Step | Action | Expected state |
|------|--------|----------------|
| 1 | Guest/buyer submits contact on listing detail | `listing_inquiries` row, `conversations` + `messages`, `notification_queue` `new_inquiry` |
| 2 | Agent opens inbox | Conversation in **New** group (`pipeline_stage: new_inquiry`) |
| 3 | Agent sends reply | `messages` agent row, stage `responded`, `agent_replied` notification, `listing.crm.agent_responded` (internal) |
| 4 | Buyer schedules viewing | `viewing_requests` pending (Stage 3 flag) |
| 5 | Agent confirms viewing | Stage `viewing_scheduled`, `viewing_confirmed` notification, `listing.viewing.scheduled` (public timeline) |
| 6 | Buyer dashboard | My Inquiries / My Viewings tabs populated (authenticated buyer) |

**Validate:**

```bash
node scripts/validate-marketplace-workflow.mjs
```

**Blockers for full UI E2E:**

| Blocker | Impact |
|---------|--------|
| `QA_EMAIL` / `QA_PASSWORD` unset | Step 6 buyer-panel path skipped; service-role path still validates DB transitions |
| Admin JWT UI path | Admin marketplace health page requires signed-in admin session |
| Netlify flags off | Production UI remains on legacy graceful fallbacks |

---

## 4. Verification scripts

| Script | Purpose |
|--------|---------|
| `scripts/verify-crm-activation.mjs` | Tables + RPC smoke test |
| `scripts/validate-marketplace-workflow.mjs` | Full CRM transition chain |
| `scripts/audit-notification-queue.mjs` | Event types, duplicates, orphans, failed payloads |
| `scripts/audit-crm-timeline-events.mjs` | CRM listing event types + visibility |
| `scripts/audit-crm-integrity.mjs` | Orphan viewings, duplicate conversations, missing owners |
| `scripts/repair-crm-integrity.mjs` | Safe auto-repair (`--dry-run` first) |

### Notification event types (audit expects)

- `new_inquiry` — RPC insert on lead capture
- `agent_replied` — agent reply mutation
- `viewing_scheduled` — pipeline stage (inbox grouping; optional queue row)
- `viewing_confirmed` — confirm viewing mutation
- `viewing_cancelled` — cancel viewing mutation
- `conversation_created` — reserved for future enqueue hook

### CRM timeline event types

| Event type | Visibility |
|------------|------------|
| `listing.crm.conversation_created` | internal |
| `listing.crm.agent_responded` | internal |
| `listing.crm.viewing_cancelled` | internal |
| `listing.viewing.scheduled` | public |

---

## 5. Admin marketplace health dashboard

**Path:** `/admin/marketplace-health`  
**API:** `GET /api/admin/marketplace-health` (admin JWT + service role)

Metrics: listings total/verified/pending, open conversations/viewings, notification queue pending/failed, events today, orphan record count, recent activity (last 10 events/inquiries).

Linked from Admin Control Center → **Marketplace Health**.

---

## 6. Data integrity

```bash
node scripts/audit-crm-integrity.mjs
node scripts/repair-crm-integrity.mjs --dry-run
node scripts/repair-crm-integrity.mjs
```

**Auto-repair (safe):**

- Set `listing_inquiries.listing_owner_id` from `agent_user_id` when null
- Link `listing_inquiries.conversation_id` from `conversations.inquiry_id` when mismatched

**Manual review required:**

- Duplicate conversations (same listing + buyer)
- Orphan viewings pointing at deleted listings
- Listings without `user_id`
- Agent/listing owner mismatch after ownership transfer

---

## 7. QA checklist

- [ ] Migration applied + `verify-crm-activation.mjs` green
- [ ] Stage 1 flag → buyer inquiry tab loads without errors
- [ ] Stage 2 flag → guest contact creates conversation; agent inbox populates
- [ ] Stage 3 flag → viewing modal persists; confirm emits public timeline event
- [ ] `audit-notification-queue.mjs` — no failed payloads
- [ ] `audit-crm-integrity.mjs` — no orphans (or repaired)
- [ ] Admin marketplace health page loads for admin role
- [ ] `npm test`, `npm run build`, `npm run qa` green

---

## 8. Success criteria

| Criterion | Target |
|-----------|--------|
| CRM migration on production Supabase | Applied |
| Feature flags documented + staged | 3 stages |
| Verification scripts in repo | 6 scripts |
| E2E workflow script | Service-role green |
| Health dashboard | Admin-only, live metrics |
| No regressions with flags off | Graceful fallbacks preserved |
| CHANGELOG + tag | v1.6.5 |

---

## Related

- [CHANGELOG.md](../../CHANGELOG.md)
- [crm-foundation-v1.6.md](./crm-foundation-v1.6.md)
