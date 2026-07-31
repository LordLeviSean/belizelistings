import { supabase } from "@/lib/supabaseClient";
import { isMissingTableError } from "@/lib/supabaseCompat";
import { AGENT_UPGRADE_REQUEST_STATUS } from "@/constants/agentUpgradeNotifications";
import {
  deriveAgentUpgradeSubmissionEligibility,
  getAgentUpgradeCycleId,
} from "@/lib/agentUpgradeCycle";

export { getAgentUpgradeCycleId, deriveAgentUpgradeSubmissionEligibility };

const REQUEST_COLUMNS =
  "id,user_id,username,email,requested_at,current_user_role,requested_user_role,status,reviewed_at,reviewed_by,created_at,updated_at";

/**
 * @param {string} userId
 * @returns {Promise<{ data: object|null, error: object|null, unavailable?: boolean }>}
 */
export async function fetchPendingAgentUpgradeRequestForUser(userId) {
  if (!userId) return { data: null, error: null };
  const { data, error } = await supabase
    .from("agent_upgrade_requests")
    .select(REQUEST_COLUMNS)
    .eq("user_id", userId)
    .eq("status", AGENT_UPGRADE_REQUEST_STATUS.PENDING)
    .maybeSingle();
  if (error && isMissingTableError(error)) {
    return { data: null, error: null, unavailable: true };
  }
  return { data: data ?? null, error: error ?? null };
}

/**
 * @returns {Promise<{ data: object[], error: object|null, unavailable?: boolean }>}
 */
export async function fetchPendingAgentUpgradeRequests() {
  const { data, error } = await supabase
    .from("agent_upgrade_requests")
    .select(REQUEST_COLUMNS)
    .eq("status", AGENT_UPGRADE_REQUEST_STATUS.PENDING)
    .order("requested_at", { ascending: true });
  if (error && isMissingTableError(error)) {
    return { data: [], error: null, unavailable: true };
  }
  return { data: data ?? [], error: error ?? null };
}

/**
 * Latest resolved (approved/rejected) cycle for a user.
 */
export async function fetchLatestResolvedAgentUpgradeRequestForUser(userId) {
  if (!userId) return { data: null, error: null };
  const { data, error } = await supabase
    .from("agent_upgrade_requests")
    .select(REQUEST_COLUMNS)
    .eq("user_id", userId)
    .in("status", [
      AGENT_UPGRADE_REQUEST_STATUS.APPROVED,
      AGENT_UPGRADE_REQUEST_STATUS.REJECTED,
    ])
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && isMissingTableError(error)) {
    return { data: null, error: null, unavailable: true };
  }
  return { data: data ?? null, error: error ?? null };
}

/**
 * Full request history newest-first (audit / admin context).
 */
