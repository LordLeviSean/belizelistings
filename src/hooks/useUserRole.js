import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "../lib/supabaseClient";

import { ensureProfile } from "../lib/ensureProfile";

import { BL_ENABLE_NOTIFICATIONS } from "../lib/featureFlags";
import {
  detachPushSubscriptionOnLogout,
  syncPushSubscriptionForAuthenticatedUser,
} from "../lib/push/pushSubscriptionSessionSync";

import { resolveTierFromProfile } from "../constants/operationalModel";

import { getTrustTierCapabilities, resolveProfileVerification } from "../constants/trustModel";

import { formatWelcomeGreeting, resolveDashboardGreetingName } from "../lib/dashboardGreeting";

import { fetchProfileRowWithTiers } from "../lib/profileSelectContract";

import {
  clearProfileSession,
  getCachedProfileRow,
  invalidateProfileHydration,
  isProfileHydratedForUser,
  markProfileHydrated,
  runProfileHydrateOnce,
} from "../lib/profileSessionCache";

const UserRoleContext = createContext(null);

/** Load profile via canonical tiers; step down only on missing-column / schema-cache errors. */
async function fetchProfileRowForUser(supabaseClient, userId) {
  const { data, error } = await fetchProfileRowWithTiers(supabaseClient, userId);
  if (error) {
    console.warn("[useUserRole] profile load error", error);
  }
  return data;
}

/** Silent fallback when row missing or partial — never blocks UI on profile gaps. */
function buildEffectiveProfileRow(sessionUser, profileRow) {
  const email = profileRow?.email ?? sessionUser?.email ?? null;
  const role = profileRow?.role ?? "user";
  if (profileRow?.id) {
    return { ...profileRow, email: profileRow.email ?? email, role };
  }
  return {
    id: sessionUser.id,
    email,
    role,
    username: profileRow?.username ?? null,
  };
}

function shouldRefetchProfileForAuthEvent(event, userId, force) {
  if (force) return true;
  if (!userId) return false;
  if (event === "USER_UPDATED") return true;
  if (event === "SIGNED_OUT") return false;
  if (event === "SIGNED_IN" && isProfileHydratedForUser(userId)) return false;
  if (event === "INITIAL_SESSION" && isProfileHydratedForUser(userId)) return false;
  if (isProfileHydratedForUser(userId)) return false;
  return true;
}

/**
 * Single auth + profile subscription for the tree. Mount once in `_app.js`
 * so `SiteNav`, `NotificationCenter`, and dashboard pages do not each open
 * their own `onAuthStateChange` listener and duplicate `ensureProfile` work.
 *
 * Dashboard `?tab=` shallow updates do not remount this provider and do not
 * refetch profiles — hydration is once per signed-in user until logout.
 */
