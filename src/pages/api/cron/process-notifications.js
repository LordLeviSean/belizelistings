import { createClient } from "@supabase/supabase-js";
import { processNotificationQueueBatchWithPush } from "../../../lib/notifications/deliverNotificationsServer";

export default async function handler(req, res) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Missing Supabase service role configuration" });
  }

  if (!cronSecret) {
    return res.status(503).json({
      error: "CRON_SECRET not configured — notification cron processing disabled (fail closed).",
    });
  }

  const provided =
    req.headers["x-cron-secret"] ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    req.query.secret;
  if (provided !== cronSecret) {
    return res.status(401).json({ error: "Invalid cron secret" });
  }

  const limit = Math.min(200, Math.max(1, Number(req.query.limit || req.body?.limit) || 50));
  const adminClient = createClient(url, serviceRole);
  const result = await processNotificationQueueBatchWithPush(adminClient, { limit });

  if (!result.ok && !result.skipped) {
    return res.status(500).json({ error: result.error?.message || "Cron batch failed" });
  }

  return res.status(200).json({
    ok: true,
    skipped: Boolean(result.skipped),
    email_channel: process.env.RESEND_API_KEY ? "pending" : "skipped",
    batch: result.data ?? null,
    ran_at: new Date().toISOString(),
  });
}
