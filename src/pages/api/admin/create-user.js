import { createClient } from "@supabase/supabase-js";
import { validateUsernameCandidate } from "../../../lib/usernameRules";
import { isMissingColumnError } from "../../../lib/supabaseCompat";
import {
  fetchProfileRowWithTiers,
  PROFILE_ID_ONLY_SELECT,
  PROFILE_ID_USERNAME_PROBE_SELECT,
  PROFILE_ROLE_ONLY_SELECT,
} from "../../../lib/profileSelectContract";
import { logSupabaseMutationResult } from "../../../lib/supabaseRawError";

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
  const token = authHeader.replace("Bearer ", "");
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

  const { error: usernameColumnProbe } = await adminClient
    .from("profiles")
    .select(PROFILE_ID_USERNAME_PROBE_SELECT)
    .limit(1);
  if (usernameColumnProbe && isMissingColumnError(usernameColumnProbe)) {
    return res.status(503).json({
      error:
        "Database is missing profiles.username. Run supabase-migration-profiles-username.sql in the Supabase SQL editor, then retry.",
    });
  }

  const { email, password, role, username: rawUsername } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const usernameCheck = validateUsernameCandidate(rawUsername);
  if (!usernameCheck.ok) {
    return res.status(400).json({ error: usernameCheck.message });
  }
  const username = usernameCheck.username;

  const { data: taken } = await adminClient
    .from("profiles")
    .select(PROFILE_ID_ONLY_SELECT)
    .eq("username", username)
    .maybeSingle();

  if (taken?.id) {
    return res.status(400).json({ error: "That username is already taken." });
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: String(email).trim().toLowerCase(),
    password: String(password),
    email_confirm: true,
    user_metadata: { role: role || "user", username },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const createdId = data?.user?.id;
  if (createdId) {
    const upsertPayload = {
      id: createdId,
      email: String(email).trim().toLowerCase(),
      role: role || "user",
      username,
    };
    const profileUpsertResult = await adminClient.from("profiles").upsert(upsertPayload);
    const { error: profileUpsertError } = profileUpsertResult;
    if (profileUpsertError) {
      logSupabaseMutationResult("admin-create-user:profiles-upsert", profileUpsertResult, {
        payloadKeys: Object.keys(upsertPayload),
      });
      if (isMissingColumnError(profileUpsertError)) {
        return res.status(503).json({
          error:
            "Auth user was created but profiles.username is missing. Run supabase-migration-profiles-username.sql, then align the profile row manually if needed.",
        });
      }
      const msg = String(profileUpsertError.message || "").toLowerCase();
      const code = profileUpsertError.code;
      const isDup = code === "23505" || msg.includes("duplicate") || msg.includes("unique");
      if (isDup) {
        await adminClient.auth.admin.deleteUser(createdId);
        return res.status(400).json({ error: "That username is already taken." });
      }
      await adminClient.auth.admin.deleteUser(createdId);
      return res.status(400).json({ error: profileUpsertError.message || "Unable to save profile" });
    }
  }

  return res.status(200).json({ ok: true, id: createdId });
}
