# Notification Delivery v1.6.6 — Milestone 3.6

**Tag:** `v1.6.6-notification-delivery`  
**Baseline:** Marketplace Activation v1.6.5 (`v1.6.5-marketplace-active`)  
**Program:** [phase-3-program.md](./phase-3-program.md)  
**Design proposal:** [notification-framework-architecture.md](./proposals/notification-framework-architecture.md)

---

## Summary

Milestone 3.6 closes the inquiry notification loop: `notification_queue` rows are processed into a durable `notifications` inbox via SECURITY DEFINER RPCs. `NotificationCenter` reads the inbox when `NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS=true`, with legacy moderation/upgrade polls retained as fallback.

---

## Architecture (refinements vs proposal)

| Layer | Table / module | Role |
|-------|----------------|------|
| **Enqueue** | `notification_queue` | Async pipeline; writers unchanged (RPC + JS mutations) |
| **Deliver** | `deliver_notification`, `process_notification_queue_batch` | SECURITY DEFINER; idempotent upsert via `dedupe_key` |
| **Inbox** | `notifications` | Durable in-app store; RLS recipient + admin read |
| **Copy** | `notificationCopyRegistry.js` + SQL mirror | Editorial titles; calm luxury tone |
| **UI** | `NotificationCenter` hybrid | Primary = notifications when flag on; legacy polls for moderation/admin |
| **Email** | Stub | Queue processor marks `email_channel: skipped` when `RESEND_API_KEY` unset |

**Improvements over original proposal:**

1. **`entity_id` as text** — supports bigint listing ids and uuid conversation ids without cast friction.
2. **Explicit batch processor** — no after-insert trigger; ops control via cron/API.
3. **Hybrid NotificationCenter** — staged cutover; inquiry poll disabled only when flag on.
4. **Email via API route** — no edge function required for MVP; Resend wired in rollout doc.
5. **Dedupe key column** — partial unique index `(recipient_user_id, dedupe_key)` instead of payload-only dedupe.

---

## Migration

Apply (once per environment):

```bash
npx supabase link --project-ref <ref>
npx supabase db push --linked --yes

# Or direct:
node scripts/apply-supabase-migrations.mjs 20260627120000_notification_delivery.sql
```

**Verify:**

```bash
node scripts/verify-notification-delivery.mjs --recipient=<agent-user-uuid> --cleanup
node scripts/audit-notification-queue.mjs
```

---

## Feature flag rollout (Stage 4)

| Stage | Variable | Enables | Prerequisite |
|-------|----------|---------|--------------|
| **4** | `NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS=true` | Durable inbox in NotificationCenter, post-enqueue delivery | Stages 1–3 CRM flags + migration applied |

**Recommended order:** CRM Stages 1–3 (v1.6.5) → apply notification migration → enable Stage 4 → redeploy.

### Local dev

```
NEXT_PUBLIC_BL_ENABLE_INQUIRIES=true
NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS=true
NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST=true
NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS=true
```

### Netlify

Add `NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS=true` after migration; rebuild.

---

## Operations

### Process pending queue (cron)

Schedule `GET` or `POST` to `/api/cron/process-notifications` every 1–5 minutes.

Set `CRON_SECRET` in env; pass as `Authorization: Bearer <secret>` or `x-cron-secret` header.

### Admin manual drain

`POST /api/notifications/process-queue` with admin JWT (Bearer token).

Body: `{ "limit": 50 }`

### Email (future)

When `RESEND_API_KEY` is set, extend `deliverNotifications.js` or API route to send transactional email after in-app delivery. MVP marks channel skipped.

---

## Event wiring

| Trigger | Enqueue | Deliver |
|---------|---------|---------|
| `create_inquiry_with_conversation` RPC | SQL insert | `triggerNotificationDelivery` after RPC (inquiryMutations) |
| `sendAgentReply` | JS enqueue | `deliverAfterEnqueue` when flag on |
| `confirmViewing` / `cancelViewing` | JS enqueue | `deliverAfterEnqueue` when flag on |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Pending queue backlog | Cron batch + admin health metrics |
| Duplicate notifications | `dedupe_key` unique index + ON CONFLICT upsert |
| Flag/build mismatch | Default false; document Netlify rebuild |
| Realtime publication missing | Graceful poll on drawer open |
| PII in titles | Copy registry uses generic editorial text |

---

## Related

- [marketplace-activation-v1.6.5.md](./marketplace-activation-v1.6.5.md)
- [crm-foundation-v1.6.md](./crm-foundation-v1.6.md)
