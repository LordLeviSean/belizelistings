import { BL_ENABLE_INQUIRIES } from "./featureFlags";
import { isMissingTableError, isTerminalListingQueryError } from "./supabaseCompat";

const RPC_METRICS = "get_owner_listing_metrics";

function normalizeListingIds(listingIds) {
  return [
    ...new Set(
      (listingIds || [])
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
}

function zeroMetrics() {
  return { views: 0, saves: 0, inquiries: 0 };
}

/**
 * @param {Record<string|number, { views?: number, saves?: number, inquiries?: number }>} map
 * @param {object[]} rows
 */
export function applyListingMetricsToRows(rows, metricsMap = {}) {
  return (rows || []).map((row) => {
    const id = row?.id;
    const metrics = metricsMap[id] ?? metricsMap[String(id)] ?? zeroMetrics();
    return {
      ...row,
      view_count: Number(metrics.views) || 0,
      favorite_count: Number(metrics.saves) || 0,
      inquiry_count: Number(metrics.inquiries) || 0,
    };
  });
}

/**
 * Client fallback when get_owner_listing_metrics RPC is unavailable.
 * Only inquiries are readable via RLS; views/saves default to 0.
 */
async function fetchInquiryCountsFallback(client, listingIds, ownerUserId) {
  if (!BL_ENABLE_INQUIRIES || !ownerUserId) {
    return { map: {}, error: null, partial: true };
  }
  const { data, error } = await client
    .from("listing_inquiries")
    .select("listing_id,inquiry_type")
    .in("listing_id", listingIds)
    .eq("agent_user_id", ownerUserId);

  if (error) {
    return { map: {}, error, partial: true };
  }

  const map = {};
  for (const row of data || []) {
    const lid = row?.listing_id;
    if (lid == null) continue;
    if (String(row?.inquiry_type || "") === "schedule_viewing") continue;
    const key = String(lid);
    if (!map[key]) map[key] = zeroMetrics();
    map[key].inquiries += 1;
  }
  for (const id of listingIds) {
    const key = String(id);
    if (!map[key]) map[key] = zeroMetrics();
  }
  return { map, error: null, partial: true };
}

function isMetricsRpcUnavailable(error) {
  const msg = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
    (msg.includes("function") && msg.includes("does not exist")) ||
    msg.includes("could not find")
  );
}

/**
 * Batch owner metrics for dashboard listing cards.
 * @returns {Promise<{ map: Record<string, { views: number, saves: number, inquiries: number }>, error: unknown|null, partial?: boolean }>}
 */
export async function fetchOwnerListingMetricsMap(client, listingIds, ownerUserId) {
  const ids = normalizeListingIds(listingIds);
  if (!client || ids.length === 0) {
    return { map: {}, error: null };
  }

  if (client.rpc) {
    const { data, error } = await client.rpc(RPC_METRICS, { p_listing_ids: ids });
    if (!error) {
      const map = {};
      for (const row of data || []) {
        const lid = row?.listing_id;
        if (lid == null) continue;
        map[String(lid)] = {
          views: Number(row.views) || 0,
          saves: Number(row.saves) || 0,
          inquiries: Number(row.inquiries) || 0,
        };
      }
      for (const id of ids) {
        const key = String(id);
        if (!map[key]) map[key] = zeroMetrics();
      }
      return { map, error: null };
    }
    if (!isMetricsRpcUnavailable(error) && !isTerminalListingQueryError(error)) {
      return fetchInquiryCountsFallback(client, ids, ownerUserId);
    }
    if (!isMetricsRpcUnavailable(error)) {
      return { map: {}, error, partial: true };
    }
  }

  return fetchInquiryCountsFallback(client, ids, ownerUserId);
}
