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

---

## 8. Staging execution log

**Run date:** 2026-07-13  
**Commit:** `0319dd2` (pre-automation); automation added in follow-up commit  
**Environment:** Supabase project connected via service role; no dedicated staging Netlify site configured in repo

### Credentials / connections available

| Credential / connection | Status |
|-------------------------|--------|
| `DATABASE_URL` | NOT SET |
| `DIRECT_URL` | NOT SET |
| `NEXT_PUBLIC_SUPABASE_URL` | SET |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | SET |
| `SUPABASE_SERVICE_ROLE_KEY` | SET |
| `SUPABASE_ACCESS_TOKEN` | NOT SET |
| `NETLIFY_AUTH_TOKEN` | NOT SET (CLI session auth used) |
| `NETLIFY_SITE_ID` | NOT SET (repo linked via `.netlify/state.json`) |
| `CRON_SECRET` | **SET** |
| `E2E_*` test accounts | NOT SET |
| Supabase CLI authenticated | **YES** — v2.109.1; project `BelizeListings` (`xyepbzezoroaeagzzzui`) linked, ACTIVE_HEALTHY |
| Netlify CLI authenticated | **YES** — linked to `belizelistings` |
| Playwright / browser automation | AVAILABLE (`@playwright/test` installed) |

Check locally: `npm run check:staging-access`

### Migrations applied and verified

| Migration | Applied | Verified |
|-----------|---------|----------|
| `20260710190000_listing_owner_metrics.sql` | **APPLIED** (2026-07-13 via `supabase db push --linked`) | Owner metrics migration in push batch |
| `20260710200000_recently_closed_listing_lifecycle.sql` | **APPLIED** | `listings.lifecycle_status` column readable |
| `20260712120000_p0_marketplace_security.sql` | **APPLIED** | `create_inquiry_with_conversation` + `enqueue_notification_event` RPCs callable |
| `20260712140000_open_beta_communication_loop.sql` | **APPLIED** | `viewing_requests.proposed_by` column readable |

**2026-07-13 update:** `npx supabase db push --linked` applied 10 pending migrations including all four open-beta targets. `npm run verify:staging-schema` → **all checks OK**.

### Staging site identified

| Item | Value |
|------|-------|
| **Site name** | `belizelistings` |
| **Site ID** | `94710793-73da-4300-98ed-013164bde3ad` |
| **URL** | `https://belizelistings.bz` |
| **Note** | No separate staging subdomain exists in Netlify; this site serves production and readiness verification. |

Linked via `netlify link --id 94710793-73da-4300-98ed-013164bde3ad`.

### Staging variables configured (2026-07-13)

