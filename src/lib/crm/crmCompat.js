import { isMissingColumnError, isMissingRelationshipError, isMissingTableError } from "../supabaseCompat";

function collectErrorText(error) {
  if (!error) return "";
  return [error.message, error.details, error.hint, error.code].filter(Boolean).join(" | ");
}

export function isCrmUnavailable(error) {
  if (!error) return false;
  if (isMissingRelationshipError(error)) return true;
  if (isMissingTableError(error)) return true;
  if (isMissingColumnError(error)) return true;
  const blob = collectErrorText(error).toLowerCase();
  return (
    blob.includes("create_inquiry_with_conversation") ||
    blob.includes("conversations") ||
    blob.includes("listing_inquiries") ||
    blob.includes("viewing_requests") ||
    blob.includes("could not find the function")
  );
}

export function coerceListingIdForDb(listingId) {
  const s = String(listingId ?? "").trim();
  if (!s) return s;
  if (/^\d+$/.test(s)) return Number(s);
  return s;
}
