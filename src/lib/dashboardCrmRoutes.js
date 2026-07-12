import { ADMIN_DASHBOARD_TAB_IDS } from "@/constants/dashboardAdminConfig";
import { USER_DASHBOARD_TAB_IDS } from "@/constants/dashboardUserConfig";
import { AGENT_DASHBOARD_TAB_IDS } from "@/constants/dashboardAgentConfig";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import { LISTING_LIFECYCLE } from "@/constants/operationalModel";

/**
 * Role-aware CRM dashboard path (buyer vs owner surfaces).
 * Admin keeps marketplace buyer + owner tabs on /admin.
 */
export function resolveDashboardCrmPath({
  role,
  tab,
  conversationId,
  viewingId,
} = {}) {
  const normalizedRole = String(role || "user").trim().toLowerCase();
  const base =
    normalizedRole === "admin"
      ? "/admin"
      : normalizedRole === "agent"
        ? "/dashboard/agent"
        : "/dashboard/user";

  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (conversationId) params.set("conversation", String(conversationId));
  if (viewingId) params.set("viewing", String(viewingId));

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** After a buyer sends a listing message, open the correct inbox tab. */
export function resolvePostInquiryMessagesPath({ role, conversationId } = {}) {
  const normalizedRole = String(role || "user").trim().toLowerCase();
  const tab =
    normalizedRole === "admin"
      ? ADMIN_DASHBOARD_TAB_IDS.MESSAGES
      : USER_DASHBOARD_TAB_IDS.MESSAGES;

  return resolveDashboardCrmPath({ role: normalizedRole, tab, conversationId });
}

/** Buyer viewing deep link with exact viewing id. */
export function resolveBuyerViewingsPath({ role, viewingId } = {}) {
  const normalizedRole = String(role || "user").trim().toLowerCase();
  const tab =
    normalizedRole === "admin"
      ? ADMIN_DASHBOARD_TAB_IDS.MY_VIEWINGS
      : USER_DASHBOARD_TAB_IDS.MY_VIEWINGS;

  return resolveDashboardCrmPath({ role: normalizedRole, tab, viewingId });
}

/** Owner/agent notification deep links for new inquiry or viewing request. */
export function resolveOwnerInboxPath({ role, tab, conversationId, viewingId } = {}) {
  const normalizedRole = String(role || "user").trim().toLowerCase();

  if (normalizedRole === "admin") {
    return resolveDashboardCrmPath({
      role,
      tab: tab || ADMIN_DASHBOARD_TAB_IDS.OWNER_INBOX,
      conversationId,
      viewingId,
    });
  }

  if (normalizedRole === "agent") {
    const agentTab =
      tab === "viewings" || tab === AGENT_DASHBOARD_TAB_IDS.VIEWINGS
        ? AGENT_DASHBOARD_TAB_IDS.VIEWINGS
        : tab || AGENT_DASHBOARD_TAB_IDS.INQUIRIES;
    return resolveDashboardCrmPath({
      role,
      tab: agentTab,
      conversationId,
      viewingId,
    });
  }

  const userOwnerTab =
    tab === "viewings" || tab === AGENT_DASHBOARD_TAB_IDS.VIEWINGS
      ? USER_DASHBOARD_TAB_IDS.OWNER_VIEWINGS
      : tab || USER_DASHBOARD_TAB_IDS.OWNER_INBOX;

  return resolveDashboardCrmPath({
    role,
    tab: userOwnerTab,
    conversationId,
    viewingId,
  });
}

function resolveListingManagementPath({ role, listingId } = {}) {
  const normalizedRole = String(role || "user").trim().toLowerCase();
  if (listingId) {
    return `/listing/${listingId}`;
  }
  if (normalizedRole === "admin") {
    return resolveDashboardCrmPath({ role, tab: ADMIN_DASHBOARD_TAB_IDS.LISTINGS });
  }
  if (normalizedRole === "agent") {
    return resolveDashboardCrmPath({ role, tab: AGENT_DASHBOARD_TAB_IDS.LISTINGS });
  }
  return resolveDashboardCrmPath({ role, tab: USER_DASHBOARD_TAB_IDS.MY_LISTINGS });
}

/**
 * Canonical notification destination — exact entity routing per event + recipient role.
 * @param {{ eventType: string, role?: string, payload?: Record<string, unknown> }} params
 */
export function resolveNotificationDestination({ eventType, role, payload = {} } = {}) {
  const recipientRole = String(
    payload.recipient_role ?? payload.recipientRole ?? role ?? "user"
  )
    .trim()
    .toLowerCase();

  const conversationId = payload.conversation_id ?? payload.conversationId ?? null;
  const viewingId = payload.viewing_id ?? payload.viewingId ?? null;
  const listingId = payload.listing_id ?? payload.listingId ?? null;
  const toStatus = String(payload.to_status ?? payload.toStatus ?? "").toLowerCase();

  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.NEW_INQUIRY:
      return resolveOwnerInboxPath({
        role: recipientRole,
        conversationId,
        viewingId: payload.inquiry_type === "schedule_viewing" ? viewingId : null,
      });

    case NOTIFICATION_EVENT_TYPES.AGENT_REPLIED:
      return resolvePostInquiryMessagesPath({ role: recipientRole, conversationId });

    case NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED:
      return resolveOwnerInboxPath({
        role: recipientRole,
        tab: "viewings",
        viewingId,
        conversationId,
      });

    case NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED:
    case NOTIFICATION_EVENT_TYPES.VIEWING_CANCELLED:
    case NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED:
    case NOTIFICATION_EVENT_TYPES.VIEWING_RESCHEDULED:
      if (recipientRole === "agent" || recipientRole === "admin") {
        return resolveOwnerInboxPath({
          role: recipientRole,
          tab: "viewings",
          viewingId,
        });
      }
      return resolveBuyerViewingsPath({ role: recipientRole, viewingId });

    case NOTIFICATION_EVENT_TYPES.INQUIRY_ARCHIVED:
      if (recipientRole === "admin") {
        return resolveDashboardCrmPath({ role: "admin", tab: ADMIN_DASHBOARD_TAB_IDS.OWNER_INBOX });
      }
      if (recipientRole === "agent") {
        return resolveDashboardCrmPath({ role: "agent", tab: AGENT_DASHBOARD_TAB_IDS.INQUIRIES });
      }
      return resolveDashboardCrmPath({ role: "user", tab: USER_DASHBOARD_TAB_IDS.OWNER_INBOX });

    default:
      if (
        toStatus === LISTING_LIFECYCLE.RECENTLY_SOLD ||
        toStatus === LISTING_LIFECYCLE.RECENTLY_RENTED ||
        toStatus === LISTING_LIFECYCLE.SOLD ||
        toStatus === LISTING_LIFECYCLE.RENTED
      ) {
        return resolveListingManagementPath({ role: recipientRole, listingId });
      }
      if (listingId) {
        return `/listing/${listingId}`;
      }
      return resolveDashboardCrmPath({ role: recipientRole });
  }
}

