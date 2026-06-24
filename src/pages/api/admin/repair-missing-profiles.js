import { createClient } from "@supabase/supabase-js";
import { normalizeUsername, validateUsernameCandidate } from "../../../lib/usernameRules";
import {
  fetchProfileRowWithTiers,
  PROFILE_ID_ONLY_SELECT,
  PROFILE_ROLE_ONLY_SELECT,
} from "../../../lib/profileSelectContract";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ROLES = new Set(["admin", "agent", "user"]);

function normalizeRole(raw) {
  const r = String(raw || "user").trim().toLowerCase();
  return ALLOWED_ROLES.has(r) ? r : "user";
}

/**
 * POST — inserts minimal public.profiles rows for auth.users that have no profile.
 * Requires Bearer JWT of an admin + SUPABASE_SERVICE_ROLE_KEY.
 *
 * DBA fallback (run once in Supabase SQL editor as postgres) if this route is unavailable:
 *
 *   INSERT INTO public.profiles (id, email, role, username, created_at)
 *   SELECT
 *     u.id,
 *     u.email,
 *     COALESCE(NULLIF(lower(trim(COALESCE(u.raw_user_meta_data->>'role', ''))), ''), 'user'),
 *     NULLIF(lower(trim(COALESCE(u.raw_user_meta_data->>'username', ''))), ''),
 *     COALESCE(u.created_at, timezone('utc'::text, now()))
 *   FROM auth.users u
 *   LEFT JOIN public.profiles p ON p.id = u.id
 *   WHERE p.id IS NULL
 *   ON CONFLICT (id) DO NOTHING;
 *
 * If profiles.username is NOT NULL and unique, NULLIF username above avoids duplicate-key failures;
 * repair again after usernames are assigned in-app.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Missing Supabase service role configuration" });
  }

  const dryRun = String(req.query?.dryRun || req.body?.dryRun || "") === "1";

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

  const { data: profile } = await fetchProfileRowWithTiers(adminClient, currentUser.id, [
    PROFILE_ROLE_ONLY_SELECT,
  ]);

  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  let repairedCount = 0;
  let skippedExistingCount = 0;
  const errors = [];

  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data: pageData, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (listErr) {
      return res.status(400).json({ error: listErr.message || "Unable to list auth users" });
    }
    const users = pageData?.users || [];
    if (!users.length) break;

    for (const u of users) {
      const uid = u?.id;
      if (!uid) continue;

      const { data: existing } = await fetchProfileRowWithTiers(adminClient, uid, [PROFILE_ID_ONLY_SELECT]);
      if (existing?.id) {
        skippedExistingCount += 1;
        continue;
      }

      const meta = u.user_metadata || {};
      const rawU = meta.username ?? meta.user_name ?? "";
      let username = null;
      const checked = validateUsernameCandidate(rawU);
      if (checked.ok) {
        username = checked.username;
      } else if (rawU) {
        const n = normalizeUsername(String(rawU));
        username = n || null;
      }

      const payload = {
        id: uid,
        email: u.email ? String(u.email).trim().toLowerCase() : null,
        role: normalizeRole(meta.role),
        ...(username ? { username } : {}),
      };

      if (dryRun) {
        repairedCount += 1;
        continue;
      }

      const first = await adminClient
        .from("profiles")
        .insert(payload)
        .select(PROFILE_ID_ONLY_SELECT)
        .maybeSingle();
      if (!first.error) {
        repairedCount += 1;
        continue;
      }

      const fallback = { id: uid, email: payload.email, role: payload.role };
      const second = await adminClient
        .from("profiles")
        .insert(fallback)
        .select(PROFILE_ID_ONLY_SELECT)
        .maybeSingle();
      if (!second.error) {
        repairedCount += 1;
      } else {
        errors.push({
          id: uid,
          message: String(first.error?.message || first.error),
          fallbackMessage: String(second.error?.message || second.error),
        });
      }
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return res.status(200).json({
    ok: true,
    dryRun,
    repairedCount,
    skippedExistingCount,
    errorCount: errors.length,
    errors: errors.slice(0, 50),
  });
}
