import { DELIVERY_MODES, formatShortId } from "./notificationDiagnostics";

const FORBIDDEN_TRACE_KEYS = new Set([
  "endpoint",
  "p256dh",
  "auth_secret",
  "authSecret",
  "vapid",
  "token",
  "serviceRole",
  "service_role",
]);

/**
 * @param {string|null|undefined} iso
 */
export function formatDiagnosticTraceTimestamp(iso) {
  if (!iso) return "Not available";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Not available";

  try {
    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Belize",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
    return `${formatted} America/Belize`;
  } catch {
    return "Not available";
  }
}

/**
 * @param {unknown} value
 * @param {{ empty?: string }} [opts]
 */
export function formatTraceField(value, opts = {}) {
  const empty = opts.empty ?? "—";
  if (value === null || value === undefined || value === "") return empty;
  return String(value);
}

/**
 * @param {string|null|undefined} href
 */
export function parseDiagnosticNavigation(href) {
  if (!href) {
    return {
      dashboard: "Unknown",
      tab: "Unknown",
      entityParam: "Not available",
    };
  }

  try {
    const url = new URL(href, "https://belizelistings.local");
    const segments = url.pathname.split("/").filter(Boolean);
    const dashboard = segments[0] === "dashboard" ? segments[1] || "Unknown" : segments[0] || "Unknown";
    const tab = url.searchParams.get("tab") || "Not available";
    const entityParam =
      ["conversation", "viewing", "listing", "request"]
        .map((key) => {
          const value = url.searchParams.get(key);
          return value ? `${key}=${value}` : null;
        })
        .find(Boolean) || "Not available";

    return { dashboard, tab, entityParam };
  } catch {
    return {
      dashboard: "Unknown",
      tab: "Unknown",
      entityParam: "Not available",
    };
  }
}

/**
 * @param {object} row
 */
export function deriveDiagnosticChecks(row) {
  const queueToInbox =
    row.inbox?.status === "created"
      ? "PASS"
      : row.queue?.status === "pending" || row.queue?.status === "processing"
        ? "PENDING"
        : "FAIL";

  let inboxToPush = "Unknown";
  if (row.deliveryMode === DELIVERY_MODES.IN_APP_ONLY) {
    inboxToPush = "N/A";
  } else if (row.push?.status === "delivered") {
    inboxToPush = "PASS";
  } else if (row.push?.status === "no_subscription") {
    inboxToPush = "NO SUBSCRIPTION";
  } else if (row.push?.status === "failed") {
    inboxToPush = "FAIL";
  } else if (row.inbox?.status !== "created") {
    inboxToPush = "N/A";
  } else if (
    row.push?.status === "not_attempted" ||
    row.push?.status === "in_progress" ||
    row.push?.status === "temporary_failure"
  ) {
    inboxToPush = "PENDING";
  }

  const canonicalDestination = row.navigation?.href ? "PASS" : "FAIL";

  return {
    queueToInbox,
    inboxToPush,
    canonicalDestination,
    clickTracking: row.navigation?.clickTracked ? "Tracked" : "Not tracked",
  };
}

/**
 * @param {object} row
 */
