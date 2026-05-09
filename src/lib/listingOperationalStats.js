import { isMissingColumnError } from "./supabaseCompat";
import { tallyOperationalLifecycleCounts } from "../utils/canonicalListing";

const PAGE_SIZE = 1000;

/**
 * Load all listing rows needed for canonical operational lifecycle tally.
 * Retries with narrower selects when optional columns are missing (partial schema).
 */
export async function fetchListingRowsForOperationalTally(supabase) {
  const selectAttempts = [
    "id,status,lifecycle_status,moderation_status",
    "id,status,lifecycle_status",
    "id,status,moderation_status",
    "id,status",
  ];

  for (const select of selectAttempts) {
    const rows = [];
    let offset = 0;
    let fatalError = null;

    for (;;) {
      const { data, error } = await supabase.from("listings").select(select).range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        fatalError = error;
        break;
      }

      const chunk = data || [];
      rows.push(...chunk);
      if (chunk.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (!fatalError) {
      return { rows, error: null };
    }

    if (!isMissingColumnError(fatalError)) {
      return { rows: [], error: fatalError };
    }
  }

  return { rows: [], error: new Error("[listingOperationalStats] All select attempts failed for operational tally") };
}

/** Canonical pending + approved + rejected + archived; totalOperational === sum (no double-count). */
export async function getOperationalLifecycleCountsFromDb(supabase) {
  const { rows, error } = await fetchListingRowsForOperationalTally(supabase);
  if (error) {
    return { ...tallyOperationalLifecycleCounts([]), error };
  }
  return { ...tallyOperationalLifecycleCounts(rows), error: null };
}
