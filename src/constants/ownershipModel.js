export const OWNERSHIP_KEYS = Object.freeze({
  LISTED_BY: "listed_by",
  MANAGED_BY: "managed_by",
  VERIFIED_BY: "verified_by",
  ARCHIVED_BY: "archived_by",
  CLOSED_BY: "closed_by",
  MODERATED_BY: "moderated_by",
  REVIEWED_BY: "reviewed_by",
  PUBLISHED_BY: "published_by",
});

export const OWNERSHIP_ACTIONS = Object.freeze({
  APPROVE: "approve",
  REJECT: "reject",
  ARCHIVE: "archive",
  REPUBLISH: "republish",
  RESUBMIT: "resubmit",
  VERIFY: "verify",
  CLOSE_RENTED: "close_rented",
  CLOSE_SOLD: "close_sold",
});

export const OWNERSHIP_VISIBILITY = Object.freeze({
  INTERNAL: "internal",
  PUBLIC: "public",
});

export const OWNERSHIP_VISIBILITY_RULES = Object.freeze({
  listed_by: OWNERSHIP_VISIBILITY.INTERNAL,
  managed_by: OWNERSHIP_VISIBILITY.INTERNAL,
  verified_by: OWNERSHIP_VISIBILITY.INTERNAL,
  archived_by: OWNERSHIP_VISIBILITY.INTERNAL,
  closed_by: OWNERSHIP_VISIBILITY.INTERNAL,
  moderated_by: OWNERSHIP_VISIBILITY.INTERNAL,
  reviewed_by: OWNERSHIP_VISIBILITY.INTERNAL,
  published_by: OWNERSHIP_VISIBILITY.INTERNAL,
});

export function canShowOwnershipField(field, scope = OWNERSHIP_VISIBILITY.INTERNAL) {
  const visibility = OWNERSHIP_VISIBILITY_RULES[field] || OWNERSHIP_VISIBILITY.INTERNAL;
  if (scope === OWNERSHIP_VISIBILITY.INTERNAL) return true;
  return visibility === OWNERSHIP_VISIBILITY.PUBLIC;
}

