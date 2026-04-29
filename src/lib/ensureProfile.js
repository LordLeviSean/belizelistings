import { supabase } from "./supabaseClient";

function isProfilesUniqueViolation(error) {
  if (!error) return false;
  if (error.code === "23505") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("duplicate key") || msg.includes("unique constraint");
}

export async function ensureProfile(user) {
  if (!user?.id) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("PROFILE ENSURE ERROR:", error);
    return;
  }

  if (data?.id) return;

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    role: "user",
    email: user.email ?? null,
  });

  if (insertError && !isProfilesUniqueViolation(insertError)) {
    console.error("PROFILE ENSURE INSERT ERROR:", insertError);
  }
}
