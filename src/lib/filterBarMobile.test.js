/** @jest-environment node */

import {
  MOBILE_FILTER_COLLAPSE_MQ,
  shouldShowFilterSummary,
  shouldShowMobileFilterSummary,
} from "./filterBarMobile";

describe("filterBarMobile", () => {
  test("exports mobile collapse media query", () => {
    expect(MOBILE_FILTER_COLLAPSE_MQ).toBe("(max-width: 768px)");
  });

  test("shouldShowFilterSummary is true when filters are collapsed", () => {
    expect(shouldShowFilterSummary(false)).toBe(true);
    expect(shouldShowFilterSummary(true)).toBe(false);
  });

  test("shouldShowMobileFilterSummary is true only on mobile when collapsed", () => {
    expect(shouldShowMobileFilterSummary(true, false)).toBe(true);
    expect(shouldShowMobileFilterSummary(true, true)).toBe(false);
    expect(shouldShowMobileFilterSummary(false, false)).toBe(false);
    expect(shouldShowMobileFilterSummary(false, true)).toBe(false);
  });
});