export function formatNotificationDiagnosticTrace(row) {
  if (!row || typeof row !== "object") {
    return "# NOTIFICATION DIAGNOSTIC TRACE\n\nNot available";
  }

  const checks = deriveDiagnosticChecks(row);
  const navigation = parseDiagnosticNavigation(row.navigation?.href);
  const deviceLabel =
    row.push?.subscriptions?.length > 0
      ? row.push.subscriptions.map((sub) => sub.label).join(", ")
      : "Not available";
  const errorOrSkip =
    row.queue?.status === "skipped"
      ? row.push?.lastReason || "skipped"
      : row.queue?.status === "failed"
        ? row.push?.lastReason || "failed"
        : row.push?.lastReason || "none";

  const lines = [
    "# NOTIFICATION DIAGNOSTIC TRACE",
    "",
    "## Event",
    `Event Type: ${formatTraceField(row.eventType, { empty: "Unknown" })}`,
    `Created: ${formatDiagnosticTraceTimestamp(row.timestamp)}`,
    `Recipient: ${formatTraceField(row.recipient?.displayName, { empty: "Not available" })}`,
    `Actor Role: ${formatTraceField(row.sender?.role, { empty: "Unknown" })}`,
    `Dedupe Key: ${formatTraceField(row.inbox?.dedupeKey, { empty: "Not available" })}`,
    "",
    "## Entity",
    `Viewing ID: ${formatTraceField(row.entity?.viewingId)}`,
    `Conversation ID: ${formatTraceField(row.entity?.conversationId)}`,
    `Listing ID: ${formatTraceField(row.entity?.listingId)}`,
    `Inquiry ID: ${formatTraceField(row.entity?.inquiryId)}`,
    `Message ID: ${formatTraceField(row.entity?.messageId)}`,
    "",
    "## Queue",
    `Queue ID: ${formatTraceField(formatShortId(row.queueId), { empty: "Not available" })}`,
    `Status: ${formatTraceField(row.queue?.status, { empty: "Unknown" })}`,
    `Queued At: ${formatDiagnosticTraceTimestamp(row.queue?.queuedAt)}`,
    `Processing At: ${formatDiagnosticTraceTimestamp(row.queue?.processedAt)}`,
    `Completed At: ${
      row.queue?.status === "sent" || row.queue?.status === "skipped"
        ? formatDiagnosticTraceTimestamp(row.queue?.processedAt)
        : "Not available"
    }`,
    `Retry Count: ${formatTraceField(row.queue?.attempts ?? 0)}`,
    `Error / Skip Reason: ${formatTraceField(errorOrSkip, { empty: "none" })}`,
    "",
    "## Durable Notification",
    `Notification ID: ${formatTraceField(formatShortId(row.notificationId), { empty: "Not available" })}`,
    `Status: ${formatTraceField(row.inbox?.status, { empty: "Unknown" })}`,
    `Created At: ${formatDiagnosticTraceTimestamp(row.inbox?.createdAt)}`,
    `Title: ${formatTraceField(row.inbox?.title, { empty: "Not available" })}`,
    `Body: ${formatTraceField(row.inbox?.body, { empty: "Not available" })}`,
    `Canonical Href:`,
    `${formatTraceField(row.navigation?.href, { empty: "Not available" })}`,
    "",
    "## Push",
    `Push Status: ${formatTraceField(row.push?.status, { empty: "Unknown" })}`,
    `Delivery Mode: ${formatTraceField(row.deliveryMode, { empty: "Unknown" })}`,
    `Attempted At: ${formatDiagnosticTraceTimestamp(row.push?.attemptedAt)}`,
    `Delivered At: ${formatDiagnosticTraceTimestamp(row.push?.deliveredAt)}`,
    `Delivery Latency: ${formatTraceField(row.deliveryLatency, { empty: "Not available" })}`,
    `Device: ${deviceLabel}`,
    `Delivered Count: ${formatTraceField(row.push?.deliveredCount ?? 0)}`,
    "",
    "## Navigation",
    `Destination Dashboard: ${navigation.dashboard}`,
    `Destination Tab: ${navigation.tab}`,
    `Entity Parameter: ${navigation.entityParam}`,
    `Canonical Href:`,
    `${formatTraceField(row.navigation?.href, { empty: "Not available" })}`,
    "",
    "## Diagnostics",
    `Queue → Inbox: ${checks.queueToInbox}`,
    `Inbox → Push: ${checks.inboxToPush}`,
    `Canonical Destination: ${checks.canonicalDestination}`,
    `Client Click/Open Tracking: ${checks.clickTracking}`,
  ];

  return lines.join("\n");
}

/**
 * @param {object} row
 * @param {number} index
 */
