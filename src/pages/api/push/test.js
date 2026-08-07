import { createClient } from "@supabase/supabase-js";
import {
  isAuthorizedPushMutationRequest,
  loadVerifiedAdminProfile,
  readBearerToken,
} from "@/lib/push/pushApiAuth";
import { sendWebPushToUser } from "@/lib/push/sendWebPushToUser";
import { buildPushTestPayload } from "@/lib/push/pushTestPayload";
import {
  checkPushTestRateLimit,
  recordPushTestSent,
} from "@/lib/push/pushTestRateLimit";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!isAuthorizedPushMutationRequest(req)) {
    return res.status(403).json({ ok: false, error: "forbidden_origin" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRole) {
    return res.status(503).json({ ok: false, error: "not_configured" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (body.userId || body.user_id || body.recipientId || body.title || body.body || body.href) {
    return res.status(400).json({ ok: false, error: "invalid_request_body" });
  }

  const token = readBearerToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: "not_authenticated" });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user?.id) {
    return res.status(401).json({ ok: false, error: "not_authenticated" });
  }

  const adminClient = createClient(url, serviceRole);
  const adminProfile = await loadVerifiedAdminProfile(adminClient, user.id);
  if (!adminProfile) {
    return res.status(403).json({ ok: false, error: "admin_required" });
  }

  const rate = checkPushTestRateLimit(user.id);
  if (!rate.allowed) {
    return res.status(429).json({
      ok: false,
      error: "rate_limited",
      retryAfterMs: rate.retryAfterMs,
    });
  }

  const built = buildPushTestPayload({
    userId: user.id,
    role: adminProfile.role,
  });

  const result = await sendWebPushToUser(adminClient, user.id, built);

  if (!result.ok) {
    const status =
      result.error === "rate_limited"
        ? 429
        : result.error === "no_active_subscriptions"
          ? 404
          : result.error === "vapid_not_configured"
            ? 503
            : 502;

    return res.status(status).json({
      ok: false,
      error: result.error,
      attempted: result.attempted,
      delivered: result.delivered,
      temporaryFailures: result.temporaryFailures,
      deactivated: result.deactivated,
    });
  }

  recordPushTestSent(user.id);

  return res.status(200).json({
    ok: true,
    attempted: result.attempted,
    delivered: result.delivered,
    temporaryFailures: result.temporaryFailures,
    deactivated: result.deactivated,
  });
}
