/**
 * Normalize participant conversation rows to the buyer/owner inbox render contract.
 * Used at resolver/enrichment boundaries — not in leaf render expressions.
 */

function inquiryRowFromConversation(conv) {
  const inquiry = conv?.listing_inquiries;
  return Array.isArray(inquiry) ? inquiry[0] : inquiry;
}

/**
 * @param {string|number|null|undefined} stage
 * @param {{ fallback?: string }} [opts]
 */
export function formatPipelineStageLabel(stage, { fallback = "Open" } = {}) {
  if (stage == null || stage === "") return fallback;
  if (typeof stage === "string") return stage.replace(/_/g, " ");
  return String(stage).replace(/_/g, " ");
}

/**
 * @param {object|null|undefined} row
 */
export function normalizeConversationCrmRow(row) {
  if (!row || typeof row !== "object") return row;

  const inquiryRow = inquiryRowFromConversation(row);
  let pipelineStage = row.pipeline_stage;

  if (typeof pipelineStage !== "string" && typeof inquiryRow?.pipeline_stage === "string") {
    pipelineStage = inquiryRow.pipeline_stage;
  } else if (pipelineStage != null && typeof pipelineStage !== "string") {
    pipelineStage = String(pipelineStage);
  }

  if (pipelineStage === row.pipeline_stage) {
    return row;
  }

  return {
    ...row,
    pipeline_stage: pipelineStage ?? null,
  };
}

/**
 * @param {Array<object>} rows
 */
export function normalizeConversationCrmRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => normalizeConversationCrmRow(row));
}

/**
 * Safely apply participant deep-link fetch payloads to React state setters.
 *
 * @param {object|null|undefined} result
 * @param {{
 *   onConversations?: (rows: Array<object>) => void,
 *   onViewings?: (rows: Array<object>) => void,
 *   onListingsById?: (map: Record<string|number, object>) => void,
 * }} handlers
 */
export function applyParticipantDeepLinkCrmResult(result, handlers = {}) {
  if (!result || typeof result !== "object") return;

  if (Array.isArray(result.conversations)) {
    handlers.onConversations?.(normalizeConversationCrmRows(result.conversations));
  }
  if (Array.isArray(result.viewings)) {
    handlers.onViewings?.(result.viewings);
  }
  if (result.listingsById && typeof result.listingsById === "object") {
    handlers.onListingsById?.(result.listingsById);
  }
}

/**
 * Admin inbox mounts buyer + owner panels. Buyer CRM owns the conversation URL param
 * while the buyer participant resolver is active or succeeded.
 *
 * @param {{
 *   deepLinkConversationId?: string|number|null,
 *   buyerDeepLinkResolveState?: import("./participantDeepLinkOutcome").DeepLinkResolveState,
 * }} input
 */
export function resolveAdminOwnerConversationDeepLinkId({
  deepLinkConversationId = null,
  buyerDeepLinkResolveState = "idle",
} = {}) {
  if (deepLinkConversationId == null || deepLinkConversationId === "") {
    return null;
  }

  if (
    buyerDeepLinkResolveState === "idle" ||
    buyerDeepLinkResolveState === "loading" ||
    buyerDeepLinkResolveState === "resolved"
  ) {
    return null;
  }

  return deepLinkConversationId;
}
