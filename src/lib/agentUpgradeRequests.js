import { supabase } from "@/lib/supabaseClient";
import { isMissingTableError } from "@/lib/supabaseCompat";
import { AGENT_UPGRADE_REQUEST_STATUS } from "@/constants/agentUpgradeNotifications";

const REQUEST_COLUMNS =
  "id,user_id,username,email,requested_at,current_user_role,requested_user_role,status,reviewed_at,reviewed_by";

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
 * @param {{ userId: string, username?: string|null, email?: string|null, currentRole?: string }} payload
 */
export async function submitAgentUpgradeRequest(payload) {
  const userId = String(payload?.userId || "").trim();
  if (!userId) {
    return { data: null, error: { message: "Missing user id." } };
  }

  const row = {
    user_id: userId,
    username: payload.username ? String(payload.username).trim() : null,
    email: payload.email ? String(payload.email).trim().toLowerCase() : null,
    current_user_role: String(payload.currentRole || "user").trim() || "user",
    requested_user_role: "agent",
    status: AGENT_UPGRADE_REQUEST_STATUS.PENDING,
  };

  const { data, error } = await supabase
    .from("agent_upgrade_requests")
    .insert(row)
    .select(REQUEST_COLUMNS)
    .single();

  return { data: data ?? null, error: error ?? null };
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

  if (nextStatus === AGENT_UPGRADE_REQUEST_STATUS.APPROVED) {
    const { error: roleError } = await supabase.from("profiles").update({ role: "agent" }).eq("id", uid);
    if (roleError) {
      return { ok: false, error: roleError };
    }
  }

  const { error: requestError } = await supabase
    .from("agent_upgrade_requests")
    .update({
      status: nextStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer,
    })
    .eq("id", id)
    .eq("status", AGENT_UPGRADE_REQUEST_STATUS.PENDING);

  if (requestError) {
    return { ok: false, error: requestError };
  }

  return { ok: true, error: null };
}
