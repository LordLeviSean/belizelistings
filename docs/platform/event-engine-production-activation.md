# Event Engine — Production Activation (Milestone 3.1B)

**Status:** Production active (database + dev flag)  
**Version:** v1.5.1-property-history  
**Activation date:** June 26, 2026  
**Baseline commit:** `04ea1c6`

---

## Summary

Milestone 3.1B activates the **Marketplace Event Engine** in production Supabase: append-only `listing_events`, RPC entry points, historical backfill, and the public **Property History** timeline on listing detail. No new product features — rollout and verification only.

---

## Deployment checklist

### 1. Database migrations

Apply in order (already on remote as of 2026-06-26):

| Migration | Purpose |
|-----------|---------|
| `20260625120000_listing_verification_status.sql` | `verification_status` column + insert trigger |
| `20260625130000_listing_verification_metadata.sql` | `verified_at` / `verified_by` |
| `20260626120000_listing_events.sql` | `listing_events` table, RLS, immutability triggers, RPCs |

**Apply methods (first match wins):**

```bash
# Linked project (used for production rollout)
npx supabase link --project-ref xyepbzezoroaeagzzzui
npx supabase db push --linked --yes

# Or direct Postgres
node scripts/apply-supabase-migrations.mjs 20260626120000_listing_events.sql

# Requires DATABASE_URL or SUPABASE_ACCESS_TOKEN in .env.local
```

**Production schema note:** Production `listings.id` is `bigint` (not `uuid`). Migration `20260626120000` uses `listing_id bigint` to match.

### 2. Feature flag

| Environment | Variable | Value |
|-------------|----------|-------|
| Local dev | `.env.local` | `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS=true` |
| **Netlify production** | Site env | `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS=true` |

Rebuild/redeploy after setting the Netlify variable (`NEXT_PUBLIC_*` is inlined at build time).

Default when unset: **false** (safe when migration not applied). See `src/lib/featureFlags.js`.

### 3. Historical backfill

```bash
node scripts/backfill-listing-events.mjs --dry-run
node scripts/backfill-listing-events.mjs
```

Idempotent: skips rows where `listing_id + event_type + source=migration_backfill` already exist. Production listings without `published_at` infer **published** from `status`/`lifecycle_status` + `reviewed_at`.

### 4. Verification scripts

```bash
node scripts/verify-listing-events-db.mjs
node scripts/audit-verification-workflow.mjs
node scripts/simulate-verification-workflow.mjs   # service-role event simulation
```

---

## Rollout results (2026-06-26)

### Migration

| Check | Result |
|-------|--------|
| `listing_events` table | ✅ Created |
| Indexes | ✅ `listing_occurred`, `type`, `created_at`, correlation unique |
| RLS | ✅ public / owner / admin SELECT |
| UPDATE/DELETE triggers | ✅ Rejected with append-only message |
| `append_listing_event()` | ✅ Idempotent via `correlation_id` |
| `apply_listing_verification_with_event()` | ✅ Deployed; requires admin JWT |

Initial `db push` failed on `uuid` FK mismatch; fixed to `bigint` and re-applied successfully.

### Backfill

| Metric | Value |
|--------|-------|
| Listings scanned | 3 |
| Events attempted | 7 |
| Events inserted | 6 |
| Skipped (idempotent) | 1 |
| Duration | ~3.4s |
| Errors | 0 |

**Event totals after backfill + QA probes:**

| Event type | Count |
|------------|-------|
| `listing.created` | 3+ (per listing) |
| `listing.published` | 3 |
| `listing.verification.approved` | 1+ (backfill + workflow tests on listing 88) |

All 3 listings have timelines; 0 orphaned.

### Verification workflow

| Step | Result |
|------|--------|
| Verify → `listing.verification.approved` (public) | ✅ Fields set; event appended |
| Remove → fields cleared + `listing.verification.removed` (internal) | ✅ |
| Verify → Remove → Verify | ✅ No spurious duplicate events from single action |
| `apply_listing_verification_with_event` via service role | ✅ Correctly rejected (`admin authorization required`) |
| Admin JWT E2E (UI path) | ⚠️ Blocked — add `QA_EMAIL` / `QA_PASSWORD` for admin user to `.env.local` |

### Property History QA

Screenshots: `qa-screenshots/event-engine-rollout/`

- `desktop-timeline-collapsed.png` / `desktop-timeline-expanded.png`
- `mobile-timeline-collapsed.png` / `mobile-timeline-expanded.png`

Captured against local build (`http://localhost:3005/listing/86`) with flag enabled.

### QA suite

| Step | Result |
|------|--------|
| `npm test` | ✅ 33 suites / 189 tests |
| `npm run build` | ✅ |
| `npm run qa` | ✅ After `npx playwright install chromium` |

---

## Architecture references

- `src/lib/listingEvents/writeListingEvent.js` — single append entry point (respects flag)
- `src/lib/listingEvents/fetchListingTimeline.js` — public timeline read
- `src/components/listing/ListingTimelinePanel.jsx` — collapsible UI, lazy load, sessionStorage
- `src/lib/listingVerificationMutations.js` — atomic verification RPC + fallback
- `docs/platform/phase-3-program.md` — Workstream A milestones

---

## Remaining production step

Set **`NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS=true`** in **Netlify** and trigger a production deploy so the live site serves Property History with the flag inlined at build time.

---

## Credentials reference

| Variable | Required for |
|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | All scripts |
| `SUPABASE_SERVICE_ROLE_KEY` | Backfill, audits |
| `DATABASE_URL` or `SUPABASE_ACCESS_TOKEN` | `apply-supabase-migrations.mjs` (alternative to `db push`) |
| `QA_EMAIL` / `QA_PASSWORD` | Admin JWT verification E2E |

Do **not** commit `.env.local`.
