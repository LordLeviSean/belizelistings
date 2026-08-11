import { createClient } from "@supabase/supabase-js";
import { readTruthyEnvValue } from "@/lib/featureFlags";
import { performDeclineViewing } from "@/lib/crm/viewingMutations";
import { deliverNotificationQueueItemWithPush } from "@/lib/notifications/deliverNotificationsServer";
import { VIEWING_STATUS } from "@/lib/crm/crmConstants";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const BL_ENABLE_NOTIFICATIONS = readTruthyEnvValue(
    process.env.NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS
  );

  if (!url || !serviceRole || !anonKey) {
    return res.status(503).json({ error: "Viewing decline API is not configured." });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return res.status(401).json({ error: "Unauthorized", code: "authentication_required" });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user?.id) {
    return res.status(401).json({ error: "Unauthorized", code: "authentication_required" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const viewingId = body.viewingId ?? body.viewing_id ?? null;
  const notes = body.notes ?? null;

  if (!viewingId) {
    return res.status(400).json({ code: "validation_error", error: "viewingId is required." });
  }

  const adminClient = createClient(url, serviceRole);
  const { data: viewing, error: viewingError } = await adminClient
    .from("viewing_requests")
    .select("id,agent_user_id,status")
    .eq("id", viewingId)
    .maybeSingle();

  if (viewingError || !viewing?.id) {
    return res.status(404).json({ code: "viewing_not_found", error: "Viewing not found." });
  }

  if (String(viewing.agent_user_id) !== String(user.id)) {
    return res.status(403).json({
      code: "forbidden",
      error: "You cannot decline this viewing request.",
    });
  }

  if (viewing.status !== VIEWING_STATUS.PENDING) {
    return res.status(409).json({
      code: "viewing_not_pending",
      error: "Only pending viewing requests can be declined.",
    });
  }

  const result = await performDeclineViewing(adminClient, {
    viewingId,
    agentUserId: user.id,
    notes,
  });

  if (result.error) {
    const message = result.error.message || "Could not decline viewing.";
    const status = result.error.code === "PGRST116" ? 409 : 400;
    return res.status(status).json({
      code: status === 409 ? "viewing_not_pending" : "decline_failed",
      error: message,
    });
  }

  if (BL_ENABLE_NOTIFICATIONS && result.queueId) {
    await deliverNotificationQueueItemWithPush(adminClient, result.queueId);
  }

  return res.status(200).json({
    ok: true,
    data: {
      id: result.data?.id ?? viewingId,
      status: result.data?.status ?? VIEWING_STATUS.DECLINED,
      queueId: result.queueId ?? null,
    },
  });
}
