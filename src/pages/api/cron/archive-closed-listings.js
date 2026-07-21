import { processNotificationQueueBatch } from "../../../lib/notifications/deliverNotifications";
import { archiveExpiredClosedListings } from "../../../lib/listings/archiveClosedListings";
import { createCronSupabaseClient, verifyCronSecret } from "../../../lib/cron/cronAuth";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = verifyCronSecret(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const adminClient = createCronSupabaseClient();
  if (!adminClient) {
    return res.status(500).json({ error: "Missing Supabase service role configuration" });
  }

  const archiveResult = await archiveExpiredClosedListings(adminClient);
  if (!archiveResult.ok) {
    return res.status(500).json({
      error: archiveResult.error?.message || "Archive batch failed",
      archive: archiveResult.data ?? null,
    });
  }

  const limit = Math.min(50, Math.max(1, Number(req.query.limit || req.body?.limit) || 25));
  const notifyResult = await processNotificationQueueBatch(adminClient, { limit });

  return res.status(200).json({
    ok: true,
    archive: archiveResult.data ?? null,
    notifications: notifyResult.data ?? null,
    ran_at: new Date().toISOString(),
  });
}
