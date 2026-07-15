/** @jest-environment node */

import { resolveGeographicUpdateListingsHref } from "./resolveGeographicUpdateListingsHref";

describe("resolveGeographicUpdateListingsHref", () => {
  test("routes each role to the correct listings tab", () => {
    expect(resolveGeographicUpdateListingsHref("user")).toBe("/dashboard/user?tab=my-listings");
    expect(resolveGeographicUpdateListingsHref("agent")).toBe("/dashboard/agent?tab=listings");
    expect(resolveGeographicUpdateListingsHref("admin")).toBe("/admin?tab=listings");
    expect(resolveGeographicUpdateListingsHref("operator")).toBe("/admin?tab=operator");
  });
});
