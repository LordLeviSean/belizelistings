import Link from "next/link";
import { useRouter } from "next/router";
import { DM_Sans } from "next/font/google";
import { Heart, Loader2, LogIn, LogOut, Sparkles, UsersRound } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import useUserRole from "../hooks/useUserRole";
import useLivePaletteMode from "../hooks/useLivePaletteMode";
import usePulseMode from "../hooks/usePulseMode";
import styles from "./SiteNavUnified.module.css";

/** Premium geometric-humanist wordmark only — scoped to nav brand link */
const brandWordmarkFont = DM_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/**
 * @param {{ active?: "browse" | "favorites" | "dashboard" | "agents" | "auto" }} props
 */
export default function SiteNav({ active = "auto" }) {
  const router = useRouter();
  const { user, role, loading } = useUserRole();
  const { enabled: livePaletteModeEnabled } = useLivePaletteMode();
  const { enabled: pulseModeEnabled } = usePulseMode();

  const route = router.pathname || "";
  const isHomepage = route === "/";
  const isFavoritesPage = route === "/favorites";
  const routeActive = (() => {
    if (route === "/favorites") return "favorites";
    if (route === "/dashboard/agent" || route === "/agents") return "agents";
    if (route.startsWith("/dashboard") || route.startsWith("/admin")) return "dashboard";
    return null;
  })();
  const resolvedActive = active === "auto" ? routeActive : active;
  const favoritesFilled = isHomepage || resolvedActive === "favorites";
  const dashboardFilled = isHomepage || isFavoritesPage || resolvedActive === "dashboard";

  const handleDashboard = () => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    if (role === "admin") router.push("/admin");
    else if (role === "agent") router.push("/dashboard/agent");
    else router.push("/dashboard/user");
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
  };

  const brandLetters = "BelizeListings".split("");
  const belizeEnd = 6;

  return (
    <header className={styles.navbar}>
      <Link href="/" className={`${styles.brand} ${brandWordmarkFont.className}`}>
        <span
          aria-label="BelizeListings"
          className={`${styles.brandWordmark} ${
            livePaletteModeEnabled ? styles.brandWordmarkLive : ""
          } ${pulseModeEnabled ? styles.brandWordmarkPulse : ""}`}
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
            resolvedActive === "favorites" ? styles.navLinkActive : ""
          } ${resolvedActive === "favorites" ? styles.navFavoritesActive : ""}`}
        >
          <span className={styles.navLinkInner}>
            <Heart
              className={`${styles.navIcon} ${styles.navIconFavorites} ${
                isHomepage ? styles.navIconFavoritesHome : ""
              } ${resolvedActive === "favorites" ? styles.navIconFavoritesActive : ""}`}
              fill={favoritesFilled ? "currentColor" : "none"}
              strokeWidth={1.85}
              aria-hidden
            />
            Favorites
          </span>
        </Link>

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
                  isHomepage || isFavoritesPage ? styles.navIconDashboardHome : ""
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

        <span
          className={`${styles.navLink} ${styles.navPillAgents} ${
            resolvedActive === "agents" ? styles.navLinkActive : ""
          }`}
        >
          <span className={styles.navLinkInner}>
            <UsersRound className={styles.navIcon} strokeWidth={1.85} aria-hidden />
            Agents
          </span>
        </span>
        {loading ? (
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
          <Link href="/login" className={styles.navLink}>
            <span className={styles.navLinkInner}>
              <LogIn className={styles.navIcon} strokeWidth={1.85} aria-hidden />
              Login
            </span>
          </Link>
        )}
      </nav>
    </header>
  );
}
