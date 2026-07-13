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
| `NETLIFY_AUTH_TOKEN` | NOT SET |
| `NETLIFY_SITE_ID` | NOT SET |
| `CRON_SECRET` | NOT SET |
| `E2E_*` test accounts | NOT SET |
| Supabase CLI authenticated | NOT VERIFIED (no linked project in repo) |
| Netlify CLI authenticated | NOT VERIFIED |
| Playwright / browser automation | AVAILABLE (`@playwright/test` installed) |

Check locally: `npm run check:staging-access`

### Migrations applied and verified

| Migration | Applied | Verified |
|-----------|---------|----------|
| `20260710190000_listing_owner_metrics.sql` | **BLOCKED** — no `DATABASE_URL` / `SUPABASE_ACCESS_TOKEN` | Not verified |
| `20260710200000_recently_closed_listing_lifecycle.sql` | **UNKNOWN** | `listings.lifecycle_status` column readable via PostgREST |
| `20260712120000_p0_marketplace_security.sql` | **PARTIAL** — `create_inquiry_with_conversation` callable; `enqueue_notification_event` still exposes **old** PostgREST signature (`p_payload` before `p_recipient_id`) | Workflow validation passed; secure enqueue RPC not verified |
| `20260712140000_open_beta_communication_loop.sql` | **NOT APPLIED** | `viewing_requests.proposed_by` column **missing** |

Verify: `npm run verify:staging-schema`

**Blocker:** Add `DATABASE_URL` or `SUPABASE_ACCESS_TOKEN` to `.env.local`, then:

```bash
node scripts/apply-supabase-migrations.mjs \
  20260710190000_listing_owner_metrics.sql \
  20260710200000_recently_closed_listing_lifecycle.sql \
  20260712120000_p0_marketplace_security.sql \
  20260712140000_open_beta_communication_loop.sql
```

### Staging variables configured

| Variable | Status |
|----------|--------|
| `NEXT_PUBLIC_BL_ENABLE_INQUIRIES` | NOT CONFIGURED (Netlify access unavailable) |
| `NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS` | NOT CONFIGURED |
| `NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST` | NOT CONFIGURED |
| `NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS` | NOT CONFIGURED |
| `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS` | NOT CONFIGURED |
| `CRON_SECRET` | NOT SET locally or in Netlify |

**Blocker:** Provide `NETLIFY_AUTH_TOKEN` + staging site ID, or configure manually in Netlify UI and redeploy.

### Staging deployment URL

Not identified in repository. Default E2E target falls back to `https://belizelistings.bz` when `E2E_BASE_URL` unset.

### Cron configuration

| Item | Status |
|------|--------|
| Netlify scheduled function | NOT CONFIGURED — `netlify.toml` documents manual setup only |
| External scheduler | NOT CONFIGURED |
| `CRON_SECRET` | NOT SET — endpoint fails closed (503) when unset |

### Cron verification

| Check | Result |
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

1. **`viewing_requests.proposed_by` missing** — migration `20260712140000` not applied; Flow B buyer accept + labels will fail on live DB until applied.
2. **No database migration credentials** — cannot apply pending SQL from CI/agent environment.
3. **No Netlify staging access** — cannot enable feature flags or configure cron remotely.
4. **No E2E test accounts** — Playwright flows cannot execute.

### Fixes made (this session)

- Added `scripts/check-staging-access.mjs`, `scripts/verify-staging-schema.mjs`, `scripts/test-notification-delivery.mjs`
- Added Playwright staging suite (`e2e/staging/*.spec.mjs`, `playwright.config.mjs`)
- Added `.env.test.example` with required account matrix
- Documented execution log in this file

### Remaining actions requiring you

1. **Add `DATABASE_URL` or `SUPABASE_ACCESS_TOKEN`** to `.env.local` and apply the four pending migrations.
2. **Configure Netlify staging** env flags + `CRON_SECRET` + redeploy.
3. **Schedule cron** hitting `/api/cron/process-notifications` every 2–5 minutes.
4. **Provision four test accounts** + listing fixtures; copy to `.env.test.local`.
5. **Run** `npm run verify:staging-schema` (must show `proposed_by` OK).
6. **Run** `npm run e2e:staging` and complete manual matrix §4.
7. **Only then** mark Open Beta gate passed.

### Open Beta gate status

**NOT PASSED** — Flows A, B, and C have not been verified against staging with real accounts.
