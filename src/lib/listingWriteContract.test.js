import {
  omitDraftInsertOnlyFields,
  omitSubmitForReviewWorkflowFields,
} from "./draftListingInsertContract";
import {
  LISTING_INSERT_RETURN_TIERS,
  LISTING_WRITE_MAX_PATHS,
  SUBMIT_FOR_REVIEW_STATUS_TIERS,
  buildMinimalListingInsertPayload,
  buildSubmitForReviewMinimalFallback,
  buildSubmitForReviewStatusPatch,
  buildModerationApprovePatch,
  buildModerationApproveFallback,
  buildModerationRejectPatch,
  buildModerationArchivePatch,
  MODERATION_APPROVE_STATUS_TIERS,
  listingPersistLockKey,
  stripListingEnrichmentPayload,
  withListingPersistLock,
} from "./listingWriteContract";

describe("listingWriteContract", () => {
  test("LISTING_WRITE_MAX_PATHS is 2", () => {
    expect(LISTING_WRITE_MAX_PATHS).toBe(2);
  });

  test("INSERT return tiers never use select(*)", () => {
    for (const tier of LISTING_INSERT_RETURN_TIERS) {
      expect(tier.trim()).not.toBe("*");
      expect(tier).toContain("id");
      expect(tier).not.toMatch(/\*/);
    }
  });

  test("buildMinimalListingInsertPayload preserves draft status and core keys", () => {
    const minimal = buildMinimalListingInsertPayload({
      title: "Coastal",
      price: 120000,
      property_type: "house",
      listing_type: "sale",
      district: "belize",
      status: "draft",
      user_id: "user-1",
    });
    expect(minimal).toEqual({
      title: "Coastal",
      price: 120000,
      property_type: "house",
      listing_type: "sale",
      district: "belize",
      status: "draft",
      user_id: "user-1",
    });
  });

  test("omitSubmitForReviewWorkflowFields strips role and audit keys but keeps lifecycle", () => {
    const { body, omittedKeys } = omitSubmitForReviewWorkflowFields({
      title: "t",
      status: "pending",
      lifecycle_status: "submitted",
      moderation_status: "pending_review",
      listed_by: "u1",
      managed_by: "u1",
      region_slug: "belize",
    });
    expect(body).toEqual({
      title: "t",
      status: "pending",
      lifecycle_status: "submitted",
      moderation_status: "pending_review",
    });
    expect(omittedKeys).toContain("listed_by");
    expect(omittedKeys).toContain("managed_by");
    expect(omittedKeys).toContain("region_slug");
  });

  test("buildSubmitForReviewStatusPatch uses submit-safe lifecycle tier", () => {
    expect(buildSubmitForReviewStatusPatch()).toEqual(SUBMIT_FOR_REVIEW_STATUS_TIERS[0]);
    expect(buildSubmitForReviewMinimalFallback()).toEqual(SUBMIT_FOR_REVIEW_STATUS_TIERS[1]);
  });

  test("moderation approve/reject/archive patches omit audit timestamps", () => {
    expect(buildModerationApprovePatch()).toEqual(MODERATION_APPROVE_STATUS_TIERS[0]);
    expect(buildModerationApproveFallback()).toEqual(MODERATION_APPROVE_STATUS_TIERS[1]);
    expect(buildModerationRejectPatch()).not.toHaveProperty("published_at");
    expect(buildModerationRejectPatch()).not.toHaveProperty("reviewed_at");
    expect(buildModerationArchivePatch()).not.toHaveProperty("archived_at");
    expect(buildModerationArchivePatch()).not.toHaveProperty("listed_by");
  });

  test("omitDraftInsertOnlyFields removes audit and lifecycle keys", () => {
    const { body, omittedKeys } = omitDraftInsertOnlyFields({
      title: "t",
      status: "draft",
      lifecycle_status: "draft",
      listed_by: "u1",
      archived_at: null,
      district: "belize",
    });
    expect(body).toEqual({ title: "t", status: "draft", district: "belize" });
    expect(omittedKeys).toContain("lifecycle_status");
    expect(omittedKeys).toContain("listed_by");
    expect(omittedKeys).toContain("archived_at");
  });

  test("stripListingEnrichmentPayload removes enrichment in one pass", () => {
    const { body, strippedKeys } = stripListingEnrichmentPayload({
      title: "t",
      lifecycle_status: "draft",
      moderation_status: "draft",
      listed_by: "u1",
      region_slug: "belize",
    });
    expect(body.title).toBe("t");
    expect(body.region_slug).toBeUndefined();
    expect(body.lifecycle_status).toBeUndefined();
    expect(strippedKeys).toContain("lifecycle_status");
    expect(strippedKeys).toContain("listed_by");
  });

  test("listingPersistLockKey uses __new__ when no draft id", () => {
    expect(listingPersistLockKey("")).toBe("__new__");
    expect(listingPersistLockKey("abc-123")).toBe("abc-123");
  });

  test("withListingPersistLock serializes concurrent calls", async () => {
    const order = [];
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const p1 = withListingPersistLock("d1", async () => {
      order.push("a-start");
      await delay(30);
      order.push("a-end");
      return 1;
    });
    const p2 = withListingPersistLock("d1", async () => {
      order.push("b-start");
      order.push("b-end");
      return 2;
    });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(1);
    expect(r2).toBe(2);
    expect(order).toEqual(["a-start", "a-end", "b-start", "b-end"]);
  });
});
