# Marketplace Security v1.6.7 — Milestone 3.7

**Tag:** `v1.6.7-marketplace-security`  
**Baseline:** Notification Delivery v1.6.6 (`cb0668a` / `v1.6.6-notification-delivery`)  
**Program:** [phase-3-program.md](./phase-3-program.md)

---

## Summary

Milestone 3.7 hardens public lead capture and ops surfaces without UI redesign or new marketplace features. Guests can be routed through Turnstile + honeypot + server-side listing resolution; database rate limits apply inside `create_inquiry_with_conversation`; cron and admin APIs fail closed where secrets are missing; marketplace health exposes security signals.

---

## Threat model

| Actor | Goal | Primary surfaces |
|-------|------|------------------|
| Spam bot | Flood agents with fake leads | Listing message modal, inquiry RPC |
| Scraper / scripted client | Bypass client validation, spoof agent ids | Direct RPC / forged payloads |
| Authenticated abuser | Drain notification queue, spam deliver RPC | Notification RPCs (pre-3.7) |
| Misconfigured cron | Unauthenticated queue processing | `/api/cron/process-notifications` |

**Trust boundaries:** Browser (untrusted) → Next.js API (Turnstile, honeypot) → Supabase service role / session → SECURITY DEFINER RPCs → RLS-protected tables.

---

## Threat | Risk | Mitigation | Status

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Guest inquiry spam | Agent inbox flood, notification noise | DB rate limits: 3/listing/hr, 10 global/hr by `sender_email`; optional Turnstile | **Mitigated** (migration + API) |
| Client-spoofed listing owner | Leads routed to wrong agent | API resolves `agent_user_id` from `listings.user_id`; RPC rejects mismatch | **Mitigated** |
| Bot form submission | Automated lead posts | Honeypot `company_website`; Turnstile when flag on | **Mitigated** |
| Direct anon RPC abuse | Bypass API checks | Staged: guests use API when `NEXT_PUBLIC_BL_ENABLE_TURNSTILE=true`; DB limits always apply in RPC | **Partial** (flag-gated API path; RPC still callable when flag off) |
| Notification deliver RPC by any user | Queue drain / forged inbox rows | Revoked `EXECUTE` on `deliver_notification` / `process_notification_queue_batch` from `authenticated` | **Fixed** (migration) |
| Cron without secret | Unauthorized batch processing | `/api/cron/process-notifications` returns **503** if `CRON_SECRET` unset | **Fixed** |
| Duplicate notifications | Agent alert fatigue | `dedupe_key` unique index + `ON CONFLICT` upsert in `deliver_notification` | **Mitigated** (v1.6.6, reviewed) |
| Missing recipient on queue row | Silent drops | Marked `skipped` with reason `no_recipient` | **Mitigated** |
| Invalid queue payload | Bad inbox copy | `notification_presentation_for_event` SQL mirror; unknown events get generic copy | **Accepted** (monitor via failed queue count) |
| Admin health data leak | CRM/security metrics exposed | Admin JWT + `profiles.role = admin` on marketplace-health APIs | **Mitigated** |
| No audit trail for blocks | Blind to attack volume | `security_events` append-only table + health dashboard cards | **Mitigated** |

---

## Workstreams (implementation map)

| WS | Deliverable |
|----|-------------|
| A | `@marsidev/react-turnstile`, `NEXT_PUBLIC_BL_ENABLE_TURNSTILE`, env keys |
| B | `20260628120000_inquiry_rate_limits.sql` — indexes, RPC limits, `security_events` |
| C | `POST /api/inquiries/create` — Turnstile, honeypot, listing resolve, error mapping |
| D | Honeypot in `ListingMessageModal` |
| E | Notification RPC grant hardening; dedupe reviewed (see table) |
| F | Cron fail-closed; admin routes already JWT-gated |
| G | This document + critical grant fix |
| H | `abuseProtectionExtensionPoints.js` stubs |
| I | Marketplace health security metrics + recent events |
| J | This document |

---

## Extension points

See `src/lib/security/abuseProtectionExtensionPoints.js`:

- `verifyRecaptchaToken` / `verifyHcaptchaToken` — alternate captcha providers
- `scoreInquiryWithAiSpamModel` — content scoring hook
- `computeAbuseScore` — composite signal → allow | review | block

Wire through `/api/inquiries/create` in a future milestone without modal redesign.

---

## Feature flag rollout

| Variable | Default | Enables |
|----------|---------|---------|
| `NEXT_PUBLIC_BL_ENABLE_TURNSTILE` | false | Turnstile widget for guests; guest submits via `/api/inquiries/create` |

**Requires when enabled:**

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Authenticated users **bypass** Turnstile and continue using direct RPC path via `submitListingInquiry`.

---

## Deployment

### Order

1. Apply migration `20260628120000_inquiry_rate_limits.sql` (after CRM + notification migrations).
2. Set `CRON_SECRET` in production (required for cron — fail closed).
3. Optionally set Turnstile keys + `NEXT_PUBLIC_BL_ENABLE_TURNSTILE=true`; redeploy frontend.
4. Verify marketplace health security cards at `/admin/marketplace-health`.

### Apply migration

```bash
npx supabase link --project-ref <ref>
npx supabase db push --linked --yes

# Or:
node scripts/apply-supabase-migrations.mjs 20260628120000_inquiry_rate_limits.sql
```

### Env vars

| Variable | Scope | Notes |
|----------|-------|-------|
| `CRON_SECRET` | Server | **Required** for cron route |
| `TURNSTILE_SECRET_KEY` | Server | Cloudflare secret |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Client | Site key |
| `NEXT_PUBLIC_BL_ENABLE_TURNSTILE` | Client | Stage guest secure path |

See `.env.example`.

### Rollback

1. Set `NEXT_PUBLIC_BL_ENABLE_TURNSTILE=false` and redeploy (immediate).
2. DB: replace `create_inquiry_with_conversation` with pre-3.7 body from `20260626160000_crm_foundation.sql` if rate limits cause false positives.
3. Re-grant notification RPCs to `authenticated` only if a dependent client breaks (not recommended).
4. Drop `security_events` if unused (optional; table is append-only audit).

### Cron

Schedule `GET` or `POST` `/api/cron/process-notifications` with `Authorization: Bearer $CRON_SECRET` every 1–5 minutes.

---

## Tests

```bash
npm test -- --testPathPattern="security|inquiries/create|process-notifications"
npm run build
npm run qa
```

Coverage: Turnstile verify mock, honeypot rejection, rate-limit HTTP mapping, cron fail-closed, RPC error parser unit tests.

---

## Related docs

- [notification-delivery-v1.6.6.md](./notification-delivery-v1.6.6.md)
- [marketplace-activation-v1.6.5.md](./marketplace-activation-v1.6.5.md)
- [crm-foundation-v1.6.md](./crm-foundation-v1.6.md)
