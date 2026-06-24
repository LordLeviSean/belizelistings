import { createClient } from "@supabase/supabase-js";
import { validateSignupUsername } from "../../../lib/usernameRules";
import { PROFILE_ID_ONLY_SELECT } from "../../../lib/profileSelectContract";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Public username availability (service role read). Debounced on the client.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!url || !serviceRole) {
    return res.status(200).json({
      status: "error",
      code: "no_service",
      message: "Username check is not configured on the server.",
    });
  }

  const raw = req.body?.username ?? "";
  const format = validateSignupUsername(raw);
  if (!format.ok) {
    if (format.code === "empty") {
      return res.status(200).json({ status: "empty" });
    }
    return res.status(200).json({
      status: "invalid",
      code: format.code,
      message: format.message || "Invalid username.",
    });
  }

  const admin = createClient(url, serviceRole);
  let taken = false;
  const row = await admin
    .from("profiles")
    .select(PROFILE_ID_ONLY_SELECT)
    .eq("username", format.username)
    .maybeSingle();
  if (!row.error) {
    taken = Boolean(row.data?.id);
  } else {
    const counted = await admin
      .from("profiles")
      .select(PROFILE_ID_ONLY_SELECT, { count: "exact", head: true })
      .eq("username", format.username);
    if (counted.error) {
      console.warn("[check-username] query error", row.error, counted.error);
      return res.status(200).json({ status: "error", message: "Could not verify username. Try again." });
    }
    taken = (counted.count ?? 0) > 0;
  }

  return res.status(200).json({
    status: taken ? "taken" : "available",
    username: format.username,
  });
}
