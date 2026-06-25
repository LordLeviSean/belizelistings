# Sprint 2.3 — Listing Detail Page (Mobile Optimization)

Phase 2 deliverable for the public listing detail surface (`/listing/[id]`). Homepage v1.0 remains frozen.

## Goals

- Reduce mobile gallery vertical footprint (target ≤800px gallery block)
- Clarify trust vs status signals on the detail page
- Normalize unstructured listing descriptions for readability and tap-to-call / external links
- Improve mobile conversion with a sticky contact bar

## P0 — Implemented

### Swipeable image gallery

**Before:** Hero image plus a wrapping thumbnail grid that could grow to 4×4 (16 thumbs), pushing listing content far below the fold on mobile.

**After:**

- Hero remains swipeable with `1 / N` counter overlay (existing touch handlers retained)
- Tap hero opens the existing fullscreen lightbox
- **Mobile:** Single horizontal thumbnail strip — four visible thumbs plus a `+N` overflow chip that opens the lightbox or selects the next photo
- **Desktop:** Unchanged wrapping thumbnail row
- Mobile hero capped at `min(42vh, 360px)`; gallery column capped at `min(800px, calc(42vh + 88px))`

Files: `src/pages/listing/[id].js`, `src/styles/ListingDetail.module.css`

### Trust layer refinement

- **Verified Listing** badge (sea-glass styling, `BadgeCheck` icon) rendered separately from status chips
- Uses `isListingCardVerified()` / `listing.verification_status` only
- Unverified listings show no alarming badge on the detail page (status chips only)
- Removed **Verified inventory signal** from mixed public trust chips in `buildPublicListingTrustChips()`

Files: `src/components/listing/ListingTrustStrip.jsx`, `ListingTrustStrip.module.css`, `src/utils/trustSignals.js`

### Description normalization

New utility and renderer:

- `src/lib/listingDescriptionFormat.js` — parses headings (Overview, Highlights, Features, Additional Notes), bullet lists, phone → `tel:`, URLs → external links
- `src/components/listing/ListingDescriptionContent.jsx` — React renderer with overflow-safe typography
- Tests: `src/lib/listingDescriptionFormat.test.js`

## P1 — Implemented

### Share button placement

- On viewports ≤520px, `ListingContactActions` becomes a fixed bottom bar with Contact agent, Schedule viewing, and Share
- In-flow spacer preserves layout; safe-area padding for notched devices

### Density & spacing

- Slightly reduced highlight chip and info card padding on mobile
- Detail body bottom padding increased to 36px plus sticky bar spacer (~84px)

Files: `ListingContactActions.module.css`, `ListingDetail.module.css`

## P2 — Not implemented (future)

- **Listing Trust Panel** — market status, price history, verification timeline. Document as extension point only; no UI shipped in this sprint.

## QA checklist

- [ ] Mobile 390–430px: gallery ≤800px tall, horizontal thumb strip, swipe hero
- [ ] Verified listing shows sea-glass **Verified Listing** badge separate from status chips
- [ ] Description phone numbers and URLs are tappable
- [ ] Sticky contact bar visible on mobile; desktop layout unchanged
- [ ] `npm test`, `npm run build`, `npm run qa:mobile`

## Related

- Card verification DNA: `src/components/ListingCard.jsx`, `HomeMapFirst.module.css` (unchanged)
- Verification source of truth: `src/utils/listingVerification.js`
