import { supabase } from "./supabaseClient";

/**
 * Exact username collision check for signup (normalized string).
 * 1) RPC `username_is_taken` when deployed (works without service role / for logged-out users).
 * 2) Fallback: POST /api/auth/check-username (service role on server).
 *
 * @param {string} normalizedUsername from validateSignupUsername().username
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ status: "available" | "taken" | "error", message?: string }>}
 */
export async function lookupUsernameAvailability(normalizedUsername, signal) {
  const { data: taken, error: rpcError } = await supabase.rpc("username_is_taken", {
    check_username: normalizedUsername,
  });

  if (!rpcError && typeof taken === "boolean") {
    return { status: taken ? "taken" : "available" };
  }

  try {
    const res = await fetch("/api/auth/check-username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: normalizedUsername }),
      signal,
    });
    const body = await res.json().catch(() => ({}));
    if (body.status === "available" || body.status === "taken") {
      return { status: body.status };
    }
    if (body.status === "invalid") {
      return { status: "error", message: body.message || "Invalid username." };
    }
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    /* network / parse */
  }

  return { status: "error", message: "Could not verify username. Try again." };
}
