# CRM Foundation v1.6.0 — Milestone 3.2

**Tag:** `v1.6.0-crm-foundation`  
**Baseline:** Property Timeline v1.5.x (`listing_events`, `writeListingEvent`)  
**Program:** [phase-3-program.md](./phase-3-program.md)  
**Architecture:** [inquiry-lead-management-architecture.md](./proposals/inquiry-lead-management-architecture.md)

---

## Summary

Milestone 3.2 formalizes lead capture and agent/buyer CRM workflows behind feature flags. Public listing contact chrome is unchanged; persistence and dashboard panels evolve internally.

---

## Migration

Apply in Supabase SQL editor or CLI:

```
supabase/migrations/20260626160000_crm_foundation.sql
```

### Tables

| Table | Purpose |
|-------|---------|
| `listing_inquiries` | Lead rows (extended columns, non-breaking) |
| `conversations` | Buyer ↔ agent threads per listing |
| `messages` | In-app thread messages |
| `viewing_requests` | Persisted viewing slots |
| `notification_queue` | Structured delivery queue (no UI yet) |

### RPC

| Function | Purpose |
|----------|---------|
| `create_inquiry_with_conversation(...)` | Atomic inquiry + conversation + first message (+ optional viewing) |

---

## Feature flags

| Env var | Default | Enables |
|---------|---------|---------|
| `NEXT_PUBLIC_BL_ENABLE_INQUIRIES` | false | Legacy inquiry fetch/count + buyer tab |
| `NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS` | false | RPC lead create, agent inbox v2, threading |
| `NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST` | false | `ListingViewingBookingModal` → DB |

**Staging activation (recommended order):**

1. Apply migration
2. `NEXT_PUBLIC_BL_ENABLE_INQUIRIES=true`
3. `NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS=true`
4. `NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST=true`
5. Redeploy frontend

---

## App modules

```
src/lib/crm/
  crmConstants.js       — statuses, stages, inbox groups
  crmCompat.js          — missing-table graceful helpers
  inquiryMutations.js   — submitListingInquiry, createInquiryWithConversation
  conversationMutations.js — agent inbox fetch, sendAgentReply
  viewingMutations.js   — createViewingRequest, confirmViewing

src/lib/notifications/
  notificationEvents.js — enqueueNotificationEvent (stub)

src/components/inquiry/
  AgentInboxPanel.jsx   — grouped agent inbox (flag-gated)
  BuyerInquiriesPanel.jsx
  BuyerViewingsPanel.jsx
```

`src/lib/listingInquiries.js` re-exports from `inquiryMutations` for backwards compatibility.

---

## Listing events (Workstream F)

| Event type | Visibility | Trigger |
|------------|------------|---------|
| `listing.crm.conversation_created` | internal | Inquiry + conversation RPC |
| `listing.crm.agent_responded` | internal | Agent reply |
| `listing.crm.viewing_cancelled` | internal | Viewing cancelled |
| `listing.viewing.scheduled` | public | Agent confirms viewing |

Existing public types (`listing.sold`, `listing.rented`, `listing.photos.updated`, price events) unchanged from 3.1.

---

## Workstreams delivered

| ID | Deliverable |
|----|-------------|
| **A** | `listing_inquiries` official migration + extended columns |
| **B** | `conversations`, `messages`, RPC, modal wiring |
| **C** | `viewing_requests`, booking modal persist |
| **D** | `AgentInboxPanel` on agent dashboard |
| **E** | Buyer My Inquiries / My Viewings tabs |
| **F** | CRM listing event types + `writeListingEvent` hooks |
| **G** | `notification_queue` + `enqueueNotificationEvent` |

---

## Deferred

- Notification center UI (bell) — Workstream G infrastructure only
- Email/push edge functions
- Broker pipeline board (`brokerage_id` scope)
- Guest inquiry → listing event auth (service-role hook)
- Conversation dedup by email hash
- Full Activity Engine (3.5)

---

## QA checklist

- [ ] Guest message on listing detail → inquiry + conversation rows
- [ ] Schedule viewing → `viewing_requests` pending row
- [ ] Agent inbox groups populate; reply advances stage
- [ ] Buyer dashboard tabs show sent inquiries/viewings
- [ ] Flags off → graceful toasts, no regressions on frozen surfaces
- [ ] `npm test`, `npm run build`, `npm run qa` green

---

## Related

- [CHANGELOG.md](../../CHANGELOG.md)
- [marketplace-infrastructure-phase.md](./marketplace-infrastructure-phase.md)
