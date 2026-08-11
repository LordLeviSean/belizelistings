import { createClient } from "@supabase/supabase-js";
import { readTruthyEnvValue } from "@/lib/featureFlags";
import { performAgentReply } from "@/lib/crm/conversationMutations";
import { deliverNotificationQueueItemWithPush } from "@/lib/notifications/deliverNotificationsServer";

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
    return res.status(503).json({ error: "Agent reply API is not configured." });
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
  const conversationId = body.conversationId ?? body.conversation_id ?? null;
  const replyBody = String(body.body ?? "").trim();
  const listingId = body.listingId ?? body.listing_id ?? null;
  const listingTitle = body.listingTitle ?? body.listing_title ?? null;

  if (!conversationId) {
    return res.status(400).json({ code: "validation_error", error: "conversationId is required." });
  }

  if (!replyBody) {
    return res.status(400).json({ code: "validation_error", error: "Message body required" });
  }

  const adminClient = createClient(url, serviceRole);
  const { data: conversation, error: conversationError } = await adminClient
    .from("conversations")
    .select("id,agent_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError || !conversation?.id) {
    return res.status(404).json({ code: "conversation_not_found", error: "Conversation not found." });
  }

  if (String(conversation.agent_id) !== String(user.id)) {
    return res.status(403).json({ code: "forbidden", error: "You cannot reply in this conversation." });
  }

  const result = await performAgentReply(adminClient, {
    conversationId,
    agentUserId: user.id,
    body: replyBody,
    listingId,
    listingTitle,
  });

  if (result.error) {
    const message = result.error.message || "Could not send reply.";
    const status = result.unavailable ? 503 : 400;
    return res.status(status).json({ code: "reply_failed", error: message });
  }

  if (BL_ENABLE_NOTIFICATIONS && result.queueId) {
    await deliverNotificationQueueItemWithPush(adminClient, result.queueId);
  }

  return res.status(200).json({
    ok: true,
    data: {
      id: result.data?.id ?? null,
      created_at: result.data?.created_at ?? null,
      conversationId,
      queueId: result.queueId ?? null,
    },
  });
}
