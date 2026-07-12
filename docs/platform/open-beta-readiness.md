# Limited Open Beta Readiness — Communication Loop

Operational checklist for staging and controlled open beta. **Do not redesign dashboards** — focus on proving the live communication loop.

**Related:** [production-readiness-checklist.md](./production-readiness-checklist.md) · [notification-delivery-v1.6.6.md](./notification-delivery-v1.6.6.md)

---

## Completion standard (must pass without refresh, duplicate alerts, dead ends, or wrong routing)

| # | Flow | Pass criteria |
|---|------|---------------|
| A | **Messaging** | Buyer sends message → owner receives → owner replies → buyer gets notification → notification opens exact thread |
| B | **Viewing reschedule** | Buyer requests viewing → owner proposes time → buyer accepts → both dashboards show confirmed time → correct notifications |
| C | **Listing closed** | Owner marks rented/sold → public card updates → active inventory count updates → new messaging/viewing blocked → history remains |

---

## 1. Apply pending migrations (staging → production)

Apply in order after prior CRM/security migrations:

| # | Migration | Purpose |
|---|-----------|---------|
| 1 | `20260710190000_listing_owner_metrics.sql` | Owner metrics |
| 2 | `20260710200000_recently_closed_listing_lifecycle.sql` | Recently sold/rented lifecycle |
| 3 | `20260712120000_p0_marketplace_security.sql` | P0 security + RPC hardening |
| 4 | `20260712140000_open_beta_communication_loop.sql` | Preview reuse, `proposed_by`, notification copy |

```bash
# Requires DATABASE_URL or DIRECT_URL in .env.local
node scripts/apply-supabase-migrations.mjs
```

**Production dependency:** Supabase project credentials. Migrations are not applied automatically on deploy.

---

## 2. Staging environment flags

Set in Netlify (or `.env.local` for local staging) and **redeploy** — flags are build-time:

```env
NEXT_PUBLIC_BL_ENABLE_INQUIRIES=1
NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS=1
NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST=1
NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS=1
CRON_SECRET=<strong-random-secret>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Optional for full lifecycle proof:

```env
NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS=1
```

---

## 3. Notification queue cron

Endpoint: `GET` or `POST` `/api/cron/process-notifications`

| Requirement | Value |
|-------------|-------|
| Auth | `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret` |
| Interval | Every 2–5 minutes |
| Server env | `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` |

Fails closed when `CRON_SECRET` is unset (503).

See `netlify.toml` for Netlify scheduled-function notes.

**Verify:**

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://<staging-host>/api/cron/process-notifications?limit=10"
```

Expect `200` with `{ ok: true, ... }`.

---

## 4. Manual test matrix

Use **four separate accounts**: buyer, owner (or agent), second owner if needed, admin.

### Flow A — Messaging

| Step | Actor | Action | Expected | Desktop | Mobile | Notes |
|------|-------|--------|----------|---------|--------|-------|
| A1 | Buyer | Send message from listing | Owner inbox shows thread + preview | ☐ | ☐ | |
| A2 | Owner | Open inbox, reply | Buyer thread updates **without refresh** | ☐ | ☐ | Realtime |
| A3 | Buyer | Receive notification | Opens `/dashboard/user?tab=messages&conversation=<id>` | ☐ | ☐ | |
| A4 | Buyer | Notification deep link | Exact thread selected | ☐ | ☐ | |

### Flow B — Viewing reschedule

| Step | Actor | Action | Expected | Desktop | Mobile | Notes |
|------|-------|--------|----------|---------|--------|-------|
| B1 | Buyer | Request viewing | Owner gets **one** notification (no duplicate) | ☐ | ☐ | |
| B2 | Owner | Propose new time | Buyer sees "Agent proposed: …" | ☐ | ☐ | |
| B3 | Buyer | Accept proposed time | Status confirmed; slot promoted to requested_date/time | ☐ | ☐ | |
| B4 | Both | Dashboards open | Confirmed time appears **without refresh** | ☐ | ☐ | Realtime |
| B5 | Owner | Notification | Opens agent viewings tab with viewing id | ☐ | ☐ | `recipient_role: agent` |

### Flow C — Listing closed

| Step | Actor | Action | Expected | Desktop | Mobile | Notes |
|------|-------|--------|----------|---------|--------|-------|
| C1 | Owner | Mark sold/rented | Public card shows recently closed | ☐ | ☐ | |
| C2 | Owner | Dashboard | Active inventory count decreases | ☐ | ☐ | |
| C3 | Buyer | New message/viewing on listing | Blocked with clear message | ☐ | ☐ | |
| C4 | Both | Existing threads | History still readable | ☐ | ☐ | |

### Role coverage

| Role | Surfaces tested | Pass |
|------|-----------------|------|
| Buyer (`/dashboard/user`) | Messages, My Viewings | ☐ |
| Owner-user (`/dashboard/user` owner tabs) | Owner Inbox, Owner Viewings | ☐ |
| Agent (`/dashboard/agent`) | Inquiries, Viewings | ☐ |
| Admin (`/admin`) | Messages, Owner Inbox, My Viewings | ☐ |

---

## 5. Test log template

Record each run (date, environment, commit SHA):

```
Date:
Environment: staging | production
Commit:
Tester:

Flow A: PASS | FAIL — notes:
Flow B: PASS | FAIL — notes:
Flow C: PASS | FAIL — notes:

Failures (detail):
Production dependencies blocking:
```

---

## 6. Code changes in this phase (reference)

| Area | Fix |
|------|-----|
| Duplicate viewing alerts | Removed JS `viewing_requested` after RPC `new_inquiry` |
| Buyer reschedule accept | `acceptViewingReschedule({ asAgent: false })` + buyer UI |
| Reschedule labels | `proposed_by` column + panel logic |
| Notification routing | `recipient_role` + `resolveNotificationDestination` by role |
| Open threads | Supabase realtime on `messages` INSERT |
| Conversation previews | RPC reuse path updates `last_message_*` |
| Viewing dashboards | Realtime on `viewing_requests` changes |

---

## 7. Open Beta gate

**Ready for controlled Open Beta when:**

- [ ] All four migrations applied on staging
- [ ] All four CRM/notification flags enabled on staging
- [ ] Cron verified delivering notifications within 5 minutes
- [ ] Flows A, B, C pass on desktop **and** mobile with real accounts
- [ ] Test log completed with no P0 failures
- [ ] Same checklist repeated on production before public invite
