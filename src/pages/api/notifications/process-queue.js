import { createClient } from "@supabase/supabase-js";
import { processNotificationQueueBatchWithPush } from "../../../lib/notifications/deliverNotificationsServer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Missing Supabase service role configuration" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const adminClient = createClient(url, serviceRole);
  const userClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });

  const {
    data: { user: currentUser },
  } = await userClient.auth.getUser();

  if (!currentUser?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const limit = Math.min(200, Math.max(1, Number(req.body?.limit) || 50));
  const result = await processNotificationQueueBatchWithPush(adminClient, { limit });

  if (!result.ok && !result.skipped) {
    return res.status(500).json({ error: result.error?.message || "Batch processing failed" });
  }

  return res.status(200).json({
    ok: true,
    skipped: Boolean(result.skipped),
    email_channel: process.env.RESEND_API_KEY ? "pending" : "skipped",
    batch: result.data ?? null,
  });
}
