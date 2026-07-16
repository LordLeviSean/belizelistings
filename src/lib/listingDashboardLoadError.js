/**
 * Dashboard store patch when owner listing reads fail.
 * Query failure is not the same as zero listings — preserve cached rows when present.
 *
 * @param {object[]} existingRows
 * @param {{ terminal?: boolean }} [opts]
 */
export function buildListingDashboardLoadErrorPatch(existingRows, { terminal = false } = {}) {
  const patch = { listingsErrorMessage: "Could not load your listings." };
  if (!existingRows?.length) patch.myListingsRows = [];
  if (terminal) patch.listingsQueryTerminal = true;
  return patch;
}
