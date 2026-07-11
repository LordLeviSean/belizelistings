import { VIEWING_STATUS } from "./crmConstants";

/** Canonical display labels for viewing request statuses (DB values unchanged). */
export const VIEWING_STATUS_LABELS = Object.freeze({
  [VIEWING_STATUS.PENDING]: "Requested",
  [VIEWING_STATUS.CONFIRMED]: "Confirmed",
  [VIEWING_STATUS.DECLINED]: "Declined",
  [VIEWING_STATUS.RESCHEDULED]: "Reschedule proposed",
  [VIEWING_STATUS.CANCELLED]: "Cancelled",
  [VIEWING_STATUS.COMPLETED]: "Completed",
  requested: "Requested",
  reschedule_requested: "Reschedule proposed",
});

export function viewingStatusLabel(status, { buyerFacing = false } = {}) {
  if (!status) return buyerFacing ? "Scheduled" : "Requested";
  const key = String(status).trim().toLowerCase();
  if (key === VIEWING_STATUS.PENDING && buyerFacing) {
    return "Pending confirmation";
  }
  return VIEWING_STATUS_LABELS[key] || VIEWING_STATUS_LABELS[status] || status;
}

export function isActiveViewingStatus(status) {
  return (
    status === VIEWING_STATUS.PENDING ||
    status === VIEWING_STATUS.CONFIRMED ||
    status === VIEWING_STATUS.RESCHEDULED
  );
}

export function isOwnerActionableViewingStatus(status) {
  return status === VIEWING_STATUS.PENDING || status === VIEWING_STATUS.RESCHEDULED;
}
