/** @jest-environment jsdom */

import { getOrCreateAnonViewerKey } from "./listingDetailViewTracking";

describe("listingDetailViewTracking", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  test("getOrCreateAnonViewerKey returns stable session key", () => {
    const a = getOrCreateAnonViewerKey();
    const b = getOrCreateAnonViewerKey();
    expect(a).toBeTruthy();
    expect(a).toBe(b);
    expect(a.startsWith("anon:")).toBe(true);
  });
});
