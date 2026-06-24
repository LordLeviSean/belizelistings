import {
  assessLegacyDraftForWorkspace,
  isLegacyGenerationDraft,
} from "./legacyDraftCompat";

describe("legacyDraftCompat", () => {
  test("detects status=draft without lifecycle/moderation columns", () => {
    expect(
      isLegacyGenerationDraft({
        status: "draft",
        lifecycle_status: null,
        moderation_status: null,
        user_id: "u1",
      })
    ).toBe(true);
  });

  test("modern draft with canonical lifecycle is not legacy", () => {
    expect(
      isLegacyGenerationDraft({
        status: "draft",
        lifecycle_status: "draft",
        moderation_status: "draft",
        district: "belize",
        region_slug: "belize",
        user_id: "u1",
        listed_by: "u1",
      })
    ).toBe(false);
  });

  test("assessLegacyDraftForWorkspace patches lifecycle when derivable district exists", () => {
    const assessment = assessLegacyDraftForWorkspace({
      status: "draft",
      lifecycle_status: null,
      moderation_status: null,
      district: "belize",
      user_id: "u1",
    });
    expect(assessment.recoverable).toBe(true);
    expect(assessment.needsRefresh).toBe(false);
    expect(assessment.rowPatch).toMatchObject({
      lifecycle_status: "draft",
      moderation_status: "draft",
      region_slug: "belize",
    });
  });

  test("assessLegacyDraftForWorkspace needs refresh when legacy and no district", () => {
    const assessment = assessLegacyDraftForWorkspace({
      status: "draft",
      lifecycle_status: null,
      moderation_status: null,
      title: "Old draft",
      user_id: "u1",
    });
    expect(assessment.needsRefresh).toBe(true);
    expect(assessment.recoverable).toBe(false);
  });
});