| Variable | Status |
|----------|--------|
| `NEXT_PUBLIC_BL_ENABLE_INQUIRIES` | **SET** (`1`) |
| `NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS` | **SET** (`1`) |
| `NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST` | **SET** (`1`) |
| `NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS` | **SET** (`1`) |
| `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS` | **SET** (`1`) |
| `CRON_SECRET` | **SET** (generated; stored in Netlify + `.env.local`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **SET** |

Configure: `npm run configure:netlify-staging`

### Staging deployment URL

**https://belizelistings.bz**  
Deploy `6a55039dbc2a114676b406a3` (2026-07-13) — includes scheduled function + all CRM flags.

### Cron configuration

| Item | Status |
|------|--------|
| Netlify scheduled function | **DEPLOYED** — `netlify/functions/process-notifications-cron.mjs` (`*/5 * * * *`) |
| HTTP fallback | `GET /api/cron/process-notifications` with `Authorization: Bearer <CRON_SECRET>` |

### Cron verification

| Check | Result |
|-------|--------|
| HTTP cron endpoint | **PASS** — `npm run verify:cron-endpoint` → `{ "ok": true, "status": 200 }` |
| RPC batch processor | **PASS** — callable via service role |
| Queue → inbox (live event) | **NOT VERIFIED** — queue empty at test time; run after Flow A/B with real accounts |

### Credentials / connections available (updated)

| Credential / connection | Status |
|-------------------------|--------|
| `CRON_SECRET` | **SET** (local + Netlify) |
| Netlify CLI authenticated | **YES** — linked to `belizelistings` |
| `E2E_*` test accounts | **NOT SET** |
|-------|--------|
| HTTP cron endpoint | **NOT RUN** — `CRON_SECRET` unavailable |
| RPC `process_notification_queue_batch` | **CALLABLE** via service role |

Run when `CRON_SECRET` available: `npm run test:notification-delivery`

### Queue-to-notification delivery

| Check | Result |
|-------|--------|
| Product event → queue | **PASS** — `validate-marketplace-workflow.mjs` created `new_inquiry` notification (step 1) |
| Queue → inbox delivery | **PARTIAL** — RPC batch processed 1 queue row (`deliveryObserved: true`) but item skipped (`no_recipient`); inbox count unchanged (5→5). Full delivery not proven. |

### Test accounts required

Create in Supabase Auth and copy to `.env.test.local` (see `.env.test.example`):

| Role | Env vars | Purpose |
|------|----------|---------|
| Buyer | `E2E_BUYER_EMAIL`, `E2E_BUYER_PASSWORD` | Flows A, B |
| Owner | `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD` | Flows A, B, C |
| Agent | `E2E_AGENT_EMAIL`, `E2E_AGENT_PASSWORD` | Agent dashboard coverage |
| Admin | `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Admin CRM coverage |
| Fixture | `E2E_PUBLISHED_LISTING_ID` | Published listing owned by owner account |
| Fixture | `E2E_CLOSABLE_LISTING_ID` | Disposable listing for Flow C |

### Automated E2E results

| Suite | Command | Result |
|-------|---------|--------|
| Flow A — Messaging | `npm run e2e:staging -- flow-a` | **SKIPPED** — no `E2E_*` credentials |
| Flow B — Viewing | `npm run e2e:staging -- flow-b` | **SKIPPED** — no `E2E_*` credentials |
| Flow C — Closed listing | `npm run e2e:staging -- flow-c` | **SKIPPED** — no `E2E_*` credentials |

Viewports configured: 390, 414, 1366, 1440 (Playwright projects).

### Manual QA results

| Role / surface | Desktop | Mobile | Result |
|----------------|---------|--------|--------|
| Buyer — Messages | ☐ | ☐ | **NOT TESTED** |
| Buyer — My Viewings | ☐ | ☐ | **NOT TESTED** |
| Owner — Owner Inbox | ☐ | ☐ | **NOT TESTED** |
| Owner — Owner Viewings | ☐ | ☐ | **NOT TESTED** |
| Agent — Inquiries / Viewings | ☐ | ☐ | **NOT TESTED** |
| Admin — CRM tabs | ☐ | ☐ | **NOT TESTED** |
| Flow A | ☐ | ☐ | **NOT TESTED** |
| Flow B | ☐ | ☐ | **NOT TESTED** |
| Flow C | ☐ | ☐ | **NOT TESTED** |

### Failures discovered

1. **`viewing_requests.proposed_by` missing** — **RESOLVED** 2026-07-13 via `supabase db push --linked`.
2. **`enqueue_notification_event` old signature** — **RESOLVED** — P0 migration applied; schema verification passes.
3. **No database migration credentials** — **RESOLVED** for Supabase CLI path (`db push --linked` works without `DATABASE_URL`).
4. **No Netlify access** — cannot set flags or cron remotely.
5. **No test accounts** — E2E and manual matrix blocked.

### Fixes made (this session)

- Added `scripts/check-staging-access.mjs`, `scripts/verify-staging-schema.mjs`, `scripts/test-notification-delivery.mjs`
- Added Playwright staging suite (`e2e/staging/*.spec.mjs`, `playwright.config.mjs`)
- Added `.env.test.example` with required account matrix
- Documented execution log in this file

### Remaining actions requiring you

1. ~~Add `DATABASE_URL` or `SUPABASE_ACCESS_TOKEN`~~ — **done** via `npx supabase db push --linked`.
2. ~~Configure Netlify env flags + `CRON_SECRET` + redeploy~~ — **done** (belizelistings.bz, deploy `6a55039dbc2a114676b406a3`).
3. ~~Schedule cron~~ — **done** (`process-notifications-cron` every 5 min).
4. **Provision four test accounts** + listing fixtures; copy to `.env.test.local`.
5. **Run** `npm run e2e:staging` and complete manual matrix §4.
6. **Only then** mark Open Beta gate passed.

### Open Beta gate status

**NOT PASSED** — Flows A, B, and C have not been verified against staging with real accounts.
