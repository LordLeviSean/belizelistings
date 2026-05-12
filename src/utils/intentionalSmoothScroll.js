/**
 * Controlled smooth scrolling for explicit UX actions only (e.g. "scroll to section").
 * Do not call during route transitions — use instant `scrollTo` / default Next behavior there
 * so scroll restoration and `useScrollMemory` stay predictable.
 */

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function resolveBehavior(requested) {
  if (prefersReducedMotion()) return "auto";
  return requested === "smooth" ? "smooth" : "auto";
}

/** Smooth or instant window scroll; safe no-op on SSR. */
export function scrollWindowTo(options = {}) {
  if (typeof window === "undefined") return;
  const { top = 0, left = 0, behavior = "smooth" } = options;
  const b = resolveBehavior(behavior);
  try {
    window.scrollTo({ top, left, behavior: b });
  } catch {
    window.scrollTo(left, top);
  }
}

/** Smooth or instant scroll on a scrollable element (carousel, panel, etc.). */
export function scrollElementTo(el, options = {}) {
  if (!el) return;
  const { top, left, behavior = "smooth" } = options;
  const b = resolveBehavior(behavior);
  try {
    const o = { behavior: b };
    if (typeof top === "number") o.top = top;
    if (typeof left === "number") o.left = left;
    el.scrollTo(o);
  } catch {
    if (typeof top === "number") el.scrollTop = top;
    if (typeof left === "number") el.scrollLeft = left;
  }
}
