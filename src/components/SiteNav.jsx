import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { DM_Sans } from "next/font/google";
import { ChevronLeft, Heart, Loader2, LogIn, LogOut, Sparkles, UsersRound } from "lucide-react";
import useUserRole from "../hooks/useUserRole";
import { useAuthGate } from "./auth/AuthGateProvider";
import useLivePaletteMode from "../hooks/useLivePaletteMode";
import usePulseMode from "../hooks/usePulseMode";
import styles from "./SiteNavUnified.module.css";
import NotificationCenter from "./notifications/NotificationCenter";

/** Premium geometric-humanist wordmark only — scoped to nav brand link */
const brandWordmarkFont = DM_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/**
 * @param {{ active?: "browse" | "favorites" | "dashboard" | "agents" | "auto", variant?: "full" | "userDashboard" }} props
 * `userDashboard`: lightweight bar with back only (regular user dashboard).
 */
export default function SiteNav({ active = "auto", variant = "full" }) {
  const router = useRouter();
  const { user, role, loading } = useUserRole();
  const { openLoginIfNeeded, logoutToHome } = useAuthGate();
  const [authLayoutReady, setAuthLayoutReady] = useState(false);

  useEffect(() => {
    setAuthLayoutReady(true);
  }, []);
  const { enabled: livePaletteModeEnabled } = useLivePaletteMode();
  const { enabled: pulseModeEnabled } = usePulseMode();

  const route = router.pathname || "";
  const isHomepage = route === "/";
  const isFavoritesPage = route === "/favorites";
  const routeActive = (() => {
    if (route === "/favorites") return "favorites";
    if (route === "/agents" || route.startsWith("/agents/")) return "agents";
    if (route.startsWith("/dashboard") || route.startsWith("/admin")) return "dashboard";
    if (
      route === "/" ||
      route === "/search" ||
      route.startsWith("/listing/") ||
      route.startsWith("/listings/district/")
    ) {
      return "browse";
    }
    return null;
  })();
  const resolvedActive = active === "auto" ? routeActive : active;
  const favoritesNavActive = resolvedActive === "favorites";
  const agentsNavActive = resolvedActive === "agents";
  /**
   * Homepage Favorites pill (inactive) is canonical: filled heart + navIconFavoritesHome.
   * Reuse that same chrome on all primary shells where Favorites is not the active tab —
   * browse (map/listing/search/district), dashboard, admin, agents — so nav never drifts.
   */
  const favoritesIdleHomeChrome =
    !favoritesNavActive &&
    (isHomepage ||
      resolvedActive === "browse" ||
      resolvedActive === "dashboard" ||
      resolvedActive === "agents");
  const favoritesFilled = favoritesNavActive || favoritesIdleHomeChrome;
  const agentsIdleHomeChrome =
    !agentsNavActive &&
    (isHomepage ||
      resolvedActive === "browse" ||
      resolvedActive === "dashboard" ||
      resolvedActive === "favorites");
  const agentsFilled = agentsNavActive || agentsIdleHomeChrome;
  /** Filled sparkles on homepage, favorites, dashboard, browse, and agents (idle home chrome). */
  const dashboardIdleHomeChrome =
    isHomepage ||
    isFavoritesPage ||
    resolvedActive === "browse" ||
    resolvedActive === "agents";
  const dashboardFilled =
    dashboardIdleHomeChrome || resolvedActive === "dashboard";

  const handleDashboard = () => {
    if (loading) return;
    if (!user) {
      openLoginIfNeeded();
      return;
    }

    if (role === "admin") router.push("/admin");
    else if (role === "broker" || role === "brokerage" || role === "property_manager") router.push("/dashboard/broker");
    else if (role === "agent") router.push("/dashboard/agent");
    else router.push("/dashboard/user");
  };

  const handleLogout = async () => {
    await logoutToHome();
  };

  const handleUserDashboardBack = () => {
    if (typeof window === "undefined") {
      void router.push("/");
      return;
    }
    try {
      const ref = document.referrer;
      if (ref && ref.startsWith(window.location.origin)) {
        router.back();
        return;
      }
    } catch {
      /* ignore */
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    void router.push("/");
  };

  if (variant === "userDashboard") {
    return (
      <header className={`${styles.navbar} ${styles.navbarUserDashboard}`}>
        <button
          type="button"
          className={styles.userDashboardBack}
          onClick={handleUserDashboardBack}
          aria-label="Back to previous page or BelizeListings home"
        >
          <ChevronLeft className={styles.userDashboardBackIcon} strokeWidth={2.1} aria-hidden />
          Back
        </button>
      </header>
    );
  }

  const brandLetters = "BelizeListings".split("");
  const belizeEnd = 6;

  const signedOutNavTight =
    authLayoutReady && !loading && !user;
  const signedInNavCluster =
    authLayoutReady && !loading && user;

  return (
    <header
      className={`${styles.navbar}${signedOutNavTight ? ` ${styles.navbarSignedOut}` : ""}${
        signedInNavCluster ? ` ${styles.navbarSignedIn}` : ""
      }`}
    >
      <Link href="/" className={`${styles.brand} ${brandWordmarkFont.className}`}>
        <span
          aria-label="BelizeListings"
          className={styles.brandWordmark}
          data-live={livePaletteModeEnabled ? "true" : "false"}
          data-pulse={pulseModeEnabled ? "true" : "false"}
        >
          {brandLetters.map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              className={`${styles.brandLetter} ${
                i < belizeEnd ? styles.brandLetterBelize : styles.brandLetterListings
              }`}
            >
              {ch}
            </span>
          ))}
        </span>
      </Link>

      <nav className={styles.navLinks} aria-label="Primary navigation">
        <Link
          href="/favorites"
          className={`${styles.navLink} ${styles.navPillFavorites} ${
            favoritesNavActive ? styles.navLinkActive : ""
          } ${favoritesNavActive ? styles.navFavoritesActive : ""}`}
        >
          <span className={styles.navLinkInner}>
            <Heart
              className={`${styles.navIcon} ${styles.navIconFavorites} ${
                favoritesIdleHomeChrome ? styles.navIconFavoritesHome : ""
              } ${favoritesNavActive ? styles.navIconFavoritesActive : ""}`}
              fill={favoritesFilled ? "currentColor" : "none"}
              strokeWidth={1.85}
              aria-hidden
            />
            Favorites
          </span>
        </Link>

        <div className={styles.authSessionCluster}>
          {user ? (
            <button
              type="button"
              onClick={handleDashboard}
              className={`${styles.navLink} ${styles.navPillDashboard} ${
                resolvedActive === "dashboard" ? styles.navLinkActive : ""
              } ${resolvedActive === "dashboard" ? styles.navDashboardActive : ""}`}
            >
              <span className={styles.navLinkInner}>
                <Sparkles
                  className={`${styles.navIcon} ${styles.navIconDashboard} ${
                    dashboardIdleHomeChrome ? styles.navIconDashboardHome : ""
                  } ${
                    resolvedActive === "dashboard" ? styles.navIconDashboardActive : ""
                  } ${resolvedActive === "dashboard" && role === "admin" ? styles.navIconDashboardPower : ""
                  }`}
                  fill={dashboardFilled ? "currentColor" : "none"}
                  strokeWidth={1.85}
                  aria-hidden
                />
                Dashboard
              </span>
            </button>
          ) : null}

          <Link
            href="/agents"
            className={`${styles.navLink} ${styles.navPillAgents} ${
              agentsNavActive ? styles.navLinkActive : ""
            } ${agentsNavActive ? styles.navAgentsActive : ""}`}
          >
            <span className={styles.navLinkInner}>
              <UsersRound
                className={`${styles.navIcon} ${styles.navIconAgents} ${
                  agentsIdleHomeChrome ? styles.navIconAgentsHome : ""
                } ${agentsNavActive ? styles.navIconAgentsActive : ""}`}
                fill={agentsFilled ? "currentColor" : "none"}
                strokeWidth={1.85}
                aria-hidden
              />
              Agents
            </span>
          </Link>

          <NotificationCenter />

          <div className={styles.authAccountSlot}>
            {!authLayoutReady ? (
              <span className={`${styles.navLink} ${styles.navAuthSkeleton}`} aria-hidden="true" />
            ) : loading ? (
              <span className={`${styles.navLink} ${styles.navLinkIdle}`} aria-busy="true" aria-label="Loading">
                <Loader2 className={`${styles.navIcon} ${styles.navIconSpin}`} strokeWidth={1.85} aria-hidden />
              </span>
            ) : user ? (
              <button
                type="button"
                onClick={handleLogout}
                className={`${styles.navBtn} ${styles.navPillLogout}`}
              >
                <span className={styles.navLinkInner}>
                  <LogOut className={styles.navIcon} strokeWidth={1.85} aria-hidden />
                  Logout
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openLoginIfNeeded()}
                className={styles.navLink}
              >
                <span className={styles.navLinkInner}>
                  <LogIn className={styles.navIcon} strokeWidth={1.85} aria-hidden />
                  Login
                </span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
