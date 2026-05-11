import { isMissingColumnError } from "./supabaseCompat";

/**
 * Resolve agent profile IDs sharing the same brokerage_id (when column exists).
 */
export async function fetchBrokerTeamAgentIds(supabase, brokerageId) {
  if (!brokerageId) return [];

  const { data, error } = await supabase.from("profiles").select("id").eq("brokerage_id", brokerageId);

  if (error) {
    if (isMissingColumnError(error)) return [];
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[brokerTeamScope] teammate fetch failed", error.message);
    }
    return [];
  }

  return (data || []).map((r) => r.id).filter(Boolean);
}
