import Link from "next/link";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
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
import BrandWordmark from "./BrandWordmark";
import styles from "./SiteNavUnified.module.css";
import NotificationCenter from "./notifications/NotificationCenter";
import { resolveSiteNavActiveFromPath } from "../lib/siteNavRouting";

const BODY_DRAWER_CLASS = "site-nav-drawer-open";
/** Ignore backdrop taps right after open (iOS ghost-tap guard). */
const BACKDROP_TAP_GUARD_MS = 380;

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
  const [isMobileNav, setIsMobileNav] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 800px)").matches;
  });
  const mobileDrawerRef = useRef(null);
  const accountMenuBtnRef = useRef(null);
  const drawerOpenedAtRef = useRef(0);
  const [drawerExtrasReady, setDrawerExtrasReady] = useState(false);

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

  const canShowMobileDrawer = authLayoutReady && Boolean(user);
  const drawerOpen = mobileMenuOpen && canShowMobileDrawer;

  useEffect(() => {
    closeMobileMenu();
  }, [router.pathname, closeMobileMenu]);

  useEffect(() => {
    if (canShowMobileDrawer || !mobileMenuOpen) return undefined;
    setMobileMenuOpen(false);
    return undefined;
  }, [canShowMobileDrawer, mobileMenuOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (!drawerOpen) {
      document.body.classList.remove(BODY_DRAWER_CLASS);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      return undefined;
    }
    drawerOpenedAtRef.current = Date.now();
    document.body.classList.add(BODY_DRAWER_CLASS);
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    const extrasRaf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setDrawerExtrasReady(true));
    });
    return () => {
      window.cancelAnimationFrame(extrasRaf);
      document.body.classList.remove(BODY_DRAWER_CLASS);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [drawerOpen]);

  useEffect(
    () => () => {
      if (typeof document === "undefined") return;
      document.body.classList.remove(BODY_DRAWER_CLASS);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    },
    []
  );

  useEffect(() => {
    if (!drawerOpen) {
      setDrawerExtrasReady(false);
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeMobileMenu]);

  const handleBackdropDismiss = useCallback(
    (event) => {
      if (Date.now() - drawerOpenedAtRef.current < BACKDROP_TAP_GUARD_MS) return;
      if (event.target !== event.currentTarget) return;
      closeMobileMenu();
    },
    [closeMobileMenu]
  );

  const route = router.pathname || "";
  const isHomepage = route === "/";
  const isFavoritesPage = route === "/favorites";
  const routeActive = resolveSiteNavActiveFromPath(route);
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

  const renderNotificationCenter = (variant, { deferDrawerMount = false } = {}) => {
    if (!user) return null;
    const { isDrawer } = navContextClasses(variant);
    if (!isDrawer && isMobileNav) return null;
    if (isDrawer) {
      if (deferDrawerMount && !drawerExtrasReady) {
        return (
          <span className={`${styles.navLink} ${styles.drawerNavLink} ${styles.navLinkIdle}`} aria-hidden="true">
            <span className={styles.navLinkInner}>
              <Bell className={styles.navIcon} strokeWidth={1.85} aria-hidden />
              Notifications
            </span>
          </span>
        );
      }
      if (loading) {
        return (
          <span className={`${styles.navLink} ${styles.drawerNavLink} ${styles.navLinkIdle}`} aria-busy="true">
            <span className={styles.navLinkInner}>
              <Loader2 className={`${styles.navIcon} ${styles.navIconSpin}`} strokeWidth={1.85} aria-hidden />
              Notifications
            </span>
          </span>
        );
      }
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
        {renderNotificationCenter(variant, { deferDrawerMount: variant === "drawer" })}
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
    const showNotifications =
      variant !== "drawer" || drawerExtrasReady;
    return (
      <>
        {renderDashboardButton(variant)}
        <div className={styles.drawerAuthSlot}>{renderAuthSlot(variant)}</div>
        {showNotifications
          ? renderNotificationCenter(variant, { deferDrawerMount: false })
          : null}
      </>
    );
  };

  const mobileDrawerLayer =
    drawerOpen && typeof document !== "undefined"
      ? createPortal(
          <div className={styles.mobileDrawerRoot}>
            <div
              className={styles.mobileDrawerBackdrop}
              role="presentation"
              aria-hidden="true"
              onPointerDown={handleBackdropDismiss}
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
          </div>,
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
        <BrandWordmark />

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
