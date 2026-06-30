# Auth production configuration — Phase 3.9

Configure Supabase Authentication and Netlify so email confirmation and password reset links land on **https://belizelistings.bz**, not localhost.

**Related:** [production-readiness-checklist.md](./production-readiness-checklist.md) · [.env.example](../../.env.example)

---

## Root cause (localhost redirects)

Verification emails were redirecting to `http://localhost:3000/#access_token=…` because:

1. **`signUp()` / `resend()` did not pass `emailRedirectTo`** — Supabase fell back to the Dashboard **Site URL** (often still set to localhost from development).
2. **`resetPasswordForEmail()` used a hardcoded localhost redirect** in `forgot-password.jsx`.
3. **No `/auth/callback` route** existed to consume hash tokens or PKCE codes on production.

The frontend now builds redirect URLs from `NEXT_PUBLIC_SITE_URL` via `getAuthRedirectUrl()` in `src/lib/siteUrl.js`. Production builds **never** fall back to localhost.

---

## Netlify environment variables

Set in **Site settings → Environment variables** (Production context):

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SITE_URL` | `https://belizelistings.bz` | Required for correct auth email links at build/runtime |
| `NEXT_PUBLIC_SUPABASE_URL` | *(your project URL)* | Already required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(your anon key)* | Already required |
| `SUPABASE_SERVICE_ROLE_KEY` | *(server secret)* | Already required |

Redeploy after changing `NEXT_PUBLIC_*` vars (they are inlined at build time).

---

## Supabase Dashboard → Authentication → URL Configuration

Open your project → **Authentication** → **URL Configuration**.

### Site URL

```
https://belizelistings.bz
```

This is the default redirect when `emailRedirectTo` / `redirectTo` is omitted. Keep it aligned with `NEXT_PUBLIC_SITE_URL`.

### Redirect URLs (allow list)

Add every URL the app sends in auth emails. Minimum production set:

```
https://belizelistings.bz/auth/callback
https://belizelistings.bz/reset-password
https://belizelistings.bz/login
```

Development (optional, for local email testing):

```
http://localhost:3000/auth/callback
http://localhost:3000/reset-password
http://localhost:3000/login
```

Wildcards are supported if your Supabase plan allows them (e.g. `http://localhost:3000/**` for local dev).

---

## Frontend auth flow (after fix)

| Step | Route | Behavior |
|------|-------|----------|
| Sign up | `/login?signup=1` | `signUp({ options: { emailRedirectTo: https://belizelistings.bz/auth/callback } })` |
| Email link | `/auth/callback` | Parses hash tokens (`#access_token=…&type=signup`) or PKCE `?code=`, establishes session, runs `ensureProfile`, redirects to `/dashboard` |
| Password recovery link | `/auth/callback#…&type=recovery` (or `?type=recovery` with PKCE) | Redirects to `/reset-password` with active recovery session |
| Resend verification | Signup success modal | Same `emailRedirectTo` as sign-up |
| Forgot password | `/forgot-password` | `redirectTo: https://belizelistings.bz/auth/callback` |

---

## Email templates (optional check)

In **Authentication → Email Templates**, confirm links use Supabase’s `{{ .ConfirmationURL }}` (or equivalent) — do **not** hardcode localhost in custom templates.

---

## Manual QA checklist

After deploying with env + Supabase settings above:

- [ ] Sign up on production → confirmation email link host is `belizelistings.bz` (not localhost)
- [ ] Click confirmation link → lands on `/auth/callback` → redirects to `/dashboard` when session is valid
- [ ] Signup success modal shows **Back to Sign In** and **Resend Email** only (no Open Email)
- [ ] Resend verification → new email still uses production callback URL
- [ ] Forgot password → reset email uses production URL → recovery completes on `/reset-password`
- [ ] Expired/invalid link → `/auth/callback` shows error and sends user to `/login?verified=0`

---

## Code references

| File | Purpose |
|------|---------|
| `src/lib/siteUrl.js` | `getSiteUrl()`, `getAuthRedirectUrl()` |
| `src/lib/authCallback.js` | Pure helpers: link type, destinations, hash/query parsing (unit tested) |
| `src/pages/auth/callback.jsx` | Email link landing + session handoff |
| `src/pages/login.jsx` | Sign-up, resend, confirmation modal |
| `src/pages/forgot-password.jsx` | Password reset redirect |
| `src/constants/authRoutes.js` | `AUTH_CALLBACK_PATH` |
