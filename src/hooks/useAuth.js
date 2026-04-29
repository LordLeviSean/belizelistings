import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ensureProfile } from "../lib/ensureProfile";

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
        queueMicrotask(() => ensureProfile(current));
      }
    };

    bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      if (!session?.user) return;

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        queueMicrotask(() => ensureProfile(session.user));
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
