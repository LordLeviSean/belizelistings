import { createClient } from "@supabase/supabase-js";
import {
  PLATFORM_TIERS,
  resolveActiveListingCapForTier,
  resolveTierFromProfile,
} from "../../../constants/operationalModel";
import { getUserActiveListingCount } from "../../../lib/listingPersistence";
import {
  fetchProfileRowWithTiers,
  PROFILE_ROLE_ONLY_SELECT,
} from "../../../lib/profileSelectContract";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Server-side guard for simultaneous non-draft, non-archived listings.
 * Uses the caller JWT (never a body user id). Returns 429 when at cap for
 * quota-capped tiers (public platform user + free agent; caps differ by tier).
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!url || !anonKey) {
    return res.status(503).json({ error: "Supabase is not configured on the server." });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return res.status(401).json({ error: "Missing Authorization bearer token." });
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user?.id) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  const { data: profile, error: profileErr } = await fetchProfileRowWithTiers(supabase, user.id, [
    PROFILE_ROLE_ONLY_SELECT,
  ]);

  if (profileErr) {
    console.warn("[enforce-active-cap] profile read", profileErr);
  }

  const tier = resolveTierFromProfile(profile ?? null);
  const activeCap = resolveActiveListingCapForTier(tier);

  if (activeCap == null) {
    return res.status(200).json({ ok: true, capped: false, count: null, cap: null });
  }

  const count = await getUserActiveListingCount(supabase, user.id);
  if (count >= activeCap) {
    return res.status(429).json({
      ok: false,
      capped: true,
      count,
      cap: activeCap,
      message: `Active listing limit reached (${activeCap}). Archive a listing or upgrade your account to continue.`,
    });
  }

  return res.status(200).json({
    ok: true,
    capped: false,
    count,
    cap: activeCap,
  });
}
