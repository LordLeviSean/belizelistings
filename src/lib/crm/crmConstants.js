/** CRM pipeline stages (conversations.pipeline_stage). */
export const CRM_PIPELINE_STAGE = Object.freeze({
  NEW_INQUIRY: "new_inquiry",
  RESPONDED: "responded",
  VIEWING_SCHEDULED: "viewing_scheduled",
  NEGOTIATING: "negotiating",
  OFFER_SENT: "offer_sent",
  OFFER_ACCEPTED: "offer_accepted",
  DEAL_CLOSED: "deal_closed",
  ARCHIVED: "archived",
});

/** Inquiry status (listing_inquiries.status). */
export const INQUIRY_STATUS = Object.freeze({
  NEW: "new",
  OPENED: "opened",
  RESPONDED: "responded",
  CLOSED: "closed",
  ARCHIVED: "archived",
  /** @deprecated legacy */ SCHEDULED: "scheduled",
});

/** Inquiry type (listing_inquiries.inquiry_type). */
export const INQUIRY_TYPE = Object.freeze({
  GENERAL: "general",
  SCHEDULE_VIEWING: "schedule_viewing",
  MAKE_OFFER: "make_offer",
  RENTAL: "rental",
  PURCHASE: "purchase",
});

/** Viewing request status — DB values; display aliases in viewingStatusLabels.js */
export const VIEWING_STATUS = Object.freeze({
  /** Canonical "requested" */
  PENDING: "pending",
  REQUESTED: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  /** Canonical "reschedule_requested" */
  RESCHEDULED: "rescheduled",
  RESCHEDULE_REQUESTED: "rescheduled",
  /** @deprecated prefer cancelled with response note */
  DECLINED: "declined",
});

export const MESSAGE_SENDER_ROLE = Object.freeze({
  BUYER: "buyer",
  AGENT: "agent",
  SYSTEM: "system",
});

export const CONVERSATION_STATUS = Object.freeze({
  OPEN: "open",
  CLOSED: "closed",
  ARCHIVED: "archived",
});

/** Agent inbox group definitions. */
export const AGENT_INBOX_GROUPS = Object.freeze([
  {
    id: "new",
    label: "New",
    stages: [CRM_PIPELINE_STAGE.NEW_INQUIRY],
    statuses: [INQUIRY_STATUS.NEW],
  },
  {
    id: "awaiting_reply",
    label: "Awaiting Reply",
    stages: [CRM_PIPELINE_STAGE.RESPONDED],
    statuses: [INQUIRY_STATUS.OPENED, INQUIRY_STATUS.RESPONDED],
  },
  {
    id: "viewing_scheduled",
    label: "Viewing Scheduled",
    stages: [CRM_PIPELINE_STAGE.VIEWING_SCHEDULED],
    statuses: [INQUIRY_STATUS.SCHEDULED],
  },
  {
    id: "negotiating",
    label: "Negotiating",
    stages: [
      CRM_PIPELINE_STAGE.NEGOTIATING,
      CRM_PIPELINE_STAGE.OFFER_SENT,
      CRM_PIPELINE_STAGE.OFFER_ACCEPTED,
    ],
    statuses: [],
  },
  {
    id: "archived",
    label: "Archived",
    stages: [CRM_PIPELINE_STAGE.ARCHIVED, CRM_PIPELINE_STAGE.DEAL_CLOSED],
    statuses: [INQUIRY_STATUS.CLOSED, INQUIRY_STATUS.ARCHIVED],
  },
]);

export function resolveInboxGroupId(conversation) {
  const stage = conversation?.pipeline_stage || conversation?.stage || "";
  const status = conversation?.inquiry_status || conversation?.status || "";
  for (const group of AGENT_INBOX_GROUPS) {
    if (group.stages.includes(stage)) return group.id;
    if (group.statuses.includes(status)) return group.id;
  }
  if (stage === CRM_PIPELINE_STAGE.RESPONDED) return "awaiting_reply";
  return "new";
}

export function inquiryTypeLabel(type) {
  switch (type) {
    case INQUIRY_TYPE.SCHEDULE_VIEWING:
      return "Viewing";
    case INQUIRY_TYPE.MAKE_OFFER:
      return "Offer inquiry";
    case INQUIRY_TYPE.RENTAL:
      return "Rental inquiry";
    case INQUIRY_TYPE.PURCHASE:
      return "Purchase inquiry";
    default:
      return "General inquiry";
  }
}
