import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DM_Sans } from "next/font/google";
import {
  ChevronLeft,
  Heart,
  Loader2,
  LogIn,
  LogOut,
  Sparkles,
  UserCircle,
  UsersRound,
} from "lucide-react";
import useUserRole from "../hooks/useUserRole";
import { useAuthGate } from "./auth/AuthGateProvider";
import useLivePaletteMode from "../hooks/useLivePaletteMode";
import usePulseMode from "../hooks/usePulseMode";
import styles from "./SiteNavUnified.module.css";
import NotificationCenter from "./notifications/NotificationCenter";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [drawerPortalReady, setDrawerPortalReady] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 800px)").matches;
  });
  const mobileDrawerRef = useRef(null);
  const accountMenuBtnRef = useRef(null);
  const wasMobileMenuOpenRef = useRef(false);

  useEffect(() => {
    setDrawerPortalReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(max-width: 800px)");
    const sync = () => setIsMobileNav(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setAuthLayoutReady(true);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const toggleAccountMenu = useCallback(() => {
    setMobileMenuOpen((open) => !open);
  }, []);

  const { enabled: livePaletteModeEnabled } = useLivePaletteMode();
  const { enabled: pulseModeEnabled } = usePulseMode();

  const hasMobileDrawer = authLayoutReady && !loading && Boolean(user);
  const drawerOpen = mobileMenuOpen && hasMobileDrawer;

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeMobileMenu]);

  useEffect(() => {
    if (!drawerOpen || !mobileDrawerRef.current) return undefined;
    const drawer = mobileDrawerRef.current;
    let removeKeydown = () => {};

    const raf = window.requestAnimationFrame(() => {
      const focusables = Array.from(drawer.querySelectorAll(FOCUSABLE));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      first?.focus({ preventScroll: true });

      const onKeyDown = (e) => {
        if (e.key !== "Tab" || focusables.length === 0) return;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      };

      drawer.addEventListener("keydown", onKeyDown);
      removeKeydown = () => drawer.removeEventListener("keydown", onKeyDown);
    });

    return () => {
      window.cancelAnimationFrame(raf);
      removeKeydown();
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (mobileMenuOpen) {
      wasMobileMenuOpenRef.current = true;
      return undefined;
    }
    if (wasMobileMenuOpenRef.current) {
      accountMenuBtnRef.current?.focus();
      wasMobileMenuOpenRef.current = false;
    }
    return undefined;
  }, [mobileMenuOpen]);

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

  const handleDashboardFromMobile = () => {
    closeMobileMenu();
    handleDashboard();
  };

  const handleLogout = async () => {
    closeMobileMenu();
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

  const navContextClasses = (variant) => {
    const isDrawer = variant === "drawer";
    return {
      isDrawer,
      onNavigate: isDrawer ? closeMobileMenu : undefined,
      linkBase: isDrawer ? `${styles.navLink} ${styles.drawerNavLink}` : styles.navLink,
      btnBase: isDrawer ? `${styles.navBtn} ${styles.drawerNavLink}` : styles.navBtn,
    };
  };

  const renderFavoritesLink = (variant) => {
    const { onNavigate, linkBase } = navContextClasses(variant);
    return (
      <Link
        href="/favorites"
        onClick={onNavigate}
        className={`${linkBase} ${styles.navPillFavorites} ${
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
    );
  };

  const renderAgentsLink = (variant) => {
    const { onNavigate, linkBase } = navContextClasses(variant);
    return (
      <Link
        href="/agents"
        onClick={onNavigate}
        className={`${linkBase} ${styles.navPillAgents} ${
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
    );
  };

  const renderDashboardButton = (variant) => {
    if (!user) return null;
    const { linkBase } = navContextClasses(variant);
    return (
      <button
        type="button"
        onClick={variant === "drawer" ? handleDashboardFromMobile : handleDashboard}
        className={`${linkBase} ${styles.navPillDashboard} ${
          resolvedActive === "dashboard" ? styles.navLinkActive : ""
        } ${resolvedActive === "dashboard" ? styles.navDashboardActive : ""}`}
      >
        <span className={styles.navLinkInner}>
          <Sparkles
            className={`${styles.navIcon} ${styles.navIconDashboard} ${
              dashboardIdleHomeChrome ? styles.navIconDashboardHome : ""
            } ${
              resolvedActive === "dashboard" ? styles.navIconDashboardActive : ""
            } ${resolvedActive === "dashboard" && role === "admin" ? styles.navIconDashboardPower : ""}`}
            fill={dashboardFilled ? "currentColor" : "none"}
            strokeWidth={1.85}
            aria-hidden
          />
          Dashboard
        </span>
      </button>
    );
  };

  const renderNotificationCenter = (variant) => {
    if (!user) return null;
    const { isDrawer } = navContextClasses(variant);
    if (!isDrawer && isMobileNav) return null;
    if (isDrawer) {
      return (
        <div className={styles.drawerNotificationWrap}>
          <NotificationCenter layout="drawer" onNavigate={closeMobileMenu} />
        </div>
      );
    }
    return <NotificationCenter />;
  };

  const renderAuthSlot = (variant, { mode = "default" } = {}) => {
    const { onNavigate, linkBase, btnBase } = navContextClasses(variant);
    const isMobileAccountTrigger = mode === "account" && variant === "mobileBar" && user;

    if (!authLayoutReady) {
      return (
        <span className={`${linkBase} ${styles.navAuthSkeleton}`} aria-hidden="true" />
      );
    }

    if (loading) {
      return (
        <span className={`${linkBase} ${styles.navLinkIdle}`} aria-busy="true" aria-label="Loading">
          <Loader2 className={`${styles.navIcon} ${styles.navIconSpin}`} strokeWidth={1.85} aria-hidden />
        </span>
      );
    }

    if (user) {
      if (mode === "account") {
        return (
          <button
            ref={isMobileAccountTrigger ? accountMenuBtnRef : undefined}
            type="button"
            onClick={isMobileAccountTrigger ? toggleAccountMenu : handleDashboard}
            className={`${linkBase}${mobileMenuOpen && isMobileAccountTrigger ? ` ${styles.navLinkActive}` : ""}`}
            aria-expanded={isMobileAccountTrigger ? mobileMenuOpen : undefined}
            aria-controls={isMobileAccountTrigger ? "site-nav-mobile-drawer" : undefined}
            aria-haspopup={isMobileAccountTrigger ? "dialog" : undefined}
          >
            <span className={styles.navLinkInner}>
              <UserCircle className={styles.navIcon} strokeWidth={1.85} aria-hidden />
              Account
            </span>
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={handleLogout}
          className={`${btnBase} ${styles.navPillLogout}`}
        >
          <span className={styles.navLinkInner}>
            <LogOut className={styles.navIcon} strokeWidth={1.85} aria-hidden />
            Logout
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          openLoginIfNeeded();
        }}
        className={linkBase}
      >
        <span className={styles.navLinkInner}>
          <LogIn className={styles.navIcon} strokeWidth={1.85} aria-hidden />
          Login
        </span>
      </button>
    );
  };

  const renderNavActions = (variant = "desktop") => (
    <>
      {renderFavoritesLink(variant)}
      <div className={styles.authSessionCluster}>
        {renderDashboardButton(variant)}
        {renderAgentsLink(variant)}
        {renderNotificationCenter(variant)}
        <div className={navContextClasses(variant).isDrawer ? styles.drawerAuthSlot : styles.authAccountSlot}>
          {renderAuthSlot(variant)}
        </div>
      </div>
    </>
  );

  const renderPrimaryNavActions = (variant = "mobileBar") => (
    <>
      {renderFavoritesLink(variant)}
      {renderAgentsLink(variant)}
      <div className={styles.authAccountSlot}>{renderAuthSlot(variant, { mode: user ? "account" : "default" })}</div>
    </>
  );

  const renderSecondaryNavActions = (variant = "drawer") => {
    if (!user) return null;
    return (
      <>
        {renderDashboardButton(variant)}
        {renderNotificationCenter(variant)}
        <div className={styles.drawerAuthSlot}>{renderAuthSlot(variant)}</div>
      </>
    );
  };

  const mobileDrawerLayer =
    drawerOpen && drawerPortalReady
      ? createPortal(
          <>
            <div
              className={styles.mobileDrawerBackdrop}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeMobileMenu();
              }}
            />
            <nav
              id="site-nav-mobile-drawer"
              ref={mobileDrawerRef}
              className={styles.mobileDrawer}
              role="dialog"
              aria-modal="true"
              aria-label="Account navigation"
            >
              <div className={styles.mobileDrawerInner}>{renderSecondaryNavActions("drawer")}</div>
            </nav>
          </>,
          document.body
        )
      : null;

  return (
    <>
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

        <nav className={`${styles.navLinks} ${styles.navLinksDesktop}`} aria-label="Primary navigation">
          {renderNavActions("desktop")}
        </nav>

        <nav
          className={`${styles.navLinks} ${styles.navLinksMobilePrimary}`}
          aria-label="Primary navigation"
        >
          {renderPrimaryNavActions("mobileBar")}
        </nav>
      </header>
      {mobileDrawerLayer}
    </>
  );
}
