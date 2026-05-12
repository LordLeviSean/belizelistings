import {
  REJECTION_LISTING_FIELDS,
  REJECTION_REASON_PRESETS,
  buildRejectLifecycleExtraUpdates,
  buildResubmitLifecycleExtraUpdates,
} from "./rejectionModel";

describe("rejectionModel", () => {
  test("presets are non-empty stable codes", () => {
    expect(REJECTION_REASON_PRESETS.length).toBeGreaterThan(0);
    for (const p of REJECTION_REASON_PRESETS) {
      expect(p.value).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  test("buildRejectLifecycleExtraUpdates only sets provided non-empty fields", () => {
    expect(buildRejectLifecycleExtraUpdates({})).toEqual({});
    expect(
      buildRejectLifecycleExtraUpdates({
        rejectionReason: " missing_photos ",
        moderatorNotes: " x ",
        resubmissionNotes: "",
      })
    ).toEqual({
      [REJECTION_LISTING_FIELDS.REJECTION_REASON]: "missing_photos",
      [REJECTION_LISTING_FIELDS.MODERATOR_NOTES]: "x",
    });
  });

  test("buildResubmitLifecycleExtraUpdates", () => {
    expect(buildResubmitLifecycleExtraUpdates({ resubmissionNotes: " fixed " })).toEqual({
      [REJECTION_LISTING_FIELDS.RESUBMISSION_NOTES]: "fixed",
    });
  });
});
