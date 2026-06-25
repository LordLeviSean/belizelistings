# Admin Operations Foundation

**Last updated:** June 25, 2026  
**Sprint:** Phase 2 — Sprint 2.1 (listing verification)  
**Code tag:** `v1.1.1` / `b50499f`

This document describes the **reference implementation** for admin listing trust actions and the reusable patterns for future operator workflows.

---

## Verification workflow (reference implementation)

### Data model

| Column | Type | Purpose |
|--------|------|---------|
| `listings.verification_status` | `text` | Card badge source of truth (`verified` / `unverified`) |
| `listings.verified_at` | `timestamptz` | When verification was stamped; `NULL` on revoke |
| `listings.verified_by` | `uuid` → `profiles.id` | Admin who verified; `NULL` on revoke |

**Migrations:**

1. `supabase/migrations/20260625120000_listing_verification_status.sql` — column, owner-role backfill, insert trigger, public agent/broker profile RLS
2. `supabase/migrations/20260625130000_listing_verification_metadata.sql` — `verified_at` / `verified_by` + FK

**Default on insert:** `set_listing_verification_status()` trigger sets `verified` when owner profile role is `agent`, `broker`, or `admin`; otherwise `unverified`. Admin can override at any time.

### UI surfaces

| Surface | Behavior |
|---------|----------|
| **`ListingCard`** | Badge from `listing.verification_status` only via `isListingCardVerified()` — never owner role at render time |
| **`AllListingsPanel`** | Admin rows show Verified / Unverified chip + `AdminListingTrustAction` |
| **`AdminListingTrustAction`** | Verify (immediate) / Remove verification (confirm modal) |

### Mutation contract

`src/lib/listingVerificationMutations.js`:

- **`buildListingVerificationPatch({ verified, adminUserId })`** — PATCH payload only; no unrelated fields
- **`applyListingVerificationAction({ listingId, verified, adminUserId, client })`** — Supabase update + select

Verify sets:

```js
{ verification_status: "verified", verified_at: ISO, verified_by: adminUserId }
```

Unverify clears metadata:

```js
{ verification_status: "unverified", verified_at: null, verified_by: null }
```

Payloads pass through `sanitizeListingMutationPayload` before write.

### Access control

- **UI:** `AdminListingTrustAction` renders only when `useUserRole().role === "admin"`.
- **Database:** Existing **Admins full access** listings RLS policy allows admin PATCH on `listings`.
- **Public read:** `verification_status` is included in public listing selects; badge is non-sensitive.

---

## Reusable admin patterns

Future ops (Feature/Unfeature, Approve/Reject, Archive/Restore, Sold/Available, Rented/Available) should follow the same slot architecture.

### 1. `AdminListingTrustAction`

**File:** `src/components/admin/AdminListingTrustAction.jsx`

Pattern:

- Props: `listing`, `busy`, `onBusyChange`, `onUpdated`, `onAction`, `layout` (`inline` | `compact`)
- Role gate at top (`return null` if not admin)
- Dedicated mutation module (never inline Supabase in the panel)
- Optimistic local patch via `onUpdated` with server response fields
- Toast success/error via `useToast`
- Verify = one click; destructive/revoke = confirm modal

### 2. `AdminListingActionConfirmModal`

**File:** `src/components/admin/AdminListingActionConfirmModal.jsx`

- Shell copied from `ArchiveListingModal` (focus trap, body scroll lock, escape to close)
- Props: `open`, `title`, `body`, `helper`, `confirmLabel`, `busy`, `onClose`, `onConfirm`
- Reuse for any irreversible or trust-sensitive admin action

### 3. `*Mutations.js` modules

Naming: `listingVerificationMutations.js` → `listingFeatureMutations.js`, `listingLifecycleMutations.js`, etc.

Each module exports:

1. **`build*Patch(...)`** — pure payload builder
2. **`apply*Action({ listingId, ..., client })`** — single Supabase `.update().eq("id").select(...).maybeSingle()`

Rules:

- Touch **only** the columns for that action
- Use `sanitizeListingMutationPayload` + `LISTING_MUTATION_FLOW`
- Return `{ ok, data?, error? }` — never throw to UI
- Unit-test patch builders; mock client for apply guards

### 4. Panel integration

In dashboard listing rows (e.g. `AllListingsPanel`):

```jsx
<AdminListingTrustAction
  listing={listing}
  busy={rowBusy}
  onBusyChange={setRowBusy}
  onUpdated={(patch) => mergeListingInState(patch)}
  onAction={(label) => appendAdminActivity(label)}
/>
```

Keep row state as listing objects; merge patches immutably.

---

## Database operations

### Apply migrations (remote)

