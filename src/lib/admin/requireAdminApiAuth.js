import { createClient } from "@supabase/supabase-js";
import { loadVerifiedAdminProfile, readBearerToken } from "@/lib/push/pushApiAuth";

/**
 * Verify bearer-authenticated admin for privileged API routes.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ ok: true, adminClient: import('@supabase/supabase-js').SupabaseClient, userId: string } | { ok: false, status: number, error: string }>}
 */
export async function requireAdminApiAuth(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceRole || !anonKey) {
    return { ok: false, status: 503, error: "Admin API is not configured." };
  }

  const token = readBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user?.id) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const adminClient = createClient(url, serviceRole);
  const adminProfile = await loadVerifiedAdminProfile(adminClient, user.id);
  if (!adminProfile) {
    return { ok: false, status: 403, error: "Admin access required" };
  }

  return { ok: true, adminClient, userId: user.id };
}
