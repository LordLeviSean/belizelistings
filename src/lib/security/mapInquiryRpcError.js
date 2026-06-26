/**
 * Map Postgres RPC / validation errors from create_inquiry_with_conversation
 * to HTTP status + structured client codes.
 *
 * @param {{ message?: string } | string | null | undefined} error
 * @returns {{ status: number, code: string, message: string }}
 */
export function mapInquiryRpcError(error) {
  const msg = String(error?.message ?? error ?? "").trim();
  const lower = msg.toLowerCase();

  if (lower.startsWith("rate_limited_listing")) {
    return {
      status: 429,
      code: "rate_limited_listing",
      message: "Too many messages for this listing. Please try again later.",
    };
  }

  if (lower.startsWith("rate_limited_global")) {
    return {
      status: 429,
      code: "rate_limited_global",
      message: "Too many messages sent recently. Please try again later.",
    };
  }

  if (/listing not found|not publicly available/i.test(msg)) {
    return { status: 404, code: "listing_unavailable", message: "Listing is not available." };
  }

  if (/agent_user_id does not match|agent.*match listing owner/i.test(msg)) {
    return { status: 400, code: "invalid_agent", message: "Invalid listing contact." };
  }

  if (/message is required|sender_email is required/i.test(msg)) {
    return { status: 400, code: "validation_error", message: msg };
  }

  if (/listing_id and agent_user_id are required/i.test(msg)) {
    return { status: 400, code: "validation_error", message: msg };
  }

  return { status: 500, code: "inquiry_failed", message: msg || "Could not submit inquiry." };
}

/**
 * @param {string} message
 * @returns {string | null}
 */
export function parseInquiryErrorCode(message) {
  const msg = String(message || "").trim();
  if (msg.startsWith("rate_limited_listing")) return "rate_limited_listing";
  if (msg.startsWith("rate_limited_global")) return "rate_limited_global";
  return null;
}
