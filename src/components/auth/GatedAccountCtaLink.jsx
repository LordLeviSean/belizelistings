import Link from "next/link";
import useUserRole from "@/hooks/useUserRole";
import { useAuthGate } from "./AuthGateProvider";
import { loginHref } from "@/constants/authRoutes";

/**
 * Login / signup CTAs: when signed in, intercept navigation and show the shared “already signed in” modal.
 */
export default function GatedAccountCtaLink({ signup = false, className, children }) {
  const href = loginHref({ signup });
  const { user, loading } = useUserRole();
  const { openLoginIfNeeded } = useAuthGate();

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        if (user) {
          e.preventDefault();
          openLoginIfNeeded({ signup });
        }
      }}
    >
      {children}
    </Link>
  );
}
