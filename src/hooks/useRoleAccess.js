import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { PLATFORM_TIERS, resolveTierFromProfile } from "../constants/operationalModel";
import { getTrustTierCapabilities, resolveProfileVerification } from "../constants/trustModel";

export default function useRoleAccess(userId) {
  const [profile, setProfile] = useState(null);
  const [roleLoading, setRoleLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setRoleLoading(false);
      return;
    }

    let cancelled = false;
    setRoleLoading(true);

    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!cancelled) {
        setProfile(data ?? null);
        setRoleLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const tier = resolveTierFromProfile(profile);
  const isAdmin = tier === PLATFORM_TIERS.ADMIN;
  const isAgent = tier === PLATFORM_TIERS.AGENT_FREE || tier === PLATFORM_TIERS.AGENT_PRO;
  const verification = resolveProfileVerification(profile || {});
  const trustCapabilities = getTrustTierCapabilities(tier);

  return {
    profile,
    tier,
    verification,
    trustCapabilities,
    roleLoading,
    isAdmin,
    isAgent,
    canAccessDashboard: isAdmin || isAgent,
    canCreateListings: isAdmin || isAgent,
    canModerateListings: isAdmin,
  };
}
