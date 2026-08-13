/** @jest-environment node */

import {
  isDeepLinkViewingPending,
  mergeViewingIntoList,
  normalizeViewingId,
  resolveDeepLinkedViewingId,
  viewingIdsMatch,
  viewingListIncludesId,
} from "./viewingDeepLink";

describe("viewingDeepLink", () => {
  test("viewingIdsMatch compares ids as strings", () => {
    expect(viewingIdsMatch("view-1", "view-1")).toBe(true);
    expect(viewingIdsMatch(42, "42")).toBe(true);
    expect(viewingIdsMatch("view-1", "view-2")).toBe(false);
  });

  test("normalizeViewingId trims and stringifies ids", () => {
    expect(normalizeViewingId(108)).toBe("108");
    expect(normalizeViewingId(" view-1 ")).toBe("view-1");
    expect(normalizeViewingId(null)).toBeNull();
  });

  test("resolveDeepLinkedViewingId returns canonical row id for confirmed and declined", () => {
    const viewings = [
      { id: "uuid-declined-1", status: "declined" },
      { id: "uuid-confirmed-2", status: "confirmed" },
    ];

    expect(resolveDeepLinkedViewingId(viewings, "uuid-declined-1")).toBe("uuid-declined-1");
    expect(resolveDeepLinkedViewingId(viewings, 2)).toBeNull();
    expect(resolveDeepLinkedViewingId(viewings, "missing")).toBeNull();
  });

  test("mergeViewingIntoList upserts by id without duplicating", () => {
    const existing = [{ id: "v1", status: "pending" }];
    const merged = mergeViewingIntoList(existing, { id: "v1", status: "confirmed" });
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("confirmed");

    const inserted = mergeViewingIntoList(existing, { id: "v2", status: "declined" });
    expect(inserted).toHaveLength(2);
    expect(inserted[0].id).toBe("v2");
  });

  test("isDeepLinkViewingPending waits until target resolves", () => {
    expect(
      isDeepLinkViewingPending({
        initialViewingId: "v1",
        viewings: [],
        resolveState: "loading",
      })
    ).toBe(true);

    expect(
      isDeepLinkViewingPending({
        initialViewingId: "v1",
        viewings: [{ id: "v1", status: "confirmed" }],
        resolveState: "resolved",
      })
    ).toBe(false);

    expect(
      isDeepLinkViewingPending({
        initialViewingId: "v1",
        viewings: [{ id: "v2", status: "pending" }],
        resolveState: "missing",
      })
    ).toBe(false);

    expect(
      isDeepLinkViewingPending({
        initialViewingId: "v1",
        viewings: [],
        resolveState: "error",
      })
    ).toBe(false);
  });

  test("viewingListIncludesId handles numeric ids", () => {
    expect(viewingListIncludesId([{ id: 108 }], "108")).toBe(true);
  });
});
