import { AGENT_UPGRADE_REQUEST_STATUS } from "@/constants/agentUpgradeNotifications";

/** Canonical cycle identifier — one row per submission/resolution cycle. */
export function getAgentUpgradeCycleId(request) {
  const id = request?.id;
  return id ? String(id) : null;
}

export function isPendingAgentUpgradeRequest(request) {
  return String(request?.status || "") === AGENT_UPGRADE_REQUEST_STATUS.PENDING;
}

export function isResolvedAgentUpgradeRequest(request) {
  const status = String(request?.status || "");
  return (
    status === AGENT_UPGRADE_REQUEST_STATUS.APPROVED ||
    status === AGENT_UPGRADE_REQUEST_STATUS.REJECTED
  );
}

/**
 * Derive whether a platform user may submit a new Agent upgrade request.
 * Source of truth is the request table + profile role, not notification history.
 */
export function deriveAgentUpgradeSubmissionEligibility({
  profileRole = "user",
  pendingRequest = null,
} = {}) {
  const role = String(profileRole || "user").toLowerCase();
  if (role !== "user") {
    return {
      canSubmit: false,
      reason: role === "agent" ? "already_agent" : "role_ineligible",
    };
  }
  if (pendingRequest && isPendingAgentUpgradeRequest(pendingRequest)) {
    return { canSubmit: false, reason: "pending_exists" };
  }
  return { canSubmit: true, reason: null };
}

/**
 * Pick the current active cycle — pending wins over historical rows.
 */
export function resolveCurrentAgentUpgradeCycle({ pendingRequest = null, latestRequest = null } = {}) {
  if (pendingRequest && isPendingAgentUpgradeRequest(pendingRequest)) {
    return pendingRequest;
  }
  return latestRequest ?? null;
}

/**
 * UI state derived from request records (not notifications).
 */
export function deriveAgentUpgradeUiState({
  profileRole = "user",
  pendingRequest = null,
  latestResolvedRequest = null,
} = {}) {
  const role = String(profileRole || "user").toLowerCase();
  if (role === "agent") {
    return { phase: "approved_active", cycleId: getAgentUpgradeCycleId(latestResolvedRequest) };
  }
  if (pendingRequest && isPendingAgentUpgradeRequest(pendingRequest)) {
    return { phase: "pending_review", cycleId: getAgentUpgradeCycleId(pendingRequest) };
  }
  if (
    latestResolvedRequest?.status === AGENT_UPGRADE_REQUEST_STATUS.REJECTED
  ) {
    return { phase: "declined_resubmit", cycleId: getAgentUpgradeCycleId(latestResolvedRequest) };
  }
  if (
    latestResolvedRequest?.status === AGENT_UPGRADE_REQUEST_STATUS.APPROVED
  ) {
    return { phase: "approved_historical", cycleId: getAgentUpgradeCycleId(latestResolvedRequest) };
  }
  return { phase: "none", cycleId: null };
}
