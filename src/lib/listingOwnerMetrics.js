import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_INQUIRIES } from "./featureFlags";
import { isViewingOnlyConversation } from "./crm/conversationFilters";
import { CONVERSATION_INQUIRY_EMBED } from "./crm/conversationMutations";
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
 * Canonical inquiries = distinct active Inbox conversations per listing.
 */
async function fetchInquiryCountsFallback(client, listingIds, ownerUserId) {
  if ((!BL_ENABLE_INQUIRIES && !BL_ENABLE_CONVERSATIONS) || !ownerUserId) {
    return { map: {}, error: null, partial: true };
  }

  const map = {};
  for (const id of listingIds) {
    map[String(id)] = zeroMetrics();
  }

  if (BL_ENABLE_CONVERSATIONS) {
    const { data, error } = await client
      .from("conversations")
      .select(`id,listing_id,${CONVERSATION_INQUIRY_EMBED}`)
      .eq("agent_id", ownerUserId)
      .is("agent_deleted_at", null)
      .is("agent_archived_at", null)
      .in("listing_id", listingIds);

    if (error) {
      return { map: {}, error, partial: true };
    }

    const seen = new Set();
    for (const row of data || []) {
      const lid = row?.listing_id;
      const cid = row?.id;
      if (lid == null || cid == null) continue;
      if (isViewingOnlyConversation(row)) continue;
      const dedupeKey = `${lid}:${cid}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const key = String(lid);
      if (!map[key]) map[key] = zeroMetrics();
      map[key].inquiries += 1;
    }
    return { map, error: null, partial: true };
  }

  const { data, error } = await client
    .from("listing_inquiries")
    .select("listing_id,inquiry_type,conversation_id")
    .in("listing_id", listingIds)
    .eq("agent_user_id", ownerUserId);

  if (error) {
    return { map: {}, error, partial: true };
  }

  for (const row of data || []) {
    const lid = row?.listing_id;
    if (lid == null) continue;
    if (String(row?.inquiry_type || "") === "schedule_viewing") continue;
    if (!row?.conversation_id) continue;
    const key = String(lid);
    if (!map[key]) map[key] = zeroMetrics();
    map[key].inquiries += 1;
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
