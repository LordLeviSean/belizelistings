import { createClient } from "@supabase/supabase-js";
import { getClientSafeVapidPublicConfig } from "@/lib/push/webPushVapidConfig";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return res.status(503).json({ ok: false, error: "not_configured" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

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

  const clientSafe = getClientSafeVapidPublicConfig();

  if (!clientSafe?.publicKey) {
    return res.status(503).json({ ok: false, error: "vapid_not_configured" });
  }

  return res.status(200).json({
    ok: true,
    publicKey: clientSafe.publicKey,
    subject: clientSafe.subject,
  });
}
