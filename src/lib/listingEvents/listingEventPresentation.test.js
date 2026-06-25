import {
  formatListingEventRelativeTime,
  presentListingEvent,
} from "./listingEventPresentation";
import { LISTING_EVENT_TYPES } from "./listingEventTypes";

describe("listingEventPresentation", () => {
  const nowMs = new Date("2026-06-26T12:00:00.000Z").getTime();

  test("verification approved uses BelizeListings headline", () => {
    const row = presentListingEvent(
      {
        event_type: LISTING_EVENT_TYPES.VERIFICATION_APPROVED,
        occurred_at: "2026-06-25T10:00:00.000Z",
        payload: { verified_at: "2026-06-25T10:00:00.000Z" },
      },
      { nowMs }
    );
    expect(row.headline).toBe("Verified by BelizeListings");
    expect(row.description).toMatch(/Verified on/);
  });

  test("price reduced headline includes new price", () => {
    const row = presentListingEvent(
      {
        event_type: LISTING_EVENT_TYPES.PRICE_REDUCED,
        occurred_at: "2026-06-26T11:00:00.000Z",
        payload: {
          from: { price: 450000, currency: "USD" },
          to: { price: 425000, currency: "USD" },
        },
      },
      { nowMs }
    );
    expect(row.headline).toBe("Price reduced to 425,000 USD");
    expect(row.description).toBe("Previously 450,000 USD");
  });

  test("republished maps to back on market copy", () => {
    const row = presentListingEvent(
      {
        event_type: LISTING_EVENT_TYPES.REPUBLISHED,
        occurred_at: "2026-06-20T08:00:00.000Z",
        payload: {},
      },
      { nowMs }
    );
    expect(row.headline).toBe("Back on market");
    expect(row.description).toContain("republished");
  });

  test("unknown event types humanize with sensible defaults", () => {
    const row = presentListingEvent(
      {
        event_type: "listing.custom.feature",
        occurred_at: "2026-06-26T11:30:00.000Z",
        payload: { note: "Custom operator note" },
      },
      { nowMs }
    );
    expect(row.headline).toBe("Custom Feature");
    expect(row.description).toBe("Custom operator note");
  });

  test("formatListingEventRelativeTime covers minutes, days, and absolute dates", () => {
    expect(formatListingEventRelativeTime("2026-06-26T11:55:00.000Z", nowMs)).toBe("5 minutes ago");
    expect(formatListingEventRelativeTime("2026-06-25T12:00:00.000Z", nowMs)).toBe("Yesterday");
    expect(formatListingEventRelativeTime("2026-05-01T12:00:00.000Z", nowMs)).toMatch(/May/);
  });
});
