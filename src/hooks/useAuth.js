import useUserRole from "./useUserRole";

/**
 * Lightweight auth surface for call sites that only need session identity.
 * Subscribes via {@link UserRoleProvider} in `_app.js` — do not add a second
 * `onAuthStateChange` here (profile + role resolution lives in useUserRole).
 */
export default function useAuth() {
  const { user, loading } = useUserRole();
  return { user, loading };
}
