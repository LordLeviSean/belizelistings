# BelizeListings — System Rules

**Purpose:** Platform governance and implementation rules for engineers and AI assistants. Not a branding deck. Treat as **required context** before structural, data, or visual work.

---

## 1. Platform DNA

- Calm tropical intelligence — clarity over noise.
- Premium Belize editorial atmosphere — purposeful copy and layout.
- Sea-glass / lagoon / sand palette — cohesive, natural, light-forward.
- Soft depth, not dark cyberpunk — avoid harsh contrast and tech-noir defaults.
- Readable typography first — hierarchy and legibility over decoration.
- No random gradients; no random neon.
- No hard black panels; no generic SaaS template aesthetics.
- Every new feature must feel **native** to the homepage / map atmosphere — same world, same craft.

---

## 2. Design Rules

- **Token system first** — design tokens before ad-hoc values.
- **No hardcoded colors** unless explicitly approved for a scoped exception.
- **Preserve globally:** navbar behavior, pill/button language, card spacing rhythm.
- **No visual drift** between dashboard, home, listing detail, and admin — one product.
- **No MUI-looking controls**; **no default browser styling** for interactive UI.
- **No sharp-corner UI** unless a deliberate, documented exception.
- **Maintain BelizeListings glass language** — frosted layers, calm borders, consistent depth.

---

## 3. Data Architecture Rules

- **`listings` is the canonical inventory source** for published and in-flight listing rows.
- **`amenities` (array) is canonical** for structured tags; **`features` (text) is legacy compatibility only** — do not treat CSV as the source of truth for new work.
- **`listing_images` owns gallery/media** — not blob columns on `listings`.
- **Mutation payloads must align with `ALLOWED_LISTINGS_COLUMNS`** (`src/constants/listingsSchemaAllowlist.js`); **unknown fields must be stripped** before insert/update (see `sanitizeListingMutationPayload`).
- **Never introduce columns casually** — every schema change ships via **migration files** and is reflected in the allowlist when the column is live.
- **No `property_id` on `listings`** — ownership/linkage follows established patterns; do not revive property FK on listing rows.
- **`unit_id` is preserved** for operator / unit architecture — linking listings to internal units stays in scope.

---

## 4. Land Listing Rules

- **Land listings use `null` for `beds` / `baths` / `garage`** — not zero sent as “real” counts.
- **Listing cards never show `0 bd` / `0 ba`** — hide residential meta when counts are absent or non-positive; land uses **land presentation mode**.
- **Land filters bypass residential assumptions** — room counts and similar filters must not incorrectly exclude or mis-label land inventory.

---

## 5. UX Rules

- **Create listing flow** is driven only by **Back**, **Continue**, and **Save draft** — not ad-hoc navigation that skips persistence rules.
- **Stage pills are informational**, not primary navigation.
- **Autosave on controlled transitions** only — avoid silent saves on every keystroke unless product explicitly requires it.
- **Avoid full-page scrolling on desktop** in the create workspace where the layout is designed as a contained stage.
- **Operational states** (loading, success, errors, queues) must feel **calm and premium** — no alarmist or stock patterns.
- **All modals** must match BelizeListings DNA (tokens, glass, typography, spacing).

---

## 6. Cursor / Agent Behavior Rules

- **Do not redesign unrelated areas** during bugfixes or small tasks.
- **Do not introduce new architecture** without checking existing patterns, files, and this document.
- **Prefer extending** shared systems over replacing them.
- **Preserve backwards compatibility** unless a migration and product sign-off are explicit.
- **Avoid one-off components** and **duplicate styling systems** — consolidate or extend.
- **Avoid logic drift** between homepage, dashboard, and admin — one mental model for lifecycle, visibility, and inventory.

---

## 7. Future Direction

Directional priorities (not a commitment order):

- Operator inventory intelligence.
- Real estate editorial platform depth.
- Scheduling and messaging integration.
- Moderation pipeline maturity.
- District intelligence.
- Inventory analytics.
- Developer and operator tooling.
- Longer term: a coherent **real estate intelligence ecosystem** built on this inventory core.

---

*Last implied stack references: allowlist and sanitization live under `src/constants/listingsSchemaAllowlist.js` and `src/lib/listingPayloadSanitize.js`. Update both when production `listings` columns change.*
