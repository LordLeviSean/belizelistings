import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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

  const isAdmin = profile?.role === "admin";
  const isAgent = profile?.role === "agent";

  return {
    profile,
    roleLoading,
    isAdmin,
    isAgent,
    canAccessDashboard: isAdmin || isAgent,
    canCreateListings: isAdmin || isAgent,
    canModerateListings: isAdmin,
  };
}
