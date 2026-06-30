# Production readiness checklist — v1.7.0

Use this checklist before enabling marketplace features in production (Netlify + Supabase). All flags default **off** until migrations are applied and env vars are set.

**Related:** [platform-freeze-v1.7.0.md](./platform-freeze-v1.7.0.md) · [marketplace-security-v1.6.7.md](./marketplace-security-v1.6.7.md)

---

## 1. Supabase migrations (apply in order)

| # | Migration file | Required for |
|---|----------------|--------------|
| 1 | `20260512120000_handle_new_user_profile.sql` | Auth profiles |
| 2 | `20260512140000_profiles_rls_and_trigger_hardening.sql` | Profile RLS |
| 3 | `20260512160000_listings_user_dashboard_index.sql` | Dashboard index |
| 4 | `20260512180000_profiles_admin_rls.sql` | Admin RLS |
| 5 | `20260512190000_profiles_admin_rls_fix.sql` | Admin helper fix |
| 6 | `20260623120000_agent_upgrade_requests.sql` | Agent upgrades |
| 7 | `20260625120000_listing_verification_status.sql` | Verification badges |
| 8 | `20260625130000_listing_verification_metadata.sql` | Verification audit |
| 9 | `20260626120000_listing_events.sql` | Property timeline RPC |
| 10 | `20260626160000_crm_foundation.sql` | CRM / inquiries |
| 11 | `20260627120000_notification_delivery.sql` | Notifications inbox |
| 12 | `20260628120000_inquiry_rate_limits.sql` | Rate limits + security events |

```bash
node scripts/apply-supabase-migrations.mjs
# or per-file:
node scripts/apply-supabase-migrations.mjs 20260628120000_inquiry_rate_limits.sql
```

**Rollback notes:** Each milestone doc (`marketplace-activation-v1.6.5.md`, `notification-delivery-v1.6.6.md`, `marketplace-security-v1.6.7.md`) includes rollback steps. Prefer flag-off + redeploy before destructive DB rollback.

---

## 2. Environment variables

Copy `.env.example` → `.env.local` (dev) or Netlify env (production). See `.env.example` for full list.

### Required (all environments)

| Variable | Scope |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `NEXT_PUBLIC_SITE_URL` | Client — **required in production** for auth email redirects ([auth-production-config.md](./auth-production-config.md)) |

### Required in production (marketplace enabled)

| Variable | Scope | Notes |
|----------|-------|-------|
| `CRON_SECRET` | Server | **Required** — cron returns 503 when unset |

### Staged feature flags (build-time — redeploy after change)

| Variable | Stage | Doc |
|----------|-------|-----|
| `NEXT_PUBLIC_BL_ENABLE_INQUIRIES` | 1 | [marketplace-activation-v1.6.5.md](./marketplace-activation-v1.6.5.md) |
| `NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS` | 2 | same |
| `NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST` | 3 | same |
| `NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS` | 4 | [notification-delivery-v1.6.6.md](./notification-delivery-v1.6.6.md) |
| `NEXT_PUBLIC_BL_ENABLE_TURNSTILE` | Security | [marketplace-security-v1.6.7.md](./marketplace-security-v1.6.7.md) |
| `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS` | Timeline | [event-engine-production-activation.md](./event-engine-production-activation.md) |

When Turnstile enabled, also set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`.

---

## 3. Netlify manual steps

- [ ] Link repo; build command `npm run build`; publish `.next` (Next.js on Netlify)
- [ ] Set all required env vars (Section 2); trigger redeploy after flag changes
- [ ] Schedule cron: `GET` or `POST` `/api/cron/process-notifications` every 1–5 min with header `Authorization: Bearer $CRON_SECRET`
- [ ] Verify `/admin/marketplace-health` loads for admin role after Stages 1–4 enabled
- [ ] Optional: Cloudflare Turnstile site configured for production domain

---

## 4. Supabase manual steps

- [ ] Confirm all migrations applied (`scripts/verify-crm-activation.mjs`, `verify-listing-events-db.mjs`)
- [ ] Enable Realtime on `notifications` if using Stage 4 (migration adds publication)
- [ ] Review RLS policies in Supabase dashboard for `listing_inquiries`, `conversations`, `notifications`
- [ ] Service role key stored only in Netlify server env — never `NEXT_PUBLIC_*`
- [ ] **Authentication → URL Configuration:** Site URL `https://belizelistings.bz`; allow redirect URLs per [auth-production-config.md](./auth-production-config.md)

---

## 5. RPC permission summary (post 3.7 hardening)

| Function | anon | authenticated | service_role |
|----------|------|---------------|--------------|
| `create_inquiry_with_conversation` | ✅ EXECUTE | ✅ EXECUTE | ✅ |
| `append_listing_event` | — | ✅ | ✅ |
| `apply_listing_verification_with_event` | — | ✅ | ✅ |
| `deliver_notification(uuid)` | — | **revoked (3.7)** | ✅ |
| `process_notification_queue_batch(int)` | — | **revoked (3.7)** | ✅ |
| `is_admin()` | — | ✅ | ✅ |

**Implication:** Notification queue processing must use service role (cron API route or admin script). Authenticated clients cannot drain the queue directly.

Guest inquiry path when `NEXT_PUBLIC_BL_ENABLE_TURNSTILE=true`: browser → `/api/inquiries/create` → service role RPC (listing owner resolved server-side).

---

## 6. Verification scripts (post-deploy)

```bash
node scripts/verify-crm-activation.mjs
node scripts/validate-marketplace-workflow.mjs
node scripts/verify-notification-delivery.mjs --recipient=<agent-uuid> --cleanup
node scripts/audit-crm-integrity.mjs
node scripts/audit-notification-queue.mjs
```

---

## 7. CI / release gates

```bash
npm test
npm run build
npm run qa          # mobile + desktop + screenshots; lighthouse optional
```

---

## 8. Go / no-go

| Gate | Pass criteria |
|------|---------------|
| Migrations | All 12 applied without error |
| Flags | Staged rollout documented; no flag enabled without its migration |
| Cron | `CRON_SECRET` set; health dashboard shows low failed queue count |
| Security | Turnstile on for public guest leads (recommended before Public Beta) |
| Health | `/admin/marketplace-health` green for CRM + notification metrics |

See [platform-freeze-v1.7.0.md](./platform-freeze-v1.7.0.md) for maturity assessment (Private Beta vs Public Beta vs Production Ready).
