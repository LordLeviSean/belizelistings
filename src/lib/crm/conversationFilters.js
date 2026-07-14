import { INQUIRY_TYPE } from "./crmConstants";

function inquiryRowFromConversation(conv) {
  const inquiry = conv?.listing_inquiries;
  return Array.isArray(inquiry) ? inquiry[0] : inquiry;
}

/** True when the conversation was created solely by Schedule Viewing (not a manual message). */
export function isViewingOnlyConversation(conv) {
  const row = inquiryRowFromConversation(conv);
  return row?.inquiry_type === INQUIRY_TYPE.SCHEDULE_VIEWING;
}

/** Exclude synthetic viewing-request threads from Inbox surfaces. */
export function filterInboxConversations(conversations = []) {
  return (conversations || []).filter((conv) => !isViewingOnlyConversation(conv));
}
