/**
 * JS mirror of `src/styles/tokens.css` for Framer Motion and programmatic animation.
 * Keep in sync with CSS --ease-default / duration intent.
 */

/** Route shell cross-fade (matches historical _app curve). */
export const pageTransition = {
  duration: 0.26,
  ease: [0.32, 0.06, 0.2, 1],
};

export const motionDurations = {
  instant: 0.12,
  d1: 0.18,
  d2: 0.26,
  d3: 0.4,
  d4: 0.58,
  d5: 0.72,
  d6: 0.9,
};

export const motionEasings = {
  outSoft: [0.22, 1, 0.36, 1],
  default: [0.32, 0.06, 0.2, 1],
  spring: [0.25, 0.46, 0.45, 0.94],
};
