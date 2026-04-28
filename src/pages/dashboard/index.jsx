import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SiteNav from "../../components/SiteNav";
import AgentAccessGate from "../../components/AgentAccessGate";
import useAuth from "../../hooks/useAuth";
import { supabase } from "../../lib/supabaseClient";
import styles from "../../styles/Dashboard.module.css";

export default function DashboardIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAgent, setIsAgent] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const loadProfile = async () => {
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!cancelled) {
        setIsAgent(data?.role === "agent");
        setIsAdmin(data?.role === "admin");
        setProfileLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading || profileLoading) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <p className={styles.muted}>Loading dashboard...</p>
        </main>
      </div>
    );
  }

  if (!user) return null;

  if (isAdmin) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main>
          <div
            style={{
              maxWidth: "1100px",
              margin: "0 auto",
              padding: "40px 20px",
            }}
          >
            <h1 style={{ color: "#e6edf3", fontSize: "34px", marginBottom: "6px" }}>
              Admin Dashboard
            </h1>
            <p style={{ color: "#9da7b3", marginBottom: "20px" }}>
              You have full system control.
            </p>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "22px",
              }}
            >
              <Link href="/admin">
                <button
                  type="button"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: "#1f7a4f",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Open Admin Panel
                </button>
              </Link>
              <Link href="/dashboard/create">
                <button
                  type="button"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: "#161d27",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#e6edf3",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Create Listing
                </button>
              </Link>
              <Link href="/dashboard/listings">
                <button
                  type="button"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: "#161d27",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#e6edf3",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  View Listings
                </button>
              </Link>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "16px",
                marginTop: "24px",
              }}
            >
              {[
                { label: "Pending", value: 0 },
                { label: "Listings", value: 3 },
                { label: "Users", value: 2 },
                { label: "Revenue", value: "—" },
              ].map((card, i) => (
                <div
                  key={i}
                  style={{
                    background: "#161d27",
                    borderRadius: "14px",
                    padding: "18px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#9da7b3" }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: "28px", marginTop: "6px", color: "#e6edf3" }}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: "24px",
                background: "#121821",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "14px",
                padding: "16px",
              }}
            >
              <h3 style={{ color: "#e6edf3", marginBottom: "6px" }}>Recent Activity</h3>
              <p style={{ color: "#9da7b3" }}>No recent activity yet.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <h1 className={styles.title}>Agent Dashboard</h1>
        {isAgent ? (
          <div className={styles.linkRow}>
            <Link href="/dashboard/listings" className={styles.dashboardLink}>
              My Listings
            </Link>
            <Link href="/dashboard/create" className={styles.dashboardLink}>
              Create Listing
            </Link>
          </div>
        ) : (
          <AgentAccessGate user={user} />
        )}
      </main>
    </div>
  );
}
