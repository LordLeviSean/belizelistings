import { buildNotificationPresentation } from "@/lib/notifications/notificationCopyRegistry";
import { readWebPushDeliveryState } from "@/lib/push/webPushDeliveryState";

/** Event types with Web Push wiring — keep in sync with deliverNewInquiryWebPush CONNECTED_PUSH_EVENT_TYPES. */
export const CONNECTED_PUSH_EVENT_TYPES = Object.freeze([
  "new_inquiry",
  "buyer_replied",
  "agent_replied",
  "admin_replied",
  "viewing_requested",
  "viewing_confirmed",
  "viewing_declined",
]);

export const DEFAULT_DIAGNOSTICS_LIMIT = 50;
export const MAX_DIAGNOSTICS_LIMIT = 100;

export const DELIVERY_MODES = Object.freeze({
  IMMEDIATE_API: "Immediate API",
  BROWSER_BRIDGE: "Browser Bridge",
  CRON_RECOVERY: "Cron Recovery",
  IN_APP_ONLY: "In-App Only",
  DIRECT_TEST: "Direct/Test",
  UNKNOWN: "Unknown",
});

const CRON_QUEUE_WAIT_MS = 30_000;
const CRON_PUSH_LATENCY_MS = 45_000;
const IMMEDIATE_PUSH_LATENCY_MS = 15_000;
const IMMEDIATE_QUEUE_WAIT_MS = 10_000;

/**
 * @param {string|null|undefined} value
 * @param {{ prefix?: number, suffix?: number }} [opts]
 */
export function formatShortId(value, opts = {}) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const prefix = Number(opts.prefix) > 0 ? Number(opts.prefix) : 4;
  const suffix = Number(opts.suffix) > 0 ? Number(opts.suffix) : 4;
  if (raw.length <= prefix + suffix + 1) return raw;
  return `${raw.slice(0, prefix)}…${raw.slice(-suffix)}`;
}

/**
 * @param {string|null|undefined} endpoint
 */
export function maskPushSubscriptionEndpoint(endpoint) {
  const raw = String(endpoint || "").trim();
  if (!raw) return null;
  const tail = raw.slice(-4);
  return `…${tail}`;
}

/**
 * @param {string|null|undefined} endpoint
 * @param {string|null|undefined} platformLabel
 */
export function formatMaskedSubscriptionLabel(platformLabel, endpoint) {
  const platform = String(platformLabel || "Device").trim() || "Device";
  const masked = maskPushSubscriptionEndpoint(endpoint);
  return masked ? `${platform} • subscription ${masked}` : platform;
}

/**
 * @param {number|null|undefined} startMs
 * @param {number|null|undefined} endMs
 */
