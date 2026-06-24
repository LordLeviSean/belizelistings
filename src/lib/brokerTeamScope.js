import { fetchProfileIdsByBrokerageId } from "./profileSelectContract";

/**
 * Resolve agent profile IDs sharing the same brokerage_id (when column exists).
 */
export async function fetchBrokerTeamAgentIds(supabase, brokerageId) {
  return fetchProfileIdsByBrokerageId(supabase, brokerageId);
}
