import { fetchApprovedListingsWithImages } from "./listingQueries";

let cachedData = null;
let inflight = null;

/**
 * Deduplicated approved-listings fetch for homepage, alerts, and other client shells.
 * @param {{ forceRefresh?: boolean }} [options]
 */
export async function getCachedApprovedListings({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedData) {
    return { data: cachedData, error: null, fromCache: true };
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const result = await fetchApprovedListingsWithImages();
      if (!result.error) {
        cachedData = result.data;
      }
      return result;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** @returns {object[] | null} */
export function peekCachedApprovedListings() {
  return cachedData;
}

export function invalidateApprovedListingsCache() {
  cachedData = null;
  inflight = null;
}
