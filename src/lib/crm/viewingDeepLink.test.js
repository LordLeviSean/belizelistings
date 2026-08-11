import { resolveDeepLinkedViewingId, viewingIdsMatch } from "./viewingDeepLink";

describe("viewingDeepLink", () => {
  test("viewingIdsMatch compares ids as strings", () => {
    expect(viewingIdsMatch("view-1", "view-1")).toBe(true);
    expect(viewingIdsMatch(42, "42")).toBe(true);
    expect(viewingIdsMatch("view-1", "view-2")).toBe(false);
  });

  test("resolveDeepLinkedViewingId returns canonical row id", () => {
    const viewings = [
      { id: "uuid-declined-1", status: "declined" },
      { id: "uuid-confirmed-2", status: "confirmed" },
    ];

    expect(resolveDeepLinkedViewingId(viewings, "uuid-declined-1")).toBe("uuid-declined-1");
    expect(resolveDeepLinkedViewingId(viewings, "missing")).toBeNull();
  });
});
