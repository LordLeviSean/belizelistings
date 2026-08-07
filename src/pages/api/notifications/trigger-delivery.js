import { createClient } from "@supabase/supabase-js";
import { readTruthyEnvValue } from "@/lib/featureFlags";
import { triggerNotificationDeliveryWithPush } from "@/lib/notifications/deliverNotificationsServer";
import { reconcileUndeliveredNewInquiryPushes } from "@/lib/push/deliverNewInquiryWebPush";

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
    return res.status(503).json({ error: "Notification delivery is not configured." });
  }

  if (!BL_ENABLE_NOTIFICATIONS) {
    return res.status(200).json({ ok: true, skipped: true, reason: "notifications_disabled" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const limit = Math.min(25, Math.max(1, Number(req.body?.limit) || 5));
  const adminClient = createClient(url, serviceRole);

  const batch = await triggerNotificationDeliveryWithPush(adminClient, { limit });
  const reconciled = await reconcileUndeliveredNewInquiryPushes(adminClient, { hours: 48, limit: 10 });

  if (!batch.ok && !batch.skipped) {
    return res.status(500).json({ error: batch.error?.message || "Notification delivery failed" });
  }

  return res.status(200).json({
    ok: true,
    skipped: Boolean(batch.skipped),
    batch: batch.data ?? null,
    push_reconciled: reconciled.attempted ?? 0,
  });
}
