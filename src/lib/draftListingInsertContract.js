/**
 * First draft INSERT body contract (Continue / Save draft) — schema-safe subset.
 * Full lifecycle / audit / role columns belong on submit paths or PATCH autosave.
 */

export const DRAFT_INSERT_PAYLOAD_OMIT_KEYS = Object.freeze([
  "lifecycle_status",
  "moderation_status",
  "archived_at",
  "archived_by",
  "deleted_at",
  "deleted_by",
  "verified_at",
  "verified_by",
  "reviewed_at",
  "reviewed_by",
  "moderated_by",
  "published_by",
  "published_at",
  "closed_by",
  "closed_at",
  "rented_at",
  "sold_at",
  "expired_at",
  "created_at",
  "updated_at",
  "listed_by",
  "managed_by",
  "region_slug",
  "subregion_slug",
  "unit_id",
  "currency",
  "garage",
]);

const DRAFT_INSERT_OMIT_SET = new Set(DRAFT_INSERT_PAYLOAD_OMIT_KEYS);

/** Role / audit / slug enrichment — never on draft→review PATCH (schema may lack columns). */
export const SUBMIT_FOR_REVIEW_WORKFLOW_OMIT_KEYS = Object.freeze([
  "user_id",
  "listed_by",
  "managed_by",
  "archived_at",
  "archived_by",
  "deleted_at",
  "deleted_by",
  "verified_at",
  "verified_by",
  "reviewed_at",
  "reviewed_by",
  "moderated_by",
  "published_by",
  "published_at",
  "closed_by",
  "closed_at",
  "rented_at",
  "sold_at",
  "expired_at",
  "created_at",
  "region_slug",
  "subregion_slug",
  "unit_id",
  "currency",
  "garage",
]);

const SUBMIT_WORKFLOW_OMIT_SET = new Set(SUBMIT_FOR_REVIEW_WORKFLOW_OMIT_KEYS);

/**
 * @param {Record<string, unknown>} payload
 * @returns {{ body: Record<string, unknown>, omittedKeys: string[] }}
 */
export function omitDraftInsertOnlyFields(payload = {}) {
  const omittedKeys = [];
  const body = {};
  for (const [key, value] of Object.entries(payload)) {
    if (DRAFT_INSERT_OMIT_SET.has(key)) {
      omittedKeys.push(key);
      continue;
    }
    body[key] = value;
  }
  return { body, omittedKeys };
}

/**
 * Strip workflow-only keys from draft→review PATCH (keeps lifecycle/moderation when present).
 * @param {Record<string, unknown>} payload
 * @returns {{ body: Record<string, unknown>, omittedKeys: string[] }}
 */
export function omitSubmitForReviewWorkflowFields(payload = {}) {
  const omittedKeys = [];
  const body = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SUBMIT_WORKFLOW_OMIT_SET.has(key)) {
      omittedKeys.push(key);
      continue;
    }
    body[key] = value;
  }
  return { body, omittedKeys };
}
