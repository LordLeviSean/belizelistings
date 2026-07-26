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
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[archive-closed-listings] cron failed", {
        message: archiveResult.error?.message || "Archive batch failed",
      });
    }
    return res.status(500).json({
      ok: false,
      error: archiveResult.error?.message || "Archive batch failed",
      archive: archiveResult.data ?? null,
    });
  }

  const limit = Math.min(50, Math.max(1, Number(req.query.limit || req.body?.limit) || 25));
  const notifyResult = await processNotificationQueueBatch(adminClient, { limit });

  const archivePayload = archiveResult.data ?? {};
  const eligible = Number(archivePayload.eligible) || 0;
  const archived = Number(archivePayload.archived) || 0;
  const notificationsQueued = Number(archivePayload.notificationsQueued) || 0;

  if (typeof console !== "undefined" && console.info) {
    console.info("[archive-closed-listings] cron complete", {
      eligible,
      archived,
      notificationsQueued,
      notificationsDelivered: notifyResult.data?.processed ?? null,
    });
  }

  return res.status(200).json({
    ok: true,
    eligible,
    archived,
    notificationsQueued,
    archive: archivePayload,
    notifications: notifyResult.data ?? null,
    ran_at: new Date().toISOString(),
  });
}
