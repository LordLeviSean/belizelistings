import {
  LISTING_EVENT_TYPES,
  LISTING_EVENT_VISIBILITY,
  getListingEventVisibility,
  isKnownListingEventType,
} from "./listingEventTypes";

describe("listingEventTypes", () => {
  test("verification events have expected visibility", () => {
    expect(LISTING_EVENT_VISIBILITY[LISTING_EVENT_TYPES.VERIFICATION_APPROVED]).toBe("public");
    expect(LISTING_EVENT_VISIBILITY[LISTING_EVENT_TYPES.VERIFICATION_REMOVED]).toBe("internal");
  });

  test("getListingEventVisibility defaults internal for unknown types", () => {
    expect(getListingEventVisibility("listing.unknown")).toBe("internal");
  });

  test("isKnownListingEventType recognizes registry values", () => {
    expect(isKnownListingEventType(LISTING_EVENT_TYPES.PUBLISHED)).toBe(true);
    expect(isKnownListingEventType("not.real")).toBe(false);
  });
});
