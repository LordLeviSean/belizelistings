/**
 * Agent listing updates (not insert). Merges fields and forces re-approval workflow.
 * Do not use for: soft-delete (status "deleted"), admin approve/reject, or public reads.
 */
export function withReapprovalRequired(fields = {}) {
  return {
    ...fields,
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
  };
}
