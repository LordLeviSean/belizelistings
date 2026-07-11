import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import useUserRole from "@/hooks/useUserRole";
import { loginHref, LOGIN_PATH } from "@/constants/authRoutes";
import AlreadySignedInModal from "./AlreadySignedInModal";

const AuthGateContext = createContext(null);

/**
 * Centralized “already signed in” UX + logout navigation.
 * Must render inside {@link UserRoleProvider}.
 */
export function AuthGateProvider({ children }) {
  const router = useRouter();
  const { user, loading } = useUserRole();
  const [alreadySignedInOpen, setAlreadySignedInOpen] = useState(false);
  const [switchingOut, setSwitchingOut] = useState(false);
  const pendingAfterSignOutRef = useRef(LOGIN_PATH);

  const closeAlreadySignedIn = useCallback(() => {
    if (switchingOut) return;
    setAlreadySignedInOpen(false);
  }, [switchingOut]);

  /** After session clear, land on home (never login). */
  const logoutToHome = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(error.message);
      return;
    }
    void router.replace("/");
  }, [router]);

  const signOutAndGoToPendingLogin = useCallback(async () => {
    const dest = pendingAfterSignOutRef.current || LOGIN_PATH;
    setSwitchingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert(error.message);
        return;
      }
      setAlreadySignedInOpen(false);
      void router.replace(dest);
    } finally {
      setSwitchingOut(false);
    }
  }, [router]);

  /**
   * Navbar / CTAs: go to login (or signup query) unless already authenticated — then show modal.
   */
  const openLoginIfNeeded = useCallback(
    (opts) => {
      if (loading) return;
      const dest = loginHref({
        signup: Boolean(opts?.signup),
        returnTo: opts?.returnTo ?? null,
      });
      if (user) {
        pendingAfterSignOutRef.current = dest;
        setAlreadySignedInOpen(true);
      } else {
        void router.push(dest);
      }
    },
    [loading, user, router]
  );

  const presentAlreadySignedInModal = useCallback((opts) => {
    pendingAfterSignOutRef.current = loginHref({
      signup: Boolean(opts?.signup),
      returnTo: opts?.returnTo ?? null,
    });
    setAlreadySignedInOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      openLoginIfNeeded,
      /** Alias for clarity at call sites (login vs signup intent lives in opts). */
      ensureSignInAccess: openLoginIfNeeded,
      presentAlreadySignedInModal,
      closeAlreadySignedIn,
      logoutToHome,
      signOutAndSwitchAccount: signOutAndGoToPendingLogin,
      authReady: !loading,
    }),
    [
      openLoginIfNeeded,
      presentAlreadySignedInModal,
      closeAlreadySignedIn,
      logoutToHome,
      signOutAndGoToPendingLogin,
      loading,
    ]
  );

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      <AlreadySignedInModal
        open={alreadySignedInOpen}
        onClose={closeAlreadySignedIn}
        onContinueSession={closeAlreadySignedIn}
        onSignOutAndSwitch={() => void signOutAndGoToPendingLogin()}
        switchingOut={switchingOut}
      />
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    throw new Error("useAuthGate must be used within <AuthGateProvider> (see pages/_app.js).");
  }
  return ctx;
}
