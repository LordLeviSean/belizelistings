# Phase 4.0 — Communication Layer & Profile Completion

Profile contact lives on `public.profiles`, not on individual listings. Listings resolve buyer-facing contact via `get_listing_owner_public_contact(listing_id)`.

## Migration

Apply `supabase/migrations/20260701120000_profile_contact_and_completion.sql`:

- **profiles columns:** `phone`, `whatsapp`, `brokerage_name`, `brokerage_phone`, `contact_email_display`, `show_email_public`, `show_phone_public`, `profile_completed_at`
- **RPC:** `get_listing_owner_public_contact(p_listing_id bigint)` — privacy-respecting owner contact for approved/published listings

CRM tables (`conversations`, `messages`, `viewing_requests`) are **not** duplicated — reuse Phase 3.2 foundation.

## Feature flags

| Env | Purpose |
|-----|---------|
| `NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS=1` | In-app inbox (agent + user Messages tab), "Message via BelizeListings" in contact modal |
| `NEXT_PUBLIC_BL_ENABLE_INQUIRIES=1` | Legacy inquiry lists alongside conversations |

## Profile completion

- **Required:** phone (≥7 digits) before submit-for-review
- **Email:** from auth / `profiles.email` (read-only in UI)
- **Optional:** WhatsApp, brokerage name/phone, public visibility toggles
- Existing users: soft banner on dashboard + profile tab; no account recreation

## v1 limitations

- No real-time inbox push (poll/refresh on tab focus)
- Buyer inbox reuses agent thread UI; no rich attachments
- Public contact RPC only for publicly visible listings
- Guest messaging still flows through existing inquiry modals + Turnstile path when enabled
