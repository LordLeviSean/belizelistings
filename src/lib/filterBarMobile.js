/** Match media query for compact filter layout (search / district browse). */
export const MOBILE_FILTER_COLLAPSE_MQ = "(max-width: 768px)";

/** Whether the filter bar should show the compact summary row (all viewports). */
export function shouldShowFilterSummary(filtersExpanded) {
  return !filtersExpanded;
}

/** @deprecated Use shouldShowFilterSummary — kept for tests referencing mobile-only behavior. */
export function shouldShowMobileFilterSummary(isMobileViewport, filtersExpanded) {
  return Boolean(isMobileViewport) && !filtersExpanded;
}
