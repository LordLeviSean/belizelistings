import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ensureProfile } from "../lib/ensureProfile";
import { resolveTierFromProfile } from "../constants/operationalModel";
import { getTrustTierCapabilities, resolveProfileVerification } from "../constants/trustModel";
import { formatWelcomeGreeting, resolveDashboardGreetingName } from "../lib/dashboardGreeting";

/** Load profile without brittle column lists (missing columns must not wipe role). */
async function fetchProfileRowForUser(supabaseClient, userId) {
  const star = await supabaseClient.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!star.error) return star.data ?? null;

  const roleOnly = await supabaseClient.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!roleOnly.error) {
    if (star.error) {
      console.warn("[useUserRole] profile select(*) failed; using role-only row", star.error);
    }
    return roleOnly.data ?? null;
  }
  console.warn("[useUserRole] profile load error", star.error || roleOnly.error);
  return null;
}

export default function useUserRole() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [tier, setTier] = useState("public");
  const [verification, setVerification] = useState(resolveProfileVerification());
  const [profileRow, setProfileRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const resolveUserRole = async (sessionUser) => {
      if (!sessionUser?.id) {
        if (!cancelled) {
          setUser(null);
          setRole("user");
          setProfileRow(null);
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

      const profile = await fetchProfileRowForUser(supabase, sessionUser.id);

      if (!cancelled) {
        const resolvedRole = profile?.role ?? "user";
        setProfileRow(profile);
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

  const greetingName = useMemo(() => {
    if (!user?.id) return "";
    return resolveDashboardGreetingName({
      username: profileRow?.username,
      email: profileRow?.email ?? user?.email,
      full_name: profileRow?.full_name,
    });
  }, [profileRow?.email, profileRow?.full_name, profileRow?.username, user?.email, user?.id]);

  const welcomePhrase = useMemo(
    () =>
      formatWelcomeGreeting({
        username: profileRow?.username,
        email: profileRow?.email ?? user?.email,
        full_name: profileRow?.full_name,
      }),
    [profileRow?.email, profileRow?.full_name, profileRow?.username, user?.email, user?.id]
  );

  return {
    user,
    role,
    tier,
    verification,
    profile: profileRow,
    greetingName,
    welcomePhrase,
    trustCapabilities: getTrustTierCapabilities(tier),
    loading,
  };
}
