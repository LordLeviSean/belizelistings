/** @jest-environment node */

import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { OWNERSHIP_ACTIONS } from "@/constants/ownershipModel";
import {
  resolveListingCompletionAction,
  resolveListingCompletionButtonClassName,
  validateListingCompletionLifecyclePatch,
  validateListingCompletionOwnershipAction,
} from "@/lib/listingCompletionAction";

describe("resolveListingCompletionAction", () => {
  test("sale listing resolves Mark Sold action", () => {
    const action = resolveListingCompletionAction({ listing_type: "sale", title: "Beach house" });
    expect(action?.label).toBe("Mark Sold");
    expect(action?.confirmationTitle).toBe("Mark this listing as sold?");
    expect(action?.confirmationPrimaryLabel).toBe("Mark Sold");
    expect(action?.successMessage).toBe(
      "Listing marked as sold. It will be archived automatically in 48 hours."
    );
    expect(action?.targetLifecycle).toBe(LISTING_LIFECYCLE.RECENTLY_SOLD);
    expect(action?.ownershipAction).toBe(OWNERSHIP_ACTIONS.CLOSE_SOLD);
    expect(action?.buttonVariant).toBe("sold");
    expect(action?.resultBadgeLabel).toBe("Sold");
  });

  test("rent listing resolves Mark Rented action", () => {
    const action = resolveListingCompletionAction({ listing_type: "rent", title: "Downtown flat" });
    expect(action?.label).toBe("Mark Rented");
    expect(action?.confirmationTitle).toBe("Mark this listing as rented?");
    expect(action?.confirmationPrimaryLabel).toBe("Mark Rented");
    expect(action?.successMessage).toBe(
      "Listing marked as rented. It will be archived automatically in 48 hours."
    );
    expect(action?.targetLifecycle).toBe(LISTING_LIFECYCLE.RECENTLY_RENTED);
    expect(action?.ownershipAction).toBe(OWNERSHIP_ACTIONS.CLOSE_RENTED);
    expect(action?.buttonVariant).toBe("rented");
    expect(action?.resultBadgeLabel).toBe("Rented");
  });

  test("market_type rent fallback when listing_type absent", () => {
    expect(resolveListingCompletionAction({ market_type: "rent" })?.label).toBe("Mark Rented");
  });

  test("does not infer rent from property_type or title", () => {
    expect(
      resolveListingCompletionAction({
        property_type: "rental",
        title: "For Rent in Placencia",
        description: "monthly lease available",
      })
    ).toBeNull();
  });

  test("missing market hides completion action", () => {
    expect(resolveListingCompletionAction({ title: "Mystery listing" })).toBeNull();
  });
});

describe("completion validation", () => {
  const saleListing = { listing_type: "sale" };
  const rentListing = { listing_type: "rent" };

  test("rejects cross-market ownership action", () => {
    expect(
      validateListingCompletionOwnershipAction(rentListing, OWNERSHIP_ACTIONS.CLOSE_SOLD)
    ).toEqual({ ok: false, code: "completion_market_mismatch" });
    expect(
      validateListingCompletionOwnershipAction(saleListing, OWNERSHIP_ACTIONS.CLOSE_RENTED)
    ).toEqual({ ok: false, code: "completion_market_mismatch" });
  });

  test("accepts matching ownership action", () => {
    expect(
      validateListingCompletionOwnershipAction(saleListing, OWNERSHIP_ACTIONS.CLOSE_SOLD)
    ).toEqual({ ok: true });
    expect(
      validateListingCompletionOwnershipAction(rentListing, OWNERSHIP_ACTIONS.CLOSE_RENTED)
    ).toEqual({ ok: true });
  });

  test("lifecycle patch validation mirrors ownership guard", () => {
    expect(
      validateListingCompletionLifecyclePatch(rentListing, LISTING_LIFECYCLE.RECENTLY_SOLD)
    ).toEqual({ ok: false, code: "completion_market_mismatch" });
    expect(
      validateListingCompletionLifecyclePatch(saleListing, LISTING_LIFECYCLE.RECENTLY_RENTED)
    ).toEqual({ ok: false, code: "completion_market_mismatch" });
  });
});

describe("resolveListingCompletionButtonClassName", () => {
  test("sale and rental buttons use different semantic variants", () => {
    const styles = {
      listingActionSold: "sold-class",
      listingActionRented: "rented-class",
    };
    expect(resolveListingCompletionButtonClassName(styles, "sold")).toBe("sold-class");
    expect(resolveListingCompletionButtonClassName(styles, "rented")).toBe("rented-class");
  });
});
