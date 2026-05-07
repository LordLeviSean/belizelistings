import Link from "next/link";
import { useRouter } from "next/router";
import { DM_Sans } from "next/font/google";
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
 * @param {{ active?: "browse" | "favorites" | "dashboard" }} props
 */
export default function SiteNav({ active = "browse" }) {
  const router = useRouter();
  const { user, role, loading } = useUserRole();
  const { enabled: livePaletteModeEnabled } = useLivePaletteMode();
  const { enabled: pulseModeEnabled } = usePulseMode();

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
            active === "favorites" ? styles.navLinkActive : ""
          }`}
        >
          Favorites
        </Link>

        {user ? (
          <button
            type="button"
            onClick={handleDashboard}
            className={`${styles.navLink} ${styles.navPillDashboard} ${
              active === "dashboard" ? styles.navLinkActive : ""
            }`}
          >
            Dashboard
          </button>
        ) : null}

        <span className={`${styles.navLink} ${styles.navPillAgents}`}>Agents</span>
        {loading ? (
          <span className={styles.navLink}>...</span>
        ) : user ? (
          <button
            type="button"
            onClick={handleLogout}
            className={`${styles.navBtn} ${styles.navPillLogout}`}
          >
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
