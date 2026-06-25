import { BL_ENABLE_LISTING_EVENTS } from "../featureFlags";
import { isMissingRelationshipError, isMissingTableError } from "../supabaseCompat";
import { supabase } from "../supabaseClient";

const TIMELINE_SELECT =
  "id, event_type, occurred_at, payload, visibility, source";

function isTimelineUnavailable(error) {
  if (!error) return false;
  if (isMissingTableError(error)) return true;
  if (isMissingRelationshipError(error)) return true;
  const msg = String(error.message || "").toLowerCase();
  return msg.includes("listing_events");
}

/**
 * Fetch public timeline rows for a listing (newest first).
 * Respects BL_ENABLE_LISTING_EVENTS; returns skipped when flag off or table missing.
 *
 * @param {string} listingId
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{ events: object[], error: object|null, skipped?: boolean }>}
 */
export async function fetchListingTimeline(listingId, { limit = 50 } = {}) {
  const id = String(listingId || "").trim();
  if (!id) {
    return { events: [], error: { message: "Missing listingId" } };
  }
  if (!BL_ENABLE_LISTING_EVENTS) {
    return { events: [], error: null, skipped: true };
  }

  const { data, error } = await supabase
    .from("listing_events")
    .select(TIMELINE_SELECT)
    .eq("listing_id", id)
    .eq("visibility", "public")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isTimelineUnavailable(error)) {
      return { events: [], error: null, skipped: true };
    }
    return { events: [], error };
  }

  return { events: data || [], error: null };
}