export function UserRoleProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [tier, setTier] = useState("public");
  const [verification, setVerification] = useState(resolveProfileVerification());
  const [profileRow, setProfileRow] = useState(null);
  const [loading, setLoading] = useState(true);

  const initializedRef = useRef(false);
  const hydratedUserIdRef = useRef(null);
  const resolveUserRoleRef = useRef(null);

  const applySessionProfile = useCallback((sessionUser, row) => {
    const effective = buildEffectiveProfileRow(sessionUser, row);
    const resolvedRole = effective?.role ?? "user";
    setUser(sessionUser);
    setProfileRow(effective);
    setRole(resolvedRole);
    setTier(resolveTierFromProfile(effective));
    setVerification(resolveProfileVerification(effective || {}));
    hydratedUserIdRef.current = sessionUser?.id ?? null;
    initializedRef.current = Boolean(sessionUser?.id);
    if (sessionUser?.id) {
      markProfileHydrated(sessionUser.id, row);
      if (BL_ENABLE_NOTIFICATIONS) {
        void syncPushSubscriptionForAuthenticatedUser({
          client: supabase,
          userId: sessionUser.id,
        });
      }
    }
  }, []);

  const clearSessionState = useCallback(() => {
    clearProfileSession();
    hydratedUserIdRef.current = null;
    initializedRef.current = false;
    setUser(null);
    setRole("user");
    setProfileRow(null);
    setTier("public");
    setVerification(resolveProfileVerification());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateProfileForUser = async (sessionUser) => {
      const userId = sessionUser?.id;
      if (!userId) return null;

      return runProfileHydrateOnce(userId, async () => {
        await ensureProfile(sessionUser, { flow: "useUserRole" });
        return fetchProfileRowForUser(supabase, userId);
      });
    };

    const resolveUserRole = async (sessionUser, { event = null, force = false } = {}) => {
      if (!sessionUser?.id) {
        if (!cancelled) {
          clearSessionState();
          setLoading(false);
        }
        return;
      }

      const userId = sessionUser.id;

      if (hydratedUserIdRef.current && hydratedUserIdRef.current !== userId) {
        clearProfileSession();
      }

      const needsNetwork = shouldRefetchProfileForAuthEvent(event, userId, force);

      if (!needsNetwork && isProfileHydratedForUser(userId)) {
        if (!cancelled) {
          applySessionProfile(sessionUser, getCachedProfileRow(userId));
          setLoading(false);
        }
        return;
      }

      if (!cancelled && (!initializedRef.current || hydratedUserIdRef.current !== userId)) {
        setLoading(true);
      }

      try {
        const profile = await hydrateProfileForUser(sessionUser);
        if (!cancelled) {
          applySessionProfile(sessionUser, profile);
        }
      } catch (e) {
        console.error("[useUserRole] resolveUserRole failed", e);
        if (!cancelled) {
          applySessionProfile(sessionUser, null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const bootstrap = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        await resolveUserRole(authUser ?? null, { event: "INITIAL_SESSION" });
      } catch (e) {
        console.error("[useUserRole] bootstrap failed", e);
        if (!cancelled) {
          clearSessionState();
          setLoading(false);
        }
      }
    };

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") {
        return;
      }

      const sessionUser = session?.user ?? null;
      const userId = sessionUser?.id;

      if (event === "SIGNED_OUT") {
        const previousUserId = hydratedUserIdRef.current;
        if (!cancelled) {
          if (previousUserId && BL_ENABLE_NOTIFICATIONS) {
            void detachPushSubscriptionOnLogout({
              client: supabase,
              userId: previousUserId,
            });
          }
          clearSessionState();
          setLoading(false);
        }
        return;
      }

      const needsNetwork = shouldRefetchProfileForAuthEvent(event, userId, false);
      const shouldSetLoading =
        (event === "SIGNED_IN" || event === "USER_UPDATED") &&
        needsNetwork &&
        (!initializedRef.current || hydratedUserIdRef.current !== userId);

      if (!cancelled && shouldSetLoading) {
        setLoading(true);
      }

      void resolveUserRole(sessionUser, { event, force: event === "USER_UPDATED" });
    });

    resolveUserRoleRef.current = resolveUserRole;

    return () => {
      cancelled = true;
      resolveUserRoleRef.current = null;
      listener.subscription.unsubscribe();
    };
  }, [applySessionProfile, clearSessionState]);

  const refetchProfile = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser?.id) return null;
    invalidateProfileHydration(authUser.id);
    const resolve = resolveUserRoleRef.current;
    if (!resolve) return null;
    await resolve(authUser, { force: true });
    return getCachedProfileRow(authUser.id);
  }, []);

  const greetingName = useMemo(() => {
    if (!user?.id) return "";
    return resolveDashboardGreetingName({
      username: profileRow?.username,
      email: profileRow?.email ?? user?.email,
    });
  }, [profileRow?.email, profileRow?.username, user?.email, user?.id]);

  const welcomePhrase = useMemo(() => {
    const phrase = formatWelcomeGreeting({
      username: profileRow?.username,
      email: profileRow?.email ?? user?.email,
    });
    return typeof phrase === "string" && phrase.trim() ? phrase : "Welcome back";
  }, [profileRow?.email, profileRow?.username, user?.email, user?.id]);

  const trustCapabilities = useMemo(() => getTrustTierCapabilities(tier), [tier]);

  const value = useMemo(
    () => ({
      user,
      role,
      tier,
      verification,
      profile: profileRow,
      greetingName,
      welcomePhrase,
      trustCapabilities,
      loading,
      refetchProfile,
    }),
    [user, role, tier, verification, profileRow, greetingName, welcomePhrase, trustCapabilities, loading, refetchProfile]
  );

  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
}

export default function useUserRole() {
  const ctx = useContext(UserRoleContext);
  if (!ctx) {
    throw new Error("useUserRole must be used within <UserRoleProvider> (see pages/_app.js).");
  }
  return ctx;
}
