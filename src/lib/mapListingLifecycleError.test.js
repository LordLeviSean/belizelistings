/** @jest-environment node */

import { mapListingLifecycleError } from "./mapListingLifecycleError";

describe("mapListingLifecycleError", () => {
  test("maps listings_status_check to friendly copy", () => {
    expect(
      mapListingLifecycleError({
        code: "23514",
        message: 'new row for relation "listings" violates check constraint "listings_status_check"',
      })
    ).toBe("We couldn't update this listing. Please try again.");
  });

  test("preserves market guard messages", () => {
    expect(mapListingLifecycleError({ code: "market_unknown", message: "x" })).toMatch(
      /For Sale or For Rent/
    );
  });
});
