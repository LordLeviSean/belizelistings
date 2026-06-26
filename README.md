# BelizeListings Frontend

Next.js marketplace frontend for [BelizeListings.BZ](https://belizelistings.bz) — property discovery, listing detail, agent dashboards, and admin trust workflows. Data layer: Supabase (Auth, Postgres, Storage, Realtime).

---

## Platform overview

| Phase | Status | Doc |
|-------|--------|-----|
| Foundation (v1.4.0) | ✅ Frozen | [Platform Foundation](./docs/platform/milestone-platform-foundation-complete.md) |
| Phase 3 marketplace | ✅ v1.7.0 freeze | [Platform freeze v1.7.0](./docs/platform/platform-freeze-v1.7.0.md) |
| Production checklist | 📋 | [Production readiness](./docs/platform/production-readiness-checklist.md) |

**Frozen public surfaces:** Homepage, ListingCard DNA, listing detail (desktop + mobile). Marketplace features (CRM, notifications, timeline, security) ship behind `NEXT_PUBLIC_BL_*` feature flags.

Full platform doc index: [docs/platform/README.md](./docs/platform/README.md)

---

## Environment setup

1. Copy the template: `cp .env.example .env.local` (Windows: copy `.env.example` to `.env.local`).
2. In the [Supabase dashboard](https://supabase.com/dashboard) → **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only)
3. **Public vs server-only:** Variables prefixed with `NEXT_PUBLIC_` are embedded in the client bundle at build time. Never put the service role key in a `NEXT_PUBLIC_` variable.
4. **Never commit** `.env.local` — use `.env.example` as the documented template.

Optional variables (feature flags, QA, Turnstile, cron) are documented in `.env.example` and [production-readiness-checklist.md](./docs/platform/production-readiness-checklist.md).

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm test` | Jest unit tests |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run qa` | Full QA (mobile, desktop, screenshots, optional lighthouse) |
| `npm run qa:mobile` | Mobile viewport checks |
| `npm run qa:desktop` | Desktop viewport checks |

**Migrations:** `node scripts/apply-supabase-migrations.mjs` — see [admin-operations.md](./docs/admin-operations.md).

**Marketplace verification:** See [marketplace-activation-v1.6.5.md](./docs/platform/marketplace-activation-v1.6.5.md).

---

## Milestone tags

| Tag | Milestone |
|-----|-----------|
| `v1.4.0-platform-foundation` | Frozen public surfaces |
| `v1.6.0-crm-foundation` | CRM schema + inbox |
| `v1.6.5-marketplace-activation` | Staged flags + health dashboard |
| `v1.6.6-notification-delivery` | Notifications inbox + cron |
| `v1.6.7-marketplace-security` | Turnstile, rate limits, RPC hardening |
| `v1.7.0-platform-freeze` | Phase 3 Final stabilization |

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

---

## Architecture

- [BELIZELISTINGS_ARCHITECTURE.md](./docs/BELIZELISTINGS_ARCHITECTURE.md)
- [Phase 3 program](./docs/platform/phase-3-program.md)

---

## Deploy

Production deploys via Netlify. After env changes (especially feature flags), trigger a redeploy. Schedule cron for `/api/cron/process-notifications` when notifications are enabled — see [production-readiness-checklist.md](./docs/platform/production-readiness-checklist.md).
