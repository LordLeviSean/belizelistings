import { requireAdminApiAuth } from "@/lib/admin/requireAdminApiAuth";
import {
  DEFAULT_DIAGNOSTICS_LIMIT,
  filterNotificationDiagnosticRows,
  parseNotificationDiagnosticsQuery,
  projectNotificationDiagnosticRow,
  summarizeNotificationDiagnostics,
} from "@/lib/admin/notificationDiagnostics";
import {
  fetchProfileRowWithTiers,
  PROFILE_OWNER_MINIMAL_SELECT,
} from "@/lib/profileSelectContract";

function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function fetchRecipientProfiles(adminClient, recipientIds) {
  const map = new Map();
  await Promise.all(
    recipientIds.map(async (recipientId) => {
      const { data } = await fetchProfileRowWithTiers(adminClient, recipientId, [
        PROFILE_OWNER_MINIMAL_SELECT,
      ]);
      if (data) map.set(recipientId, data);
    })
  );
  return map;
}

async function fetchRecipientSubscriptions(adminClient, recipientIds) {
  const map = new Map();
  if (!recipientIds.length) return map;

  const { data, error } = await adminClient
    .from("push_subscriptions")
    .select("id,user_id,endpoint,platform_label,is_active,last_delivered_at,last_failed_at,updated_at")
    .in("user_id", recipientIds)
    .order("updated_at", { ascending: false });

  if (error) return map;

  for (const row of data || []) {
    const list = map.get(row.user_id) || [];
    list.push(row);
    map.set(row.user_id, list);
  }
  return map;
}

async function fetchQueueRows(adminClient, filters) {
  let query = adminClient
    .from("notification_queue")
    .select(
      "id,event_type,recipient_id,payload,status,attempts,scheduled_at,processed_at,created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (filters.eventType) query = query.eq("event_type", filters.eventType);
  if (filters.queueStatus) query = query.eq("status", filters.queueStatus);
  if (filters.recipientId) query = query.eq("recipient_id", filters.recipientId);
  if (filters.since) query = query.gte("created_at", filters.since);
  if (filters.until) query = query.lte("created_at", filters.until);

  const needsPostFilter = Boolean(filters.pushStatus || filters.deliveryMode || filters.entityId || filters.search);
  const fetchLimit = needsPostFilter
    ? Math.min(200, Math.max(filters.limit + filters.offset, DEFAULT_DIAGNOSTICS_LIMIT * 2))
    : filters.limit;
  const rangeEnd = needsPostFilter ? fetchLimit - 1 : filters.offset + filters.limit - 1;
  const rangeStart = needsPostFilter ? 0 : filters.offset;

  query = query.range(rangeStart, rangeEnd);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data || [], total: count ?? (data || []).length, postFiltered: needsPostFilter };
}

async function fetchNotificationsForQueue(adminClient, queueIds) {
  if (!queueIds.length) return new Map();

  const { data, error } = await adminClient
    .from("notifications")
    .select(
      "id,recipient_user_id,category,event_type,entity_type,entity_id,title,body,payload,dedupe_key,read_at,queue_id,created_at"
    )
    .in("queue_id", queueIds);

  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    if (row.queue_id) map.set(row.queue_id, row);
  }
  return map;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdminApiAuth(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const filters = parseNotificationDiagnosticsQuery(req);
  if (!filters.since && !filters.until && !filters.search && !filters.entityId) {
    filters.since = hoursAgoIso(24);
  }

  try {
    const { rows: queueRows, total, postFiltered } = await fetchQueueRows(auth.adminClient, filters);
    const queueIds = queueRows.map((row) => row.id).filter(Boolean);
    const notificationMap = await fetchNotificationsForQueue(auth.adminClient, queueIds);

    const recipientIds = [
      ...new Set(queueRows.map((row) => row.recipient_id).filter(Boolean)),
    ];
    const [profileMap, subscriptionMap] = await Promise.all([
      fetchRecipientProfiles(auth.adminClient, recipientIds),
      fetchRecipientSubscriptions(auth.adminClient, recipientIds),
    ]);

    let projected = queueRows.map((queueRow) =>
      projectNotificationDiagnosticRow({
        queueRow,
        notificationRow: notificationMap.get(queueRow.id) ?? null,
        recipientProfile: queueRow.recipient_id
          ? profileMap.get(queueRow.recipient_id) ?? null
          : null,
        subscriptions: queueRow.recipient_id
          ? subscriptionMap.get(queueRow.recipient_id) ?? []
          : [],
      })
    );

    projected = filterNotificationDiagnosticRows(projected, filters);

    const pagedRows = postFiltered
      ? projected.slice(filters.offset, filters.offset + filters.limit)
      : projected;

    return res.status(200).json({
      ok: true,
      updated_at: new Date().toISOString(),
      filters,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        returned: pagedRows.length,
        total: postFiltered ? projected.length : total,
        postFiltered,
      },
      summary: summarizeNotificationDiagnostics(projected),
      summaryWindow: filters.since ? "filtered" : "recent",
      rows: pagedRows,
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Notification diagnostics fetch failed",
    });
  }
}