**Preferred — linked CLI:**

```bash
npx supabase login
npx supabase link --project-ref xyepbzezoroaeagzzzui
npx supabase db push --linked
```

**Alternative — connection string:**

Add to `.env.local`:

```
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Then:

```bash
node scripts/apply-supabase-migrations.mjs
```

**Alternative — Management API:**

```
SUPABASE_ACCESS_TOKEN=sbp_...
NEXT_PUBLIC_SUPABASE_URL=https://xyepbzezoroaeagzzzui.supabase.co
node scripts/apply-supabase-migrations.mjs
```

**Manual:** Supabase Dashboard → SQL Editor → paste each migration file in order.

### Verification audit

Requires **`SUPABASE_SERVICE_ROLE_KEY`** in `.env.local` (anon key is RLS-limited and cannot read all owner profiles).

```bash
node scripts/audit-listing-verification.mjs
```

Report sections:

- `totals.total`, `totals.verified`, `totals.unverified`
- `anomaly_buckets` — trusted roles still unverified, missing profile, missing user_id
- `anomalies[]` — up to 50 rows with `id`, `reason`, `owner_role`

**Do not auto-fix anomalies** in production without human review.

---

## Future admin operations (planned)

| Operation | Target columns (indicative) | Confirm modal? |
|-----------|----------------------------|----------------|
| Feature / Unfeature | `featured`, `featured_at`, `featured_by` | Unfeature yes |
| Approve / Reject | `lifecycle_status`, `reviewed_at`, `reviewed_by` | Reject yes |
| Archive / Restore | `archived_at`, `archived_by` | Archive yes |
| Sold / Available | `occupancy_status`, `sold_at` | Mark sold yes |
| Rented / Available | `occupancy_status`, `rented_at` | Mark rented yes |

Each should get:

1. Migration (if new columns)
2. `build*Patch` / `apply*Action` module
3. `AdminListing*Action` component (or generalized `AdminListingLifecycleAction` with `action` prop)
4. Audit script variant
5. Entry in this doc

---

## Dashboard framework vision

Shared shell for **User / Agent / Broker / Operator / Admin** roles:

```
DashboardLayout (nav, role-aware sections)
  └── ListingManagementPanel (shared table/card rows)
        └── AdminActionSlots[]  ← inject per role
              ├── AdminListingTrustAction      (admin)
              ├── AgentUpgradeActions          (admin)
              ├── OperatorOccupancyActions     (operator, future)
              └── OwnerQuickActions            (owner)
```

Principles:

- **One listing row component** — role-specific actions as slots, not forked panels
- **Mutations isolated** — panel never constructs raw payloads
- **Card parity** — admin preview uses same `ListingCard` + `verification_status` as public
- **Calm luxury** — reuse `Dashboard.module.css`, `ListingTrustStrip.module.css`, existing modal shells

---

## Sprint 2.1 production checklist

| Step | Command / action | Required env |
|------|------------------|--------------|
| Apply migrations | `node scripts/apply-supabase-migrations.mjs` | `DATABASE_URL` or `SUPABASE_ACCESS_TOKEN` |
| Audit verification | `node scripts/audit-listing-verification.mjs` | `SUPABASE_SERVICE_ROLE_KEY` |
| Unit tests | `npm test` | — |
| Production build | `npm run build` | Supabase URL + anon key |
| QA smoke | `npm run qa` | Optional: `QA_EMAIL`, `QA_PASSWORD` |

### Blockers (June 25, 2026 audit run)

If `.env.local` contains only `NEXT_PUBLIC_SUPABASE_*`:

- Migrations **cannot** be applied programmatically (need `DATABASE_URL`, `SUPABASE_ACCESS_TOKEN`, or linked Supabase CLI)
- Full verification audit **cannot** enumerate owner roles (anon RLS hides non-public profiles)
- Live admin verify/unverify **cannot** be E2E-tested without admin session + applied schema

Add to `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Settings → API → service_role (secret)
# Optional for migrations:
DATABASE_URL=postgresql://...
# or
SUPABASE_ACCESS_TOKEN=sbp_...
```

---

## Related files

| File | Role |
|------|------|
| `src/lib/listingVerificationMutations.js` | Verify/unverify PATCH |
| `src/components/admin/AdminListingTrustAction.jsx` | Admin UI control |
| `src/components/admin/AdminListingActionConfirmModal.jsx` | Confirm shell |
| `src/utils/listingVerification.js` | Card/admin label helpers |
| `src/components/ListingCard.jsx` | Public badge |
| `scripts/audit-listing-verification.mjs` | Post-migration audit |
| `scripts/apply-supabase-migrations.mjs` | Migration runner |
