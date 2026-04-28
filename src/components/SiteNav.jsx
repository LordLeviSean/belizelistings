import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import useAuth from "../hooks/useAuth";
import styles from "./SiteNav.module.css";

/**
 * @param {{ active?: "browse" | "favorites" | "dashboard" }} props
 */
export default function SiteNav({ active = "browse" }) {
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
  };

  return (
    <header className={styles.navbar}>
      <Link href="/" className={styles.brand}>
        BelizeListings
      </Link>

      <nav className={styles.navLinks} aria-label="Primary navigation">
        <Link
          href="/"
          className={`${styles.navLink} ${active === "browse" ? styles.navLinkActive : ""}`}
        >
          Browse
        </Link>

        <Link
          href="/favorites"
          className={`${styles.navLink} ${active === "favorites" ? styles.navLinkActive : ""}`}
        >
          Favorites
        </Link>

        {user ? (
          <Link
            href="/dashboard"
            className={`${styles.navLink} ${active === "dashboard" ? styles.navLinkActive : ""}`}
          >
            Dashboard
          </Link>
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