/** Infer dashboard tab from deep-link query when tab is omitted. */
export function resolveUserDashboardTabFromQuery(query = {}) {
  const tabRaw = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  if (tabRaw) return String(tabRaw).trim().toLowerCase();

  const conversation = Array.isArray(query.conversation) ? query.conversation[0] : query.conversation;
  if (conversation) return USER_DASHBOARD_TAB_IDS.MESSAGES;

  const viewing = Array.isArray(query.viewing) ? query.viewing[0] : query.viewing;
  if (viewing) return USER_DASHBOARD_TAB_IDS.MY_VIEWINGS;

  return USER_DASHBOARD_TAB_IDS.OVERVIEW;
}

/** Infer agent dashboard tab from deep-link query when tab is omitted. */
export function resolveAgentDashboardTabFromQuery(query = {}) {
  const tabRaw = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  if (tabRaw) return String(tabRaw).trim().toLowerCase();

  const conversation = Array.isArray(query.conversation) ? query.conversation[0] : query.conversation;
  if (conversation) return AGENT_DASHBOARD_TAB_IDS.INQUIRIES;

  const viewing = Array.isArray(query.viewing) ? query.viewing[0] : query.viewing;
  if (viewing) return AGENT_DASHBOARD_TAB_IDS.VIEWINGS;

  return AGENT_DASHBOARD_TAB_IDS.OVERVIEW;
}