export async function fetchAgentUpgradeRequestHistoryForUser(userId, { limit = 20 } = {}) {
  if (!userId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("agent_upgrade_requests")
    .select(REQUEST_COLUMNS)
    .eq("user_id", userId)
    .order("requested_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 50)));
  if (error && isMissingTableError(error)) {
    return { data: [], error: null, unavailable: true };
  }
  return { data: data ?? [], error: error ?? null };
}

/**
 * @param {{ profileRole?: string, pendingRequest?: object|null }} args
 */
export function canSubmitAgentUpgradeRequest(args = {}) {
  return deriveAgentUpgradeSubmissionEligibility(args);
}

/**
 * @param {{ userId: string, username?: string|null, email?: string|null, currentRole?: string }} payload
 */
export async function submitAgentUpgradeRequest(payload) {
  const userId = String(payload?.userId || "").trim();
  if (!userId) {
    return { data: null, error: { message: "Missing user id." } };
  }

  const { data: pending, error: pendingError } = await fetchPendingAgentUpgradeRequestForUser(userId);
  if (pendingError) {
    return { data: null, error: pendingError };
  }
  const eligibility = deriveAgentUpgradeSubmissionEligibility({
    profileRole: payload.currentRole,
    pendingRequest: pending,
  });
  if (!eligibility.canSubmit && eligibility.reason === "pending_exists") {
    return {
      data: null,
      error: { code: "23505", message: "duplicate_pending_request" },
    };
  }

  const row = {
    user_id: userId,
    username: payload.username ? String(payload.username).trim() : null,
    email: payload.email ? String(payload.email).trim().toLowerCase() : null,
    current_user_role: String(payload.currentRole || "user").trim() || "user",
    requested_user_role: "agent",
    status: AGENT_UPGRADE_REQUEST_STATUS.PENDING,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc("submit_agent_upgrade_request", {
    p_username: row.username,
    p_email: row.email,
  });

  if (!rpcError && rpcData?.ok) {
    const embedded = rpcData.request && typeof rpcData.request === "object" ? rpcData.request : null;
    if (embedded?.id) {
      return { data: embedded, error: null, cycleId: String(embedded.id) };
    }
    const cycleId = rpcData.upgrade_request_id ?? rpcData.cycle_id ?? null;
    if (cycleId) {
      const { data: fetched, error: fetchError } = await supabase
        .from("agent_upgrade_requests")
        .select(REQUEST_COLUMNS)
        .eq("id", cycleId)
        .maybeSingle();
      return { data: fetched ?? null, error: fetchError ?? null, cycleId: cycleId ? String(cycleId) : null };
    }
  }

  if (rpcError) {
    const msg = String(rpcError.message || "").toLowerCase();
    const missingRpc =
      rpcError.code === "PGRST202" ||
      rpcError.code === "42883" ||
      msg.includes("submit_agent_upgrade_request") ||
      msg.includes("could not find the function");
    if (!missingRpc) {
      if (rpcError.code === "23505" || msg.includes("duplicate_pending_request")) {
        return {
          data: null,
          error: { code: "23505", message: "duplicate_pending_request" },
        };
      }
      return { data: null, error: rpcError };
    }
  }

  const { data, error } = await supabase
    .from("agent_upgrade_requests")
    .insert(row)
    .select(REQUEST_COLUMNS)
    .single();

  return {
    data: data ?? null,
    error: error ?? null,
    cycleId: data?.id ? String(data.id) : null,
  };
}

/**
 * @param {{ requestId: string, reviewerId: string, nextStatus: 'approved'|'rejected', userId: string }} args
 */
export async function resolveAgentUpgradeRequest({ requestId, reviewerId, nextStatus, userId }) {
  const id = String(requestId || "").trim();
  const uid = String(userId || "").trim();
  const reviewer = String(reviewerId || "").trim();
  if (!id || !uid || !reviewer) {
    return { ok: false, error: { message: "Missing request context." } };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("resolve_agent_upgrade_request", {
    p_request_id: id,
    p_next_status: nextStatus,
    p_user_id: uid,
  });

  if (!rpcError && rpcData?.ok) {
    return {
      ok: true,
      error: null,
      cycleId: id,
      idempotent: Boolean(rpcData.idempotent),
      status: rpcData.status ?? nextStatus,
    };
  }

  if (rpcError) {
    const msg = String(rpcError.message || "").toLowerCase();
    const missingRpc =
      rpcError.code === "PGRST202" ||
      rpcError.code === "42883" ||
      msg.includes("resolve_agent_upgrade_request") ||
      msg.includes("could not find the function");
    if (!missingRpc) {
      if (msg.includes("request_not_pending")) {
        return { ok: false, error: { message: "request_not_pending" } };
      }
      return { ok: false, error: rpcError };
    }
  }

  if (nextStatus === AGENT_UPGRADE_REQUEST_STATUS.APPROVED) {
    const { error: roleError } = await supabase.from("profiles").update({ role: "agent" }).eq("id", uid);
    if (roleError) {
      return { ok: false, error: roleError };
    }
  }

  const { data: updatedRows, error: requestError } = await supabase
    .from("agent_upgrade_requests")
    .update({
      status: nextStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer,
    })
    .eq("id", id)
    .eq("status", AGENT_UPGRADE_REQUEST_STATUS.PENDING)
    .select("id,status")
    .maybeSingle();

  if (requestError) {
    return { ok: false, error: requestError };
  }

  if (!updatedRows?.id) {
    const { data: existing } = await supabase
      .from("agent_upgrade_requests")
      .select("id,status")
      .eq("id", id)
      .maybeSingle();
    if (existing?.status === nextStatus) {
      return { ok: true, error: null, cycleId: id, idempotent: true, status: existing.status };
    }
    return { ok: false, error: { message: "request_not_pending" } };
  }

  return { ok: true, error: null, cycleId: id, idempotent: false, status: nextStatus };
}
