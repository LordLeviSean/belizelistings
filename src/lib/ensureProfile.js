import { supabase } from "./supabaseClient";
import { isMissingColumnError } from "./supabaseCompat";
import { normalizeUsername } from "./usernameRules";

function isProfilesUniqueViolation(error) {
  if (!error) return false;
  if (error.code === "23505") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("duplicate key") || msg.includes("unique constraint");
}

export async function ensureProfile(user) {
  if (!user?.id) return;

  const desiredUsername = normalizeUsername(user.user_metadata?.username || "");
  const email = user.email ?? null;

  let row = null;
  const wide = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!wide.error) {
    row = wide.data ?? null;
  } else {
    const narrow = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!narrow.error) row = narrow.data ?? null;
    else console.error("PROFILE ENSURE ERROR:", wide.error);
  }

  if (row?.id) {
    if (desiredUsername && !row.username) {
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ username: desiredUsername })
        .eq("id", user.id);
      if (upErr && !isMissingColumnError(upErr) && !isProfilesUniqueViolation(upErr)) {
        console.error("PROFILE USERNAME UPDATE ERROR:", upErr);
      }
    }
    return;
  }

  const insertPayload = {
    id: user.id,
    role: "user",
    email,
  };
  if (desiredUsername) insertPayload.username = desiredUsername;

  let { error: insertError } = await supabase.from("profiles").insert(insertPayload);

  if (insertError && isMissingColumnError(insertError) && desiredUsername) {
    ({ error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      role: "user",
      email,
    }));
  } else if (insertError && desiredUsername && isProfilesUniqueViolation(insertError)) {
    ({ error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      role: "user",
      email,
    }));
  }

  if (insertError && !isProfilesUniqueViolation(insertError)) {
    console.error("PROFILE ENSURE INSERT ERROR:", insertError);
  }
}
