# UI layout rules (anti-breakage)

Structural rules for BelizeListings frontend. **Not** a visual design guide.

---

## NON-NEGOTIABLE RULES

1. **Images**
   - MUST be inside fixed containers (or flex/grid slots with definite size + `min-width`/`min-height: 0` as needed).
   - NEVER define layout by intrinsic image dimensions.

2. **Flex**
   - Any flex row that includes shrinkable content or text MUST include `min-width: 0` on the correct items (use global helpers `.safeFlexRow` / `.safeFlexCol` where appropriate).

3. **Layout**
   - Use **one** primary layout system per section (flex **or** grid at that level); avoid competing constraints.

4. **Overflow**
   - No horizontal overflow in listing flows; `overflow-x: hidden` on list rails.
   - `overflow: hidden` only when intentional (document with a short CSS comment).

5. **Cards**
   - Fixed image zones only; no dynamic resizing from asset dimensions.

---

## 1. Images

- Every raster image (`<img>`, `ListingImage`, or `next/image` if introduced) **must** live inside a **layout-owned** box that defines size before the image loads:
  - **Fixed `width` + `height`**, or
  - **`aspect-ratio` + one dimension**, or
  - **Flex/grid area** with **`min-height: 0`** / **`min-width: 0`** so percentage sizing resolves predictably.
- That box **must** use **`overflow: hidden`** when using **`object-fit: cover`** (cropping), or a clear letterboxing strategy for **`contain`**.
- In **horizontal flex rows**, the image wrapper **must** use **`flex-shrink: 0`** (fixed slot) or **`min-width: 0`** on the correct flex item so intrinsic image width cannot expand the row.
- The image element **must** use **`object-fit: cover` or `contain` intentionally**, with **`max-width: 100%`** and **`max-height: 100%`** where the parent is bounded.
- **Forbidden:** relying on the image’s intrinsic width/height to size the layout; unconstrained `width/height: 100%` without a sized parent.

---

## 2. Layout

- Each major section should use **one primary layout model** (flex **or** grid). Nesting is fine; **avoid** competing constraints (e.g. grid child that also behaves like an unconstrained flex item without `min-width: 0`).
- **Any flex item that holds text or a flex row that can shrink** **must** include **`min-width: 0`** (or `overflow: hidden` + ellipsis only where truncation is intended) so text does not force overflow.
- Scroll regions **must** declare **`overflow-y`** / **`overflow-x`** explicitly; do not depend on accidental clipping from a distant parent.

---

## 3. Listing cards (`ListingCard`)

- **Single component:** all browse/list surfaces use `src/components/ListingCard.jsx` + `ListingCard.module.css` only.
- **Thumb:** fixed pixel (or fixed aspect) zone only; **no** percentage-based thumb sizing tied to image natural dimensions.
- **Text:** single-line ellipsis pattern: `min-width: 0` on the text column, `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`.
- **No** page-level `:global()` overrides of card internals except documented, reviewed cases (prefer module composition over global overrides).

---

## 4. Scrolling

- **Listing lists:** vertical scroll only on the designated list scroller; **`overflow-x: hidden`** on the list rail and card row.
- **No horizontal scroll** as a baseline acceptance criterion for listing flows.

---

## 5. Forbidden patterns (flag in review)

- **`height: 100vh` / `100dvh`** on a root page without **`min-height: 0`** on flex/grid children and a defined scroll strategy (mobile URL bar, nested scroll).
- **`overflow: hidden`** on large “layout shells” without a documented reason (prefer clip only where needed, put scroll on inner panes).
- **`object-fit`** on an image whose parent chain does not establish a **definite** used size for that image.
- **Mixing** arbitrary Tailwind layout utilities with module CSS **for the same surface** without a single source of truth (harder audits, double constraints).

---

## 6. Listing list rails (consistency)

- Listing stacks use **`max-width: 640px`**, **`margin: 0 auto`**, **`width: 100%`**, **`min-width: 0`**, and **`overflow-x: hidden`** on the list container (or equivalent parent that owns horizontal safety).

---

## 7. Change process

- Any new image or card layout **must** be checked against sections 1–4 before merge.
- If a rule must be broken, document **why** in the PR and add a follow-up ticket to restore compliance.
