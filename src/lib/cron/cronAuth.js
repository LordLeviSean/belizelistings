import { createClient } from "@supabase/supabase-js";

/**
 * @param {import('next').NextApiRequest} req
 */
export function verifyCronSecret(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return {
      ok: false,
      status: 503,
      error: "CRON_SECRET not configured — cron processing disabled (fail closed).",
    };
  }

  const provided =
    req.headers["x-cron-secret"] ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    req.query.secret;

  if (provided !== cronSecret) {
    return { ok: false, status: 401, error: "Invalid cron secret" };
  }

  return { ok: true };
}

export function createCronSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole);
}
