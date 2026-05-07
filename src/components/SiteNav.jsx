import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import useUserRole from "../hooks/useUserRole";
import useLivePaletteMode from "../hooks/useLivePaletteMode";
import usePulseMode from "../hooks/usePulseMode";
import useSpotlightMode from "../hooks/useSpotlightMode";
import styles from "./SiteNav.module.css";

/**
 * @param {{ active?: "browse" | "favorites" | "dashboard" }} props
 */
export default function SiteNav({ active = "browse" }) {
  const router = useRouter();
  const { user, role, loading } = useUserRole();
  const { enabled: livePaletteModeEnabled } = useLivePaletteMode();
  const { enabled: pulseModeEnabled } = usePulseMode();
  const { enabled: spotlightModeEnabled } = useSpotlightMode();

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

  return (
    <header className={styles.navbar}>
      <Link href="/" className={styles.brand}>
        <span
          aria-label="BelizeListings"
          className={`${styles.brandWordmark} ${
            livePaletteModeEnabled ? styles.brandWordmarkLive : ""
          } ${livePaletteModeEnabled && pulseModeEnabled ? styles.brandWordmarkPulse : ""} ${
            spotlightModeEnabled ? styles.brandWordmarkSpotlight : ""
          }`}
        >
          {brandLetters.map((ch, i) => (
            <span key={`${ch}-${i}`} className={styles.brandLetter}>
              {ch}
            </span>
          ))}
        </span>
      </Link>

      <nav className={styles.navLinks} aria-label="Primary navigation">
        <Link
          href="/favorites"
          className={`${styles.navLink} ${active === "favorites" ? styles.navLinkActive : ""}`}
        >
          Favorites
        </Link>

        {user ? (
          <button
            type="button"
            onClick={handleDashboard}
            className={`${styles.navLink} ${active === "dashboard" ? styles.navLinkActive : ""}`}
          >
            Dashboard
          </button>
        ) : null}

        <span className={styles.navLink}>Agents</span>
        {loading ? (
          <span className={styles.navLink}>...</span>
        ) : user ? (
          <button type="button" onClick={handleLogout} className={styles.navBtn}>
            Logout
          </button>
        ) : (
          <Link href="/login" className={styles.navLink}>
            Login
          </Link>
        )}
      </nav>
    </header>
  );
}