export function formatDeliveryLatency(startMs, endMs) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  const deltaMs = endMs - startMs;
  if (deltaMs < 60_000) {
    return `${(deltaMs / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(deltaMs / 60_000);
  const seconds = Math.round((deltaMs % 60_000) / 1000);
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function parseTimestamp(value) {
  if (!value) return null;
  const ts = Date.parse(String(value));
  return Number.isFinite(ts) ? ts : null;
}

function readPayloadObject(payload) {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
}

/**
 * @param {object} payload
 */
export function readEntityRefs(payload = {}) {
  const root = readPayloadObject(payload);
  return {
    conversationId: root.conversation_id ?? root.conversationId ?? null,
    viewingId: root.viewing_id ?? root.viewingId ?? null,
    listingId: root.listing_id ?? root.listingId ?? null,
    inquiryId: root.inquiry_id ?? root.inquiryId ?? null,
    messageId: root.message_id ?? root.messageId ?? null,
    dedupeKey: root.dedupe_key ?? root.dedupeKey ?? null,
    senderRole: root.sender_role ?? root.senderRole ?? null,
    senderName: root.sender_name ?? root.senderName ?? null,
  };
}

/**
 * @param {ReturnType<typeof readEntityRefs>} entity
 */
export function formatEntitySummary(entity = {}) {
  if (entity.conversationId) {
    return { kind: "conversation", label: `Conversation ${formatShortId(entity.conversationId)}` };
  }
  if (entity.viewingId) {
    return { kind: "viewing", label: `Viewing ${formatShortId(entity.viewingId)}` };
  }
  if (entity.listingId) {
    return { kind: "listing", label: `Listing ${entity.listingId}` };
  }
  if (entity.inquiryId) {
    return { kind: "inquiry", label: `Inquiry ${formatShortId(entity.inquiryId)}` };
  }
  return { kind: null, label: "—" };
}

/**
 * @param {{
 *   eventType?: string|null,
 *   queueRow?: object|null,
 *   notificationRow?: object|null,
 *   pushState?: ReturnType<typeof readWebPushDeliveryState>,
 * }} input
 */
export function deriveDeliveryMode({
  eventType = null,
  queueRow = null,
  notificationRow = null,
  pushState = null,
} = {}) {
  const type = String(eventType || queueRow?.event_type || notificationRow?.event_type || "").trim();
  const payload = {
    ...readPayloadObject(queueRow?.payload),
    ...readPayloadObject(notificationRow?.payload),
  };

  if (type === "push_test" || payload.test === true || payload.push_test === true) {
    return DELIVERY_MODES.DIRECT_TEST;
  }

  const push = pushState || readWebPushDeliveryState(notificationRow?.payload);
  const pushConnected = CONNECTED_PUSH_EVENT_TYPES.includes(type);

  if (!pushConnected && push.status === "not_attempted") {
    return DELIVERY_MODES.IN_APP_ONLY;
  }

  const queueCreated = parseTimestamp(queueRow?.created_at || queueRow?.scheduled_at);
  const queueProcessed = parseTimestamp(queueRow?.processed_at);
  const pushDelivered = parseTimestamp(push.delivered_at);

  if (!queueCreated) {
    return DELIVERY_MODES.UNKNOWN;
  }

  if (pushDelivered) {
    const pushLatencyMs = pushDelivered - queueCreated;
    const queueWaitMs = queueProcessed ? queueProcessed - queueCreated : null;

    if (
      (queueWaitMs != null && queueWaitMs >= CRON_QUEUE_WAIT_MS) ||
      pushLatencyMs >= CRON_PUSH_LATENCY_MS
    ) {
      return DELIVERY_MODES.CRON_RECOVERY;
    }

    if (
      pushLatencyMs <= IMMEDIATE_PUSH_LATENCY_MS &&
      (queueWaitMs == null || queueWaitMs <= IMMEDIATE_QUEUE_WAIT_MS)
    ) {
      return DELIVERY_MODES.IMMEDIATE_API;
    }

    return DELIVERY_MODES.UNKNOWN;
  }

  if (queueRow?.status === "pending" || queueRow?.status === "processing") {
    return DELIVERY_MODES.UNKNOWN;
  }

  if (pushConnected && push.status === "not_attempted") {
    if (queueProcessed && queueProcessed - queueCreated >= CRON_QUEUE_WAIT_MS) {
      return DELIVERY_MODES.CRON_RECOVERY;
    }
    return DELIVERY_MODES.UNKNOWN;
  }

  if (!pushConnected) {
    return DELIVERY_MODES.IN_APP_ONLY;
  }

  return DELIVERY_MODES.UNKNOWN;
}

/**
 * @param {string|null|undefined} pushStatus
 * @param {string|null|undefined} queueStatus
 */
export function deriveHealthIndicator(pushStatus, queueStatus) {
  if (pushStatus === "delivered") return "Delivered";
  if (pushStatus === "no_subscription") return "No subscription";
  if (pushStatus === "failed") return "Failed";
  if (pushStatus === "temporary_failure") return "Pending";
  if (pushStatus === "in_progress") return "Pending";
  if (queueStatus === "failed") return "Failed";
  if (queueStatus === "skipped") return "Skipped";
  if (queueStatus === "pending" || queueStatus === "processing") return "Pending";
  if (pushStatus === "not_attempted") return "In-app only";
  return "Unknown";
}

/**
 * @param {import('http').IncomingMessage} req
 */
export function parseNotificationDiagnosticsQuery(req) {
  const query = req.query && typeof req.query === "object" ? req.query : {};
  const read = (key) => {
    const value = query[key];
    return String(Array.isArray(value) ? value[0] : value || "").trim();
  };

  const limitRaw = Number(read("limit"));
  const offsetRaw = Number(read("offset"));

  return {
    limit: Number.isFinite(limitRaw)
      ? Math.min(MAX_DIAGNOSTICS_LIMIT, Math.max(1, limitRaw))
      : DEFAULT_DIAGNOSTICS_LIMIT,
    offset: Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0,
    eventType: read("eventType") || read("event_type") || null,
    queueStatus: read("queueStatus") || read("queue_status") || null,
    pushStatus: read("pushStatus") || read("push_status") || null,
    deliveryMode: read("deliveryMode") || read("delivery_mode") || null,
    recipientId: read("recipientId") || read("recipient_id") || null,
    entityId: read("entityId") || read("entity_id") || null,
    search: read("search") || read("q") || null,
    since: read("since") || null,
    until: read("until") || null,
  };
}

function entityMatchesSearch(entity, search) {
  const needle = String(search || "").trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    entity.conversationId,
    entity.viewingId,
    entity.listingId,
    entity.inquiryId,
    entity.messageId,
    entity.dedupeKey,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return haystack.some((value) => value.includes(needle));
}

/**
 * @param {{
 *   queueRow: object,
 *   notificationRow?: object|null,
 *   recipientProfile?: object|null,
 *   subscriptions?: Array<object>,
 * }} input
 */
export function projectNotificationDiagnosticRow({
  queueRow,
  notificationRow = null,
  recipientProfile = null,
  subscriptions = [],
} = {}) {
  const queuePayload = readPayloadObject(queueRow?.payload);
  const notificationPayload = readPayloadObject(notificationRow?.payload);
  const mergedPayload = { ...queuePayload, ...notificationPayload };
  const entity = readEntityRefs(mergedPayload);
  const pushState = readWebPushDeliveryState(notificationRow?.payload);
  const eventType = queueRow?.event_type || notificationRow?.event_type || null;
  const recipientId = queueRow?.recipient_id || notificationRow?.recipient_user_id || null;
  const presentation = eventType
    ? buildNotificationPresentation(eventType, {
        ...mergedPayload,
        recipient_role: recipientProfile?.role ?? mergedPayload.recipient_role,
      })
    : null;

  const queueCreatedMs = parseTimestamp(queueRow?.created_at || queueRow?.scheduled_at);
  const pushDeliveredMs = parseTimestamp(pushState.delivered_at);
  const deliveryLatency = formatDeliveryLatency(queueCreatedMs, pushDeliveredMs);
  const deliveryMode = deriveDeliveryMode({
    eventType,
    queueRow,
    notificationRow,
    pushState,
  });

  const maskedSubscriptions = (subscriptions || []).slice(0, 5).map((sub) => ({
    id: formatShortId(sub.id),
    label: formatMaskedSubscriptionLabel(sub.platform_label, sub.endpoint),
    isActive: Boolean(sub.is_active),
    lastDeliveredAt: sub.last_delivered_at ?? null,
    lastFailedAt: sub.last_failed_at ?? null,
  }));

  return {
    id: queueRow?.id || notificationRow?.id,
    queueId: queueRow?.id ?? null,
    notificationId: notificationRow?.id ?? null,
    timestamp: queueRow?.created_at || notificationRow?.created_at || null,
    eventType,
    recipient: {
      id: recipientId,
      shortId: formatShortId(recipientId),
      displayName:
        recipientProfile?.username ||
        recipientProfile?.email ||
        (recipientId ? `User ${formatShortId(recipientId)}` : "—"),
      role: recipientProfile?.role ?? null,
    },
    sender: {
      role: entity.senderRole,
      name: entity.senderName,
    },
    entity: {
      ...entity,
      summary: formatEntitySummary(entity),
    },
    queue: {
      status: queueRow?.status ?? null,
      attempts: queueRow?.attempts ?? null,
      queuedAt: queueRow?.created_at ?? queueRow?.scheduled_at ?? null,
      processedAt: queueRow?.processed_at ?? null,
      scheduledAt: queueRow?.scheduled_at ?? null,
    },
    inbox: {
      status: notificationRow?.id ? "created" : "missing",
      createdAt: notificationRow?.created_at ?? null,
      readAt: notificationRow?.read_at ?? null,
      title: notificationRow?.title ?? presentation?.title ?? null,
      body: notificationRow?.body ?? presentation?.body ?? null,
      dedupeKey: notificationRow?.dedupe_key ?? entity.dedupeKey ?? presentation?.dedupeKey ?? null,
    },
    push: {
      status: pushState.status,
      attemptedAt: pushState.attempted_at,
      deliveredAt: pushState.delivered_at,
      deliveredCount: pushState.delivered_count,
      lastReason: pushState.last_reason,
      subscriptions: maskedSubscriptions,
    },
    navigation: {
      href: presentation?.href ?? null,
      destination: presentation?.href ?? null,
      clickTracked: false,
    },
    deliveryMode,
    deliveryLatency,
    healthIndicator: deriveHealthIndicator(pushState.status, queueRow?.status),
    result: deriveHealthIndicator(pushState.status, queueRow?.status),
  };
}

/**
 * @param {Array<object>} rows
 * @param {ReturnType<typeof parseNotificationDiagnosticsQuery>} filters
 */
export function filterNotificationDiagnosticRows(rows, filters) {
  return (rows || []).filter((row) => {
    if (filters.pushStatus && row.push?.status !== filters.pushStatus) return false;
    if (filters.deliveryMode && row.deliveryMode !== filters.deliveryMode) return false;
    if (filters.entityId) {
      const needle = String(filters.entityId).trim().toLowerCase();
      const values = [
        row.entity?.conversationId,
        row.entity?.viewingId,
        row.entity?.listingId,
        row.entity?.inquiryId,
        row.entity?.messageId,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      if (!values.some((value) => value.includes(needle))) return false;
    }
    if (filters.search && !entityMatchesSearch(row.entity, filters.search)) return false;
    return true;
  });
}

/**
 * @param {Array<object>} rows
 */
export function summarizeNotificationDiagnostics(rows) {
  const summary = {
    total: rows.length,
    pushDelivered: 0,
    pending: 0,
    failed: 0,
    noSubscription: 0,
    cronRecovered: 0,
    inAppOnly: 0,
  };

  for (const row of rows) {
    if (row.push?.status === "delivered") summary.pushDelivered += 1;
    if (row.push?.status === "no_subscription") summary.noSubscription += 1;
    if (row.push?.status === "failed" || row.queue?.status === "failed") summary.failed += 1;
    if (
      row.queue?.status === "pending" ||
      row.queue?.status === "processing" ||
      row.push?.status === "temporary_failure" ||
      row.push?.status === "in_progress"
    ) {
      summary.pending += 1;
    }
    if (row.deliveryMode === DELIVERY_MODES.CRON_RECOVERY) summary.cronRecovered += 1;
    if (row.deliveryMode === DELIVERY_MODES.IN_APP_ONLY) summary.inAppOnly += 1;
  }

  return summary;
}
