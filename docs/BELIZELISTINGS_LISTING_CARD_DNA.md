# BelizeListings — Listing Card DNA

**Purpose:** Canonical design and interaction philosophy for **every** listing card surface on BelizeListings. This is a **protected system layer**: changes here affect brand trust and product coherence. Engineers and AI assistants must read this before altering card structure, media behavior, or create-flow preview.

**Related:** Platform-wide rules live in [`BELIZELISTINGS_SYSTEM_RULES.md`](./BELIZELISTINGS_SYSTEM_RULES.md). When guidance conflicts on **cards**, **this document wins**.

---

## Core philosophy

Listing cards should feel:

- **Editorial** — curated, calm, story-led.
- **Atmospheric** — sea-glass, lagoon light, Belize-native warmth.
- **Premium** — confident typography and spacing, not loud chrome.
- **Calm** — low noise, intentional whitespace.
- **Image-first** — photography leads; everything else supports.

They must **not** feel like:

- Generic ecommerce or MLS density.
- Aggressive marketplace UI or crowded dashboards.
- Template “real estate app” cards.

---

## Visual hierarchy

Priority order (highest → lowest):

1. **Photography**
2. **Favorite / share** (floating actions — part of product identity)
3. **Listing identity** (title + price)
4. **Location / meta**
5. **Navigation behavior** (gallery advance, link to detail — felt, not shouted)

Cards **breathe**. Whitespace is intentional. Avoid harsh UI chrome and boxed-in clutter.

---

## Media rules

### Desktop (fine pointer)

- **Invisible** prev/next hit zones only — no visible arrows or chevrons.
- **No** hover-only carousel controls (no arrow fade-in, no slider chrome).
- **Hidden, cinematic** interaction — editorial gallery, not a product carousel.
- **Center** of the image remains the natural **“open listing”** region.
- **Favorite + share stack** stays **visually dominant** (higher stacking, clear dead band for next-zone).

### Mobile / coarse pointer

- **Swipe-only** image navigation.
- **No** invisible click zones for gallery prev/next.
- **No** visible arrows.

### Dots

- **Editorial indicators** only — minimal, soft, non-interactive.
- They do not steal focus from photography or FABs.

### Image behavior

- Fast, optimized previews; sharp retina treatment where configured.
- **Consistent** `object-fit` / crop language across surfaces.
- **Calm** transitions — no aggressive motion or attention-grabbing loops.

---

## Floating actions (favorite + share)

These controls are **BelizeListings identity**:

- Remain **visually dominant** on the media layer.
- **Never** compete with arrows or slider affordances (there are none on cards).
- Preserve **soft glass / pastel** language — consistent spacing and tokens globally.
- **No** heavy shadows, harsh glow, or dark floating “utility” buttons.

---

## Typography

- **Title:** Confident, editorial, readable at a glance.
- **Price:** Large, emotionally weighted, high contrast — anchors the card.
- **Meta:** Secondary hierarchy — quiet, supportive.
- **District / region labels:** Restrained rhythm (uppercase where designed), atmospheric — not shouty MLS caps.

---

## Land rules

- **Never** show `0 bd` / `0 ba` for land.
- Use **land-specific presentation** (iconography, copy) — land is its own inventory category, not “broken residential.”
- Residential bed/bath counts stay **hidden** when absent or non-positive; land rows do not pretend to be houses.

---

## Motion

Motion should feel **soft**, **fluid**, **premium**, and often **invisible**.

Avoid:

- Sharp snapping or bouncy carousel physics.
- Ecommerce-style hover scaling on the card frame.
- Flashy or novelty motion.

---

## Create Listing preview rule (permanent)

The **Create Listing** preview **must** reuse the **same canonical production card** used on browse surfaces: **`HomePropertyCard`** (with the same CSS module and interaction philosophy). The preview is a **live production-quality preview surface**, not a simplified mock.

**Never:**

- Build parallel “preview-only” card components.
- Fork card layout, typography, or media logic for the workspace.
- Drift styling or behavior from production listing card DNA.

**Implementation notes:**

- Preview may use `disableNavigation` so there is no link to a non-existent detail URL until published — that is **not** a separate card; it is the same component with a supported prop.
- **Favorite and share** use production chrome when a **persisted draft listing id** exists (so actions target a real row and URLs are valid). Before the first successful draft save, those actions stay off to avoid broken favorites / share links — the **card shell, media, hierarchy, and land rules** remain identical.

---

## Global governance

All future listing card work must preserve:

- Calm **editorial** feel.
- **Hidden** gallery interaction philosophy on desktop; **swipe-only** on touch.
- **Image-first** hierarchy.
- **Premium Belize** identity and **sea-glass** DNA.

**If a new feature conflicts with card clarity, the feature loses** — not the card.

---

*Canonical implementation today: `src/components/HomePropertyCard.jsx` + `src/styles/HomeMapFirst.module.css` (card gallery and chrome). Listing detail and other surfaces may wrap additional behavior but must not undermine this DNA without updating this document.*
