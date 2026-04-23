import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

let ensureProfileLocked = false;

/** Race-safe insert: another tab/request may have created the row first. */
function isProfilesUniqueViolation(error) {
  if (!error) return false;
  if (error.code === "23505") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("duplicate key") || msg.includes("unique constraint");
}

async function ensureProfileIfNeeded() {
  if (ensureProfileLocked) return;
  ensureProfileLocked = true;

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error("AUTH ERROR:", authError);
      return;
    }

    const user = authData?.user ?? null;
    if (!user?.id) return;

    const { data: profile, error: selectError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (selectError) {
      console.error("AUTH ERROR:", selectError);
      return;
    }

    if (profile) return;

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
    });

    if (insertError && !isProfilesUniqueViolation(insertError)) {
      console.error("AUTH ERROR:", insertError);
    }
  } catch (error) {
    console.error("AUTH ERROR:", error);
  } finally {
    ensureProfileLocked = false;
  }
}

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const { data } = await supabase.auth.getUser();
      const current = data?.user ?? null;
      setUser(current);
      setLoading(false);

      if (current?.id) {
        queueMicrotask(() => ensureProfileIfNeeded());
      }
    };

    bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      if (!session?.user) return;

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        queueMicrotask(() => ensureProfileIfNeeded());
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
