import { useEffect } from "react";
import { getCachedApprovedListings } from "../lib/approvedListingsCache";
import { filterListings } from "../utils/filterListings";
import { filtersToFilterListingsInput } from "../utils/savedSearchUtils";
import { incrementNavAlertBadge } from "../utils/navBadge";
import { getSavedSearches } from "./useSavedSearches";

const LAST_SEEN_KEY = "belize_alert_last_seen";
const ALERTS_LOG_KEY = "belize_alerts_log";

function readLastSeen() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeLastSeen(obj) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(obj));
}

function readAlertsLog() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ALERTS_LOG_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function appendAlertsLog(items) {
  if (typeof window === "undefined" || !items.length) return;
  const prev = readAlertsLog();
  localStorage.setItem(ALERTS_LOG_KEY, JSON.stringify([...prev, ...items]));
}

/**
 * Compare saved searches to listings; seed lastSeen on first run (no alerts), then only new matches.
 * @param {object[]} listingsData
 */
export function runAlertScan(listingsData) {
  if (typeof window === "undefined" || !listingsData?.length) return;

  const saved = getSavedSearches();
  if (!saved.length) return;

  const lastSeen = readLastSeen();
  const newAlerts = [];

  for (const search of saved) {
    const input = filtersToFilterListingsInput(search.filters);
    const matched = filterListings(listingsData, input);
    const currentIds = matched.map((l) => Number(l.id));

    const seenArr = lastSeen[search.id];
    if (!Array.isArray(seenArr) || seenArr.length === 0) {
      lastSeen[search.id] = currentIds;
      continue;
    }

    const seen = new Set(seenArr.map(Number));

    for (const listing of matched) {
      const lid = Number(listing.id);
      if (!seen.has(lid)) {
        seen.add(lid);
        newAlerts.push({
          searchId: search.id,
          listingId: lid,
          timestamp: Date.now(),
        });
        if (process.env.NODE_ENV === "development") {
          console.info(
            `[BelizeListings] New match for saved search "${search.label}" — listing #${lid} (${listing.title})`
          );
        }
      }
    }

    lastSeen[search.id] = [...seen];
  }

  writeLastSeen(lastSeen);

  if (newAlerts.length > 0) {
    appendAlertsLog(newAlerts);
    incrementNavAlertBadge(newAlerts.length);
  }
}

/** Run alert engine once on client after mount (shares homepage listings cache). */
export default function useAlerts() {
  useEffect(() => {
    const fetchListings = async () => {
      const { data, error } = await getCachedApprovedListings();
      if (!error) runAlertScan(data || []);
    };
    queueMicrotask(fetchListings);
  }, []);
}
