/**
 * Future moderation guidance — listing row fields (Postgres snake_case).
 * Not wired into UI yet; use with applyListingLifecycleAction(..., extraUpdates).
 */
export const REJECTION_LISTING_FIELDS = Object.freeze({
  REJECTION_REASON: "rejection_reason",
  MODERATOR_NOTES: "moderator_notes",
  RESUBMISSION_NOTES: "resubmission_notes",
  LAST_REVIEWED_AT: "last_reviewed_at",
});

/**
 * Preset reason codes for future pickers (value stored in rejection_reason).
 * Free-text still allowed if product allows custom reasons later.
 */
export const REJECTION_REASON_PRESETS = Object.freeze([
  { value: "missing_photos", label: "Missing photos" },
  { value: "duplicate_listing", label: "Duplicate listing" },
  { value: "incomplete_details", label: "Incomplete details" },
  { value: "invalid_pricing", label: "Invalid pricing" },
  { value: "suspicious_inventory", label: "Suspicious / fake inventory" },
  { value: "incorrect_district_category", label: "Incorrect district or category" },
]);

/**
 * Optional fields merged into REJECT extraUpdates once columns exist.
 */
export function buildRejectLifecycleExtraUpdates({
  rejectionReason,
  moderatorNotes,
  resubmissionNotes,
} = {}) {
  const out = {};
  if (rejectionReason != null && String(rejectionReason).trim() !== "") {
    out[REJECTION_LISTING_FIELDS.REJECTION_REASON] = String(rejectionReason).trim();
  }
  if (moderatorNotes != null && String(moderatorNotes).trim() !== "") {
    out[REJECTION_LISTING_FIELDS.MODERATOR_NOTES] = String(moderatorNotes).trim();
  }
  if (resubmissionNotes != null && String(resubmissionNotes).trim() !== "") {
    out[REJECTION_LISTING_FIELDS.RESUBMISSION_NOTES] = String(resubmissionNotes).trim();
  }
  return out;
}

/**
 * For RESUBMIT / REPUBLISH — owner or agent notes to moderators (future form).
 */
export function buildResubmitLifecycleExtraUpdates({ resubmissionNotes } = {}) {
  const out = {};
  if (resubmissionNotes != null && String(resubmissionNotes).trim() !== "") {
    out[REJECTION_LISTING_FIELDS.RESUBMISSION_NOTES] = String(resubmissionNotes).trim();
  }
  return out;
}
