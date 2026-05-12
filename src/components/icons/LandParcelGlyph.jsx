/**
 * Minimal cartographic parcel mark — soft strokes, `currentColor` for card metadata rows.
 */
export default function LandParcelGlyph({ className = "", "aria-hidden": ariaHidden = true }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaHidden}
      focusable="false"
    >
      <path
        d="M3.2 6.8 10 3.2 16.8 6.8v7.4L10 17.8 3.2 14.2V6.8z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M10 3.2v14.6M3.2 6.8 10 10.5l6.8-3.7"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.42"
      />
    </svg>
  );
}
