/** @typedef {'idle'|'loading'|'resolved'|'missing'|'error'} DeepLinkResolveState */

/** @typedef {'resolved'|'missing'|'error'} ParticipantDeepLinkOutcome */

/**
 * @param {{ outcome?: ParticipantDeepLinkOutcome|null, resolved?: boolean }} result
 * @returns {DeepLinkResolveState}
 */
export function mapParticipantDeepLinkResultToState(result) {
  if (result?.outcome === "resolved" || result?.resolved === true) {
    return "resolved";
  }
  if (result?.outcome === "missing") {
    return "missing";
  }
  if (result?.outcome === "error") {
    return "error";
  }
  return "idle";
}

/**
 * @param {{ data?: { id?: string|number|null }|null, error?: object|null }} fetchResult
 * @returns {{ outcome: ParticipantDeepLinkOutcome, error: object|null }}
 */
export function classifyParticipantDeepLinkFetchResult(fetchResult) {
  if (fetchResult?.error) {
    return { outcome: "error", error: fetchResult.error };
  }
  if (!fetchResult?.data?.id) {
    return { outcome: "missing", error: null };
  }
  return { outcome: "resolved", error: null };
}
