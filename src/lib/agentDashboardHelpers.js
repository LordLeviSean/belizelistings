import { getLifecycleStatus } from "@/utils/canonicalListing";
import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { AGENT_INVENTORY_FILTERS } from "@/constants/dashboardAgentConfig";
import {
  filterMyListingsPanelRowsBySearch,
  sortMyListingsPanelRows,
  MY_LISTINGS_SORT_KEYS,
} from "@/lib/userDashboardListingTruth";

/**
 * Lifecycle inventory filter for agent dashboard (canonical model — no duplicate logic).
 * @param {object[]} rows
 * @param {string} filter
 */
export function filterAgentInventoryRows(rows, filter) {
  const f = String(filter || AGENT_INVENTORY_FILTERS.ALL);
  if (f === AGENT_INVENTORY_FILTERS.ALL) return rows || [];
  return (rows || []).filter((r) => {
    const lc = getLifecycleStatus(r);
    if (f === AGENT_INVENTORY_FILTERS.ACTIVE) return lc === LISTING_LIFECYCLE.PUBLISHED;
    if (f === AGENT_INVENTORY_FILTERS.PENDING) return lc === LISTING_LIFECYCLE.PENDING_REVIEW;
    if (f === AGENT_INVENTORY_FILTERS.REJECTED) return lc === LISTING_LIFECYCLE.REJECTED;
    if (f === AGENT_INVENTORY_FILTERS.ARCHIVED) return lc === LISTING_LIFECYCLE.ARCHIVED;
    if (f === AGENT_INVENTORY_FILTERS.DRAFTS) return lc === LISTING_LIFECYCLE.DRAFT;
    return true;
  });
}

/**
 * @param {object[]} rows
 * @param {string} filter
 * @param {string} searchQuery
 * @param {string} [sortKey]
 */
export function prepareAgentInventoryRows(rows, filter, searchQuery, sortKey = MY_LISTINGS_SORT_KEYS.NEWEST) {
  const filtered = filterAgentInventoryRows(rows, filter);
  const searched = filterMyListingsPanelRowsBySearch(filtered, searchQuery);
  return sortMyListingsPanelRows(searched, sortKey);
}
