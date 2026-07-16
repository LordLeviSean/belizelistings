import { formatDistrictInventorySummary } from "./districtInventorySummary";

describe("formatDistrictInventorySummary", () => {
  test("single property available", () => {
    expect(formatDistrictInventorySummary({ filtered: 1, total: 1 })).toBe("1 Property Available");
  });

  test("multiple properties without active filters", () => {
    expect(formatDistrictInventorySummary({ filtered: 4, total: 4 })).toBe("Showing 4 Properties");
  });

  test("filtered subset copy", () => {
    expect(
      formatDistrictInventorySummary({ filtered: 7, total: 24, hasActiveFilters: true })
    ).toBe("Showing 7 of 24 Properties");
  });
});
