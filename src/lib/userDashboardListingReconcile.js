import { deriveUserDashboardListingCounts } from "./userDashboardListingTruth";

/** @param {object} row */
function rowModerationSignature(row) {
  return `${row?.id ?? ""}:${row?.updated_at ?? ""}:${row?.status ?? ""}:${row?.lifecycle_status ?? ""}:${row?.moderation_status ?? ""}`;
}

/**
 * ID-based merge for owner dashboard listing rows after moderation/realtime updates.
 * @param {object[]} prevRows
 * @param {object} incomingRow
 * @returns {{ rows: object[], changed: boolean }}
 */
export function reconcileMyListingRows(prevRows, incomingRow) {
  if (!incomingRow?.id) {
    return { rows: Array.isArray(prevRows) ? prevRows : [], changed: false };
  }

  const prev = Array.isArray(prevRows) ? prevRows : [];
  const id = String(incomingRow.id);
  const idx = prev.findIndex((row) => String(row?.id) === id);

  if (idx === -1) {
    return { rows: [...prev, incomingRow], changed: true };
  }

  const merged = { ...prev[idx], ...incomingRow };
  if (rowModerationSignature(prev[idx]) === rowModerationSignature(merged)) {
    return { rows: prev, changed: false };
  }

  const next = [...prev];
  next[idx] = merged;
  return { rows: next, changed: true };
}

/**
 * @param {object[]} prevRows
 * @param {string|number} listingId
 * @returns {{ rows: object[], changed: boolean }}
 */
export function removeMyListingRowById(prevRows, listingId) {
  const id = String(listingId ?? "");
  if (!id) return { rows: Array.isArray(prevRows) ? prevRows : [], changed: false };
  const prev = Array.isArray(prevRows) ? prevRows : [];
  const next = prev.filter((row) => String(row?.id) !== id);
  return { rows: next, changed: next.length !== prev.length };
}

/**
 * @param {object[]} rows
 */
export function deriveDashboardCountsFromRows(rows) {
  return deriveUserDashboardListingCounts(rows || []);
}
