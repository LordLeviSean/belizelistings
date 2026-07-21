const FRIENDLY_FAILURE = "We couldn't update this listing. Please try again.";

/**
 * Map PostgREST / Postgres lifecycle mutation errors to user-safe copy.
 * Logs technical detail for diagnosis without exposing raw SQL to users.
 */
export function mapListingLifecycleError(error) {
  if (!error) return FRIENDLY_FAILURE;
  const code = String(error.code || "");
  const message = String(error.message || "");
  const lower = message.toLowerCase();

  if (
    code === "23514" ||
    lower.includes("listings_status_check") ||
    lower.includes("listings_lifecycle_status_check") ||
    lower.includes("violates check constraint")
  ) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[listing-lifecycle] constraint rejection", { code, message });
    }
    return FRIENDLY_FAILURE;
  }

  if (error.code === "market_unknown") {
    return "Set this listing to For Sale or For Rent before marking it closed.";
  }
  if (error.code === "completion_market_mismatch") {
    return "This completion action does not match the listing market type.";
  }
  if (error.code === "completion_market_unknown" || lower.includes("completion_market_unknown")) {
    return "Set this listing to For Sale or For Rent before marking it closed.";
  }
  if (error.code === "completion_market_mismatch" || lower.includes("completion_market_mismatch")) {
    return "This completion action does not match the listing market type.";
  }

  if (message && !lower.includes("permission") && !lower.includes("jwt")) {
    return message;
  }

  if (typeof console !== "undefined" && console.warn) {
    console.warn("[listing-lifecycle] mutation failed", { code, message });
  }
  return FRIENDLY_FAILURE;
}

export { FRIENDLY_FAILURE as LISTING_LIFECYCLE_FRIENDLY_FAILURE };
