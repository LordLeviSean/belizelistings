import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import RoleBadge from "@/components/dashboard/RoleBadge";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import { DASHBOARD_ROLE } from "@/constants/dashboardRoles";
import { supabase } from "@/lib/supabaseClient";
import { fetchAgentDirectory } from "@/lib/agentPublicProfile";
import { formatProfileDisplayLabel } from "@/lib/profileDisplayName";
import { getRegionLabel, normalizeRegionSlug } from "@/constants/geographyLayer";
import styles from "@/styles/Agents.module.css";

export default function AgentsPage() {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const result = await fetchAgentDirectory(supabase);
      if (cancelled) return;
      setAgents(result.agents || []);
      setUnavailable(Boolean(result.unavailable));
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.page}>
      <SiteNav active="agents" />

      <main className={styles.main}>
        <header className={styles.header}>
          <p className={styles.kicker}>BelizeListings Agents</p>
          <h1>Agent Directory</h1>
          <p className={styles.lead}>
            Browse licensed agents with public profiles and active inventory on the national map.
          </p>
        </header>

        {loading ? (
          <div className={styles.grid} aria-busy="true" aria-label="Loading agents">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`${styles.agentCard} skeleton`} style={{ minHeight: 168 }} />
            ))}
          </div>
        ) : null}

        {!loading && unavailable ? (
          <PremiumEmptyState
            variant="generic"
            title="Directory unavailable"
            description="We could not load agents right now. Try again later."
            primary={{ label: "Browse listings", href: "/" }}
          />
        ) : null}

        {!loading && !unavailable && agents.length === 0 ? (
          <PremiumEmptyState
            variant="generic"
            title="No agents yet"
            description="Approved agents with public profiles will appear here as they join the platform."
            primary={{ label: "Browse listings", href: "/" }}
          />
        ) : null}

        {!loading && !unavailable && agents.length > 0 ? (
          <div className={styles.grid}>
            {agents.map(({ profile, listingCount, regions }) => {
              const username = String(profile?.username || "").trim();
              const displayName = formatProfileDisplayLabel(profile);
              const regionLabels = (regions || [])
                .map((s) => getRegionLabel(normalizeRegionSlug(s)))
                .filter(Boolean);
              const profileHref = `/agents/${encodeURIComponent(username)}`;

              return (
                <article key={profile.id} className={styles.agentCard}>
                  <div className={styles.agentCardTop}>
                    <div>
                      <h2 className={styles.agentName}>{displayName}</h2>
                      {username ? <p className={styles.agentUsername}>@{username}</p> : null}
                    </div>
                    <RoleBadge roleKey={DASHBOARD_ROLE.agent} />
                  </div>
                  <dl className={styles.agentMeta}>
                    <div>
                      <dt>Active listings</dt>
                      <dd>{listingCount}</dd>
                    </div>
                    {regionLabels.length > 0 ? (
                      <div>
                        <dt>Regions</dt>
                        <dd>{regionLabels.slice(0, 3).join(", ")}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <Link className={styles.viewProfileBtn} href={profileHref}>
                    View Profile
                  </Link>
                </article>
              );
            })}
          </div>
        ) : null}
      </main>
    </div>
  );
}
