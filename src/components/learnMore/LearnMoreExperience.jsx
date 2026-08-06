import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { MapPin } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import BackButton from "@/components/BackButton";
import useUserRole from "@/hooks/useUserRole";
import {
  getPlatformUpdatesArchive,
  getPlatformUpdateBySlug,
  getDefaultPlatformUpdate,
} from "@/constants/platformUpdates";
import {
  buildLearnMoreUpdateHref,
  parseLearnMoreUpdateSlug,
  resolveUpdatePrimaryCtaHref,
  resolveUpdateSecondaryCtaHref,
} from "@/lib/platformUpdatesRouting";
import styles from "@/styles/LearnMore.module.css";

function formatReleaseDate(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Belize",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

function UpdateDetailPanel({ update, role, authenticated }) {
  if (!update) return null;

  const primaryHref = resolveUpdatePrimaryCtaHref(update, { role, authenticated });
  const secondaryHref = resolveUpdateSecondaryCtaHref(update);

  return (
    <article className={styles.detailPanel} aria-labelledby="update-detail-title">
      <div className={styles.detailGlow} aria-hidden />
      <header className={styles.detailHeader}>
        <p className={styles.detailEyebrow}>Platform update</p>
        <h2 id="update-detail-title" className={styles.detailTitle}>
          {update.title}
          {update.version ? (
            <span className={styles.detailVersion}> {update.version}</span>
          ) : null}
        </h2>
        <div className={styles.detailMeta}>
          <span className={styles.statusPill}>{update.statusLabel}</span>
          {update.releaseDate ? (
            <time className={styles.detailDate} dateTime={update.releaseDate}>
              {formatReleaseDate(update.releaseDate)}
            </time>
          ) : null}
        </div>
        <p className={styles.detailSummary}>{update.summary}</p>
      </header>

      <div className={styles.detailBody}>
        {update.body.split("\n\n").map((paragraph) => (
          <p key={paragraph.slice(0, 24)} className={styles.detailParagraph}>
            {paragraph}
          </p>
        ))}
      </div>

      {update.highlights?.length ? (
        <section className={styles.highlightSection} aria-label="Feature highlights">
          <h3 className={styles.sectionLabel}>Highlights</h3>
          <ul className={styles.highlightList}>
            {update.highlights.map((item) => (
              <li key={item} className={styles.highlightItem}>
                <MapPin size={13} strokeWidth={2.2} aria-hidden className={styles.highlightIcon} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {update.sections?.map((section) => (
        <section key={section.title} className={styles.infoCard} aria-labelledby={`section-${section.title}`}>
          <h3 id={`section-${section.title}`} className={styles.infoCardTitle}>
            {section.title}
          </h3>
          <ul className={styles.infoCardList}>
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <div className={styles.ctaRow}>
        <Link href={primaryHref} className={styles.primaryBtn}>
          {update.primaryCta?.label || "Get started"}
        </Link>
        <Link href={secondaryHref} className={styles.secondaryBtn}>
          {update.secondaryCta?.label || "Explore the Map"}
        </Link>
      </div>
    </article>
  );
}

export default function LearnMoreExperience() {
  const router = useRouter();
  const { user, role } = useUserRole();
  const authenticated = Boolean(user?.id);
  const archive = useMemo(() => getPlatformUpdatesArchive(), []);

  const readSlugFromLocation = useCallback(() => {
    if (typeof window === "undefined") return null;
    return parseLearnMoreUpdateSlug({
      hash: window.location.hash,
      update: router.query.update,
    });
  }, [router.query.update]);

  const [selectedSlug, setSelectedSlug] = useState(() => {
    const fromQuery = parseLearnMoreUpdateSlug({ update: router.query.update });
    return fromQuery || getDefaultPlatformUpdate()?.slug || archive[0]?.slug || "";
  });

  useEffect(() => {
    const slug = readSlugFromLocation();
    if (slug && getPlatformUpdateBySlug(slug)) {
      setSelectedSlug(slug);
      return;
    }
    if (!slug) {
      const fallback = getDefaultPlatformUpdate()?.slug || archive[0]?.slug;
      if (fallback) setSelectedSlug(fallback);
    }
  }, [router.asPath, router.query.update, readSlugFromLocation, archive]);

  const selectedUpdate = useMemo(
    () => getPlatformUpdateBySlug(selectedSlug) || getDefaultPlatformUpdate(),
    [selectedSlug]
  );

  const selectUpdate = useCallback(
    (slug) => {
      const next = getPlatformUpdateBySlug(slug);
      if (!next) return;
      setSelectedSlug(next.slug);
      const href = buildLearnMoreUpdateHref(next.slug);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", href);
      }
    },
    []
  );

  return (
    <div className={styles.page}>
      <div className={styles.depthLayer} aria-hidden />
      <div className={styles.causticLayer} aria-hidden />

      <SiteNav active="browse" />

      <div className={styles.wrapper}>
        <div className={styles.mobileToolbar}>
          <BackButton label="Back" className={styles.mobileBackButton} ariaLabel="Back to previous page" />
          <div className={styles.mobileToolbarCopy}>
            <p className={styles.mobileToolbarEyebrow}>Release notes</p>
            <p className={styles.mobileToolbarTitle}>Platform Updates</p>
          </div>
        </div>

        <BackButton label="Back" className={`${styles.backButton} ${styles.backButtonDesktop}`} />

        <header className={styles.intro}>
          <p className={styles.introEyebrow}>BelizeListings Release Notes</p>
          <h1 className={styles.introTitle}>Platform Updates</h1>
          <p className={styles.introLead}>
            The permanent archive of BelizeListings milestones—geography, communication, performance,
            and everything that follows. Timed homepage announcements retire here when their window
            closes.
          </p>
          <p className={styles.introLeadMobile}>
            Milestones, releases, and the permanent archive of what shipped on BelizeListings.
          </p>
        </header>

        <div className={styles.layout}>
          <nav className={styles.archiveRail} aria-label="Update archive">
            <p className={styles.archiveLabel}>Release timeline</p>

            <div className={styles.archiveMobileScroll} role="tablist" aria-label="Select an update">
              {archive.map((entry) => {
                const isActive = entry.slug === selectedUpdate?.slug;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.archiveItem} ${isActive ? styles.archiveItemActive : ""}`.trim()}
                    onClick={() => selectUpdate(entry.slug)}
                  >
                    <span className={styles.archiveItemVersion}>{entry.version}</span>
                    <span className={styles.archiveItemTitle}>{entry.archiveLabel}</span>
                    <span className={styles.archiveItemDescriptor}>{entry.archiveDescriptor}</span>
                    <span className={styles.archiveItemStatus}>{entry.statusLabel}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className={styles.detailColumn}>
            <UpdateDetailPanel
              update={selectedUpdate}
              role={role}
              authenticated={authenticated}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
