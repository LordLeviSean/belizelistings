import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ensureProfile } from "../lib/ensureProfile";
import { resolveTierFromProfile } from "../constants/operationalModel";
import { getTrustTierCapabilities, resolveProfileVerification } from "../constants/trustModel";

export default function useUserRole() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [tier, setTier] = useState("public");
  const [verification, setVerification] = useState(resolveProfileVerification());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const resolveUserRole = async (sessionUser) => {
      if (!sessionUser?.id) {
        if (!cancelled) {
          setUser(null);
          setRole("user");
          setTier("public");
          setVerification(resolveProfileVerification());
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setUser(sessionUser);
      }

      await ensureProfile(sessionUser);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", sessionUser.id)
        .maybeSingle();

      if (!cancelled) {
        const resolvedRole = profile?.role ?? "user";
        setRole(resolvedRole);
        setTier(resolveTierFromProfile(profile));
        setVerification(resolveProfileVerification(profile || {}));
        setLoading(false);
      }
    };

    const bootstrap = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      await resolveUserRole(authUser ?? null);
    };

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore background/session refresh events to prevent navbar flicker on tab refocus.
      const shouldSetLoading =
        event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED";
      if (!cancelled && shouldSetLoading) {
        setLoading(true);
      }
      void resolveUserRole(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    role,
    tier,
    verification,
    trustCapabilities: getTrustTierCapabilities(tier),
    loading,
  };
}
