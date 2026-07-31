import { ADMIN_DASHBOARD_TAB_IDS } from "@/constants/dashboardAdminConfig";
import { USER_DASHBOARD_TAB_IDS } from "@/constants/dashboardUserConfig";
import { AGENT_DASHBOARD_TAB_IDS } from "@/constants/dashboardAgentConfig";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { resolveGeographicUpdateListingsHref } from "@/lib/geography/resolveGeographicUpdateListingsHref";

export { resolveGeographicUpdateListingsHref };

/**
 * Role-aware CRM dashboard path (buyer vs owner surfaces).
 */
export function resolveDashboardCrmPath({
  role,
  tab,
  conversationId,
  viewingId,
  listingId,
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
  if (listingId) params.set("listing", String(listingId));

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function resolveRecipientContext(payload = {}) {
  const role = String(payload.recipient_role ?? payload.recipientRole ?? "user")
    .trim()
    .toLowerCase();
  const explicitSide = String(payload.recipient_side ?? payload.recipientSide ?? "")
    .trim()
    .toLowerCase();

  let side = explicitSide;
  if (!side) {
    if (role === "agent") side = "agent";
    else if (role === "admin") side = "admin";
    else side = "buyer";
  }

  return { role, side };
}

/** Open the exact conversation for message notifications. */
export function resolveMessageConversationPath({
  role,
  side,
  conversationId,
} = {}) {
  const recipientRole = String(role || "user").trim().toLowerCase();
  const recipientSide = String(side || "buyer").trim().toLowerCase();

  if (recipientRole === "admin") {
    return resolveDashboardCrmPath({
      role: "admin",
      tab: ADMIN_DASHBOARD_TAB_IDS.INBOX,
      conversationId,
    });
  }

  if (recipientRole === "agent" || recipientSide === "agent") {
    return resolveDashboardCrmPath({
      role: "agent",
      tab: AGENT_DASHBOARD_TAB_IDS.INBOX,
      conversationId,
    });
  }

  return resolveDashboardCrmPath({
    role: "user",
    tab: USER_DASHBOARD_TAB_IDS.INBOX,
    conversationId,
  });
}

/** Open the exact structured viewing request. */
export function resolveViewingRequestPath({ role, side, viewingId, conversationId } = {}) {
  const recipientRole = String(role || "user").trim().toLowerCase();

  if (recipientRole === "admin") {
    return resolveDashboardCrmPath({
      role: "admin",
      tab: ADMIN_DASHBOARD_TAB_IDS.VIEWINGS,
      viewingId,
      conversationId,
    });
  }

  if (recipientRole === "agent" || side === "agent") {
    return resolveDashboardCrmPath({
      role: "agent",
      tab: AGENT_DASHBOARD_TAB_IDS.VIEWINGS,
      viewingId,
      conversationId,
    });
  }

  return resolveDashboardCrmPath({
    role: "user",
    tab: USER_DASHBOARD_TAB_IDS.VIEWINGS,
    viewingId,
    conversationId,
  });
}

/** After a buyer sends a listing message, open Inbox. */
export function resolvePostInquiryMessagesPath({ role, conversationId } = {}) {
  return resolveMessageConversationPath({
    role: role || "user",
    side: "buyer",
    conversationId,
  });
}

/** Buyer viewing deep link with exact viewing id. */
export function resolveBuyerViewingsPath({ role, viewingId } = {}) {
  return resolveViewingRequestPath({
    role: role || "user",
    side: "buyer",
    viewingId,
  });
}

/** Owner/agent notification deep links for inquiries or viewing requests. */
export function resolveOwnerInboxPath({ role, tab, conversationId, viewingId } = {}) {
  const normalizedRole = String(role || "user").trim().toLowerCase();

  if (normalizedRole === "admin") {
    const adminTab =
      tab === "viewings" || tab === ADMIN_DASHBOARD_TAB_IDS.VIEWINGS
        ? ADMIN_DASHBOARD_TAB_IDS.VIEWINGS
        : tab || ADMIN_DASHBOARD_TAB_IDS.INBOX;
    return resolveDashboardCrmPath({
      role,
      tab: adminTab,
      conversationId,
      viewingId,
    });
  }

  if (normalizedRole === "agent") {
    const agentTab =
      tab === "viewings" || tab === AGENT_DASHBOARD_TAB_IDS.VIEWINGS
        ? AGENT_DASHBOARD_TAB_IDS.VIEWINGS
        : tab || AGENT_DASHBOARD_TAB_IDS.INBOX;
    return resolveDashboardCrmPath({
      role,
      tab: agentTab,
      conversationId,
      viewingId,
    });
  }

  const userTab =
    tab === "viewings" || tab === USER_DASHBOARD_TAB_IDS.VIEWINGS
      ? USER_DASHBOARD_TAB_IDS.VIEWINGS
      : tab || USER_DASHBOARD_TAB_IDS.INBOX;

  return resolveDashboardCrmPath({
    role,
    tab: userTab,
    conversationId,
    viewingId,
  });
}

function resolveListingManagementPath({ role, listingId, toStatus } = {}) {
  const normalizedRole = String(role || "user").trim().toLowerCase();
  const status = String(toStatus || "").toLowerCase();

  if (normalizedRole === "admin") {
    if (status === LISTING_LIFECYCLE.PENDING_REVIEW || status === "pending") {
      return resolveDashboardCrmPath({ role: "admin", tab: ADMIN_DASHBOARD_TAB_IDS.PENDING, listingId });
    }
    return resolveDashboardCrmPath({ role: "admin", tab: ADMIN_DASHBOARD_TAB_IDS.LISTINGS, listingId });
  }

  if (normalizedRole === "agent") {
    return resolveDashboardCrmPath({ role: "agent", tab: AGENT_DASHBOARD_TAB_IDS.LISTINGS, listingId });
  }

  if (status === LISTING_LIFECYCLE.PENDING_REVIEW || status === "pending") {
    return resolveDashboardCrmPath({ role: "user", tab: USER_DASHBOARD_TAB_IDS.PENDING, listingId });
  }

  return resolveDashboardCrmPath({ role: "user", tab: USER_DASHBOARD_TAB_IDS.MY_LISTINGS, listingId });
}


export function resolveNotificationDestination({ eventType, role, payload = {} } = {}) {
  const { role: recipientRole, side: recipientSide } = resolveRecipientContext({
    ...payload,
    recipient_role: payload.recipient_role ?? payload.recipientRole ?? role ?? "user",
  });

  const conversationId = payload.conversation_id ?? payload.conversationId ?? null;
  const viewingId = payload.viewing_id ?? payload.viewingId ?? null;
  const listingId = payload.listing_id ?? payload.listingId ?? null;
  const inquiryType = String(payload.inquiry_type ?? payload.inquiryType ?? "general").toLowerCase();
  const toStatus = String(payload.to_status ?? payload.toStatus ?? "").toLowerCase();

  switch (eventType) {
    case "geographic_update_v1":
      return resolveGeographicUpdateListingsHref(recipientRole);

    case NOTIFICATION_EVENT_TYPES.NEW_INQUIRY:
      if (inquiryType === "schedule_viewing") {
        return viewingId
          ? resolveViewingRequestPath({
              role: recipientRole,
              side: recipientSide === "buyer" ? "owner" : recipientSide,
              viewingId,
            })
          : resolveViewingRequestPath({
              role: recipientRole,
              side: recipientSide === "buyer" ? "owner" : recipientSide,
            });
      }
      return resolveMessageConversationPath({
        role: recipientRole,
        side: recipientSide === "buyer" ? "owner" : recipientSide,
        conversationId,
      });

    case NOTIFICATION_EVENT_TYPES.AGENT_REPLIED:
      return resolveMessageConversationPath({
        role: recipientRole,
        side: "buyer",
        conversationId,
      });

    case NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED:
    case NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED:
    case NOTIFICATION_EVENT_TYPES.VIEWING_CANCELLED:
    case NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED:
    case NOTIFICATION_EVENT_TYPES.VIEWING_RESCHEDULED:
      return resolveViewingRequestPath({
        role: recipientRole,
        side: recipientSide,
        viewingId,
      });

    case NOTIFICATION_EVENT_TYPES.VIEWING_COMPLETED:
      return resolveViewingRequestPath({
        role: recipientRole,
        side: recipientSide,
        viewingId,
      });

    case NOTIFICATION_EVENT_TYPES.INQUIRY_ARCHIVED:
      return resolveMessageConversationPath({
        role: recipientRole,
        side: recipientSide === "buyer" ? "owner" : recipientSide,
        conversationId,
      });

    default:
      if (
        toStatus === LISTING_LIFECYCLE.RECENTLY_SOLD ||
        toStatus === LISTING_LIFECYCLE.RECENTLY_RENTED ||
        toStatus === LISTING_LIFECYCLE.SOLD ||
        toStatus === LISTING_LIFECYCLE.RENTED ||
        toStatus === LISTING_LIFECYCLE.ARCHIVED ||
        toStatus === LISTING_LIFECYCLE.EXPIRED ||
        toStatus === LISTING_LIFECYCLE.PUBLISHED ||
        toStatus === LISTING_LIFECYCLE.REJECTED ||
        toStatus === LISTING_LIFECYCLE.PENDING_REVIEW
      ) {
        return resolveListingManagementPath({ role: recipientRole, listingId, toStatus });
      }
      if (listingId) {
        return resolveListingManagementPath({ role: recipientRole, listingId, toStatus });
      }
      return resolveDashboardCrmPath({ role: recipientRole });
  }
}

/** Infer dashboard tab from deep-link query when tab is omitted. */
export function resolveUserDashboardTabFromQuery(query = {}) {
  const tabRaw = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  if (tabRaw) {
    const normalized = String(tabRaw).trim().toLowerCase();
    if (normalized === "messages" || normalized === "owner-inbox") return USER_DASHBOARD_TAB_IDS.INBOX;
    if (normalized === "my-viewings" || normalized === "owner-viewings" || normalized === "viewing-requests") {
      return USER_DASHBOARD_TAB_IDS.VIEWINGS;
    }
    return normalized;
  }

  const conversation = Array.isArray(query.conversation) ? query.conversation[0] : query.conversation;
  if (conversation) return USER_DASHBOARD_TAB_IDS.INBOX;

  const viewing = Array.isArray(query.viewing) ? query.viewing[0] : query.viewing;
  if (viewing) return USER_DASHBOARD_TAB_IDS.VIEWINGS;

  const listing = Array.isArray(query.listing) ? query.listing[0] : query.listing;
  if (listing) return USER_DASHBOARD_TAB_IDS.MY_LISTINGS;

  return USER_DASHBOARD_TAB_IDS.OVERVIEW;
}

export function resolveAgentDashboardTabFromQuery(query = {}) {
  const tabRaw = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  if (tabRaw) {
    const normalized = String(tabRaw).trim().toLowerCase();
    if (normalized === "inquiries") return AGENT_DASHBOARD_TAB_IDS.INBOX;
    if (normalized === "viewings" || normalized === "viewing-requests") return AGENT_DASHBOARD_TAB_IDS.VIEWINGS;
    return normalized;
  }

  const conversation = Array.isArray(query.conversation) ? query.conversation[0] : query.conversation;
  if (conversation) return AGENT_DASHBOARD_TAB_IDS.INBOX;

  const viewing = Array.isArray(query.viewing) ? query.viewing[0] : query.viewing;
  if (viewing) return AGENT_DASHBOARD_TAB_IDS.VIEWINGS;

  const listing = Array.isArray(query.listing) ? query.listing[0] : query.listing;
  if (listing) return AGENT_DASHBOARD_TAB_IDS.LISTINGS;

  return AGENT_DASHBOARD_TAB_IDS.OVERVIEW;
}

export function resolveAdminDashboardTabFromQuery(query = {}) {
  const tabRaw = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  if (tabRaw) {
    const normalized = String(tabRaw).trim().toLowerCase();
    if (normalized === "messages" || normalized === "owner-inbox") return ADMIN_DASHBOARD_TAB_IDS.INBOX;
    if (normalized === "my-viewings" || normalized === "owner-viewings" || normalized === "viewing-requests") {
      return ADMIN_DASHBOARD_TAB_IDS.VIEWINGS;
    }
    return normalized;
  }

  const conversation = Array.isArray(query.conversation) ? query.conversation[0] : query.conversation;
  if (conversation) return ADMIN_DASHBOARD_TAB_IDS.INBOX;

  const viewing = Array.isArray(query.viewing) ? query.viewing[0] : query.viewing;
  if (viewing) return ADMIN_DASHBOARD_TAB_IDS.VIEWINGS;

  const listing = Array.isArray(query.listing) ? query.listing[0] : query.listing;
  if (listing) return ADMIN_DASHBOARD_TAB_IDS.LISTINGS;

  const upgradeRequest = Array.isArray(query.request) ? query.request[0] : query.request;
  if (upgradeRequest) return ADMIN_DASHBOARD_TAB_IDS.UPGRADES;

  return ADMIN_DASHBOARD_TAB_IDS.PENDING;
}
