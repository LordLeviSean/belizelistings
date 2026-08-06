import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import SiteNav from "@/components/SiteNav";
import RoleBadge from "@/components/dashboard/RoleBadge";
import ListingCard from "@/components/ListingCard";
import useFavorites from "@/hooks/useFavorites";
import { useFavoriteSignupPrompt } from "@/components/FavoriteSignupPromptProvider";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import { DASHBOARD_ROLE } from "@/constants/dashboardRoles";
import { supabase } from "@/lib/supabaseClient";
import { fetchAgentPublicProfile, deriveAgentProfileRegions } from "@/lib/agentPublicProfile";
import { buildFeaturedBrowseListingCardProps } from "@/lib/listingCardBrowse";
import { formatProfileDisplayLabel } from "@/lib/profileDisplayName";
import { getRegionLabel, normalizeRegionSlug } from "@/constants/geographyLayer";
import styles from "@/styles/AgentPublicProfile.module.css";

export default function AgentPublicProfilePage() {
  const router = useRouter();
  const username = useMemo(() => {
    const raw = router.query.username;
    return String(Array.isArray(raw) ? raw[0] : raw || "").trim();
  }, [router.query.username]);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!router.isReady || !username) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const result = await fetchAgentPublicProfile(supabase, username);
      if (cancelled) return;
      setProfile(result.profile);
      setListings(result.listings || []);
      setUnavailable(Boolean(result.unavailable));
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, username]);

  const displayName = formatProfileDisplayLabel(profile || { username });
  const joinedLabel = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  const regions = useMemo(() => {
    const slugs = deriveAgentProfileRegions(listings);
    return slugs.map((s) => getRegionLabel(normalizeRegionSlug(s))).filter(Boolean);
  }, [listings]);

  const { isFavorite, isBusy, toggleFavorite, isAuthenticated } = useFavorites();
  const openFavoriteSignupPrompt = useFavoriteSignupPrompt();
  const [carouselIndexById, setCarouselIndexById] = useState({});

  const handleFavoriteClick = (listingId) => {
    if (!isAuthenticated) {
      openFavoriteSignupPrompt();
      return;
    }
    void toggleFavorite(listingId);
  };

  return (
    <div className={styles.page}>
      <SiteNav active="agents" />
      <main className={styles.main}>
        {loading ? (
          <div className={`${styles.loading} skeleton`} aria-busy="true" aria-label="Loading agent profile" />
        ) : null}

        {!loading && !profile ? (
          <PremiumEmptyState
            variant="generic"
            title={unavailable ? "Profile unavailable" : "Agent not found"}
            description={
              unavailable
                ? "We could not load this profile right now. Try again later."
                : "This agent profile is not public or does not exist."
            }
            primary={{ label: "Browse listings", href: "/" }}
          />
        ) : null}

        {!loading && profile ? (
          <>
            <header className={styles.hero}>
              <p className={styles.kicker}>BelizeListings Agent</p>
              <div className={styles.titleRow}>
                <h1>{displayName}</h1>
                <RoleBadge roleKey={DASHBOARD_ROLE.agent} />
              </div>
              {username ? (
                <p className={styles.username}>@{username}</p>
              ) : null}
              <dl className={styles.meta}>
                {joinedLabel ? (
                  <div>
                    <dt style={{ display: "inline" }}>Joined </dt>
                    <dd style={{ display: "inline", margin: 0 }}>{joinedLabel}</dd>
                  </div>
                ) : null}
                <div>
                  <dt style={{ display: "inline" }}>Active listings </dt>
                  <dd style={{ display: "inline", margin: 0 }}>{listings.length}</dd>
                </div>
                {regions.length > 0 ? (
                  <div>
                    <dt style={{ display: "inline" }}>Regions </dt>
                    <dd style={{ display: "inline", margin: 0 }}>{regions.join(", ")}</dd>
                  </div>
                ) : null}
              </dl>
              {profile?.email ? (
                <p className={styles.contactLine}>
                  <a href={`mailto:${encodeURIComponent(String(profile.email).trim())}`}>
                    Contact {displayName}
                  </a>
                  {listings.length > 0 ? (
                    <span className={styles.contactHint}>
                      {" "}
                      · or open a listing below to schedule a viewing
                    </span>
                  ) : null}
                </p>
              ) : listings.length > 0 ? (
                <p className={styles.contactLine}>
                  Open a listing below to contact this agent — no login required.
                </p>
              ) : null}
            </header>

            {listings.length === 0 ? (
              <div className={styles.empty}>
                <p style={{ margin: 0 }}>No public listings yet. Check back soon.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {listings.map((listing, index) => {
                  const cardProps = buildFeaturedBrowseListingCardProps(listing, index, {
                    isFavorite,
                    isBusy,
                    onFavoriteClick: handleFavoriteClick,
                    carouselIndexById,
                    onCarouselIndexChange: (listingId, nextIndex) =>
                      setCarouselIndexById((prev) => ({ ...prev, [listingId]: nextIndex })),
                  });
                  if (!cardProps) return null;
                  return (
                    <div key={listing.id} className={styles.gridItem}>
                      <ListingCard {...cardProps} />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
