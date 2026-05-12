/** Tiny gradient LQIP for canonical listing media (no per-asset generation). */
const LISTING_BLUR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#d8f0ea"/><stop offset="55%" stop-color="#e4eaf5"/><stop offset="100%" stop-color="#f0ebe4"/></linearGradient></defs><rect width="8" height="8" fill="url(#a)"/></svg>`;

export const LISTING_MEDIA_BLUR_DATA_URL = `data:image/svg+xml,${encodeURIComponent(LISTING_BLUR_SVG)}`;
