import { PLATFORM_TIERS } from "../constants/operationalModel";
import { getTrustTierCapabilities } from "../constants/trustModel";
import useUserRole from "./useUserRole";

/**
 * Role/tier capabilities for gated flows (create workspace, listing detail).
 * Reads the canonical profile from {@link UserRoleProvider} — no extra `profiles` GET.
 */
export default function useRoleAccess(requestedUserId) {
  const { user, profile, tier, verification, trustCapabilities, loading, role } = useUserRole();

  const sessionUserId = user?.id ?? null;
  const matchesSession =
    !requestedUserId || !sessionUserId || String(requestedUserId) === String(sessionUserId);
  const profileRow = matchesSession ? profile : null;
  const roleLoading = loading || (Boolean(requestedUserId) && !matchesSession);

  const isAdmin = tier === PLATFORM_TIERS.ADMIN;
  const isAgent = tier === PLATFORM_TIERS.AGENT_FREE || tier === PLATFORM_TIERS.AGENT_PRO;
  const isRegularUser = String(profileRow?.role || role || "").toLowerCase() === "user";
  const canCreateListingsAsUser = isRegularUser && tier === PLATFORM_TIERS.PUBLIC;
  const effectiveVerification = verification;
  const effectiveTrustCapabilities = trustCapabilities;

  return {
    profile: profileRow,
    role: String(profileRow?.role || role || "").trim().toLowerCase(),
    tier,
    verification: effectiveVerification,
    trustCapabilities: effectiveTrustCapabilities,
    roleLoading,
    isAdmin,
    isAgent,
    isRegularUser,
    canAccessDashboard: isAdmin || isAgent,
    canCreateListings: isAdmin || isAgent || canCreateListingsAsUser,
    canModerateListings: isAdmin,
  };
}
