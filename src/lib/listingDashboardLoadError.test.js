import { buildListingDashboardLoadErrorPatch } from "./listingDashboardLoadError";

describe("listingDashboardLoadError", () => {
  test("buildListingDashboardLoadErrorPatch preserves existing rows on query failure", () => {
    const rows = [{ id: "1", user_id: "u1", status: "approved" }];
    const patch = buildListingDashboardLoadErrorPatch(rows);
    expect(patch.listingsErrorMessage).toBe("Could not load your listings.");
    expect(patch.myListingsRows).toBeUndefined();
  });

  test("buildListingDashboardLoadErrorPatch clears rows only when none were loaded", () => {
    const patch = buildListingDashboardLoadErrorPatch([]);
    expect(patch.myListingsRows).toEqual([]);
    expect(patch.listingsErrorMessage).toBe("Could not load your listings.");
  });

  test("buildListingDashboardLoadErrorPatch marks terminal failures", () => {
    const patch = buildListingDashboardLoadErrorPatch([], { terminal: true });
    expect(patch.listingsQueryTerminal).toBe(true);
    expect(patch.myListingsRows).toEqual([]);
  });
});