function formatCompactDiagnosticEvent(row, index) {
  return [
    `EVENT ${index + 1}`,
    `Event Type: ${formatTraceField(row.eventType, { empty: "Unknown" })}`,
    `Created: ${formatDiagnosticTraceTimestamp(row.timestamp)}`,
    `Recipient: ${formatTraceField(row.recipient?.displayName, { empty: "Not available" })}`,
    `Entity: ${formatTraceField(row.entity?.summary?.label, { empty: "—" })}`,
    `Queue Status: ${formatTraceField(row.queue?.status, { empty: "Unknown" })}`,
    `Inbox Status: ${formatTraceField(row.inbox?.status, { empty: "Unknown" })}`,
    `Push Status: ${formatTraceField(row.push?.status, { empty: "Unknown" })}`,
    `Delivery Mode: ${formatTraceField(row.deliveryMode, { empty: "Unknown" })}`,
    `Delivery Latency: ${formatTraceField(row.deliveryLatency, { empty: "Not available" })}`,
    `Canonical Href: ${formatTraceField(row.navigation?.href, { empty: "Not available" })}`,
    `Result: ${formatTraceField(row.result, { empty: "Unknown" })}`,
  ].join("\n");
}

/**
 * @param {{
 *   diagnostics?: Array<object>,
 *   filters?: object,
 *   generatedAt?: string|null,
 *   environment?: string,
 *   recordsCopied?: number,
 *   totalAvailable?: number|null,
 *   paginationNote?: string|null,
 * }} input
 */
export function formatNotificationDiagnosticsReport(input = {}) {
  const diagnostics = Array.isArray(input.diagnostics) ? input.diagnostics : [];
  const filters = input.filters && typeof input.filters === "object" ? input.filters : {};
  const generatedAt = input.generatedAt || new Date().toISOString();
  const environment = input.environment || "Production";
  const recordsCopied = Number(input.recordsCopied ?? diagnostics.length);
  const totalAvailable =
    input.totalAvailable == null ? null : Number(input.totalAvailable);

  const filterLine = (label, value) =>
    `${label}: ${value && String(value).trim() ? String(value).trim() : "All"}`;

  const lines = [
    "BELIZELISTINGS NOTIFICATION DIAGNOSTICS",
    `Generated: ${formatDiagnosticTraceTimestamp(generatedAt)}`,
    `Environment: ${environment}`,
    "",
    "FILTERS",
    filterLine("Event Type", filters.eventType),
    filterLine("Queue Status", filters.queueStatus),
    filterLine("Push Status", filters.pushStatus),
    filterLine("Delivery Mode", filters.deliveryMode),
    filterLine("Search", filters.search),
    "",
    `Records copied: ${recordsCopied}`,
  ];

  if (totalAvailable != null && totalAvailable > recordsCopied) {
    lines.push("Additional records may exist outside the loaded page.");
  } else if (input.paginationNote) {
    lines.push(String(input.paginationNote));
  } else if (recordsCopied >= 50) {
    lines.push("Additional records may exist outside the loaded page.");
  }

  lines.push("");

  diagnostics.forEach((row, index) => {
    lines.push(formatCompactDiagnosticEvent(row, index));
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

/**
 * Guard for tests — copied text must not include known secret field names/values.
 * @param {string} text
 * @param {object} [sourceRow]
 */
export function assertDiagnosticTraceSafe(text, sourceRow = null) {
  const raw = String(text || "");
  const forbiddenPatterns = [
    /p256dh/i,
    /auth_secret/i,
    /vapid/i,
    /Bearer\s+/i,
    /service[-_ ]role/i,
    /refresh_token/i,
    /access_token/i,
    /https:\/\/fcm\.googleapis\.com/i,
    /https:\/\/updates\.push\.services\.mozilla\.com\/\w{20,}/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(raw)) {
      throw new Error(`Unsafe diagnostic trace content matched: ${pattern}`);
    }
  }

  if (sourceRow && typeof sourceRow === "object") {
    for (const key of Object.keys(sourceRow)) {
      if (FORBIDDEN_TRACE_KEYS.has(key)) {
        throw new Error(`Unsafe source key present: ${key}`);
      }
    }
  }

  return true;
}
