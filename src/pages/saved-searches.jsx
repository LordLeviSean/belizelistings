import { useEffect } from "react";
import { useRouter } from "next/router";
import SiteNav from "../components/SiteNav";
import useSavedSearches from "../hooks/useSavedSearches";
import { filtersToHomeQuery, formatFiltersSummary } from "../utils/savedSearchUtils";
import { clearNavAlertBadge } from "../utils/navBadge";
import styles from "../styles/SavedSearches.module.css";

function formatDate(ts) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export default function SavedSearchesPage() {
  const router = useRouter();
  const { savedSearches, deleteSearch } = useSavedSearches();

  useEffect(() => {
    clearNavAlertBadge();
  }, []);

  const handleView = (filters) => {
    router.push({ pathname: "/", query: filtersToHomeQuery(filters) });
  };

  return (
    <div className={styles.page}>
      <SiteNav active="saved" />

      <div className={styles.wrapper}>
        <h1 className={styles.title}>Saved Searches</h1>
        <p className={styles.subtitle}>
          View or delete searches you have saved. New listing matches also show a badge on this nav link.
        </p>

        {savedSearches.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>You haven&apos;t saved any searches yet</p>
            <p className={styles.emptyHint}>
              On a district page, tap <strong>Save Search</strong> to store your filters and get notified when
              new listings match.
            </p>
          </div>
        ) : (
          <ul className={styles.list}>
            {savedSearches.map((s) => (
              <li key={s.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <h2 className={styles.label}>{s.label}</h2>
                  <p className={styles.summary}>{formatFiltersSummary(s.filters)}</p>
                  <p className={styles.meta}>Saved {formatDate(s.createdAt)}</p>
                </div>
                <div className={styles.actions}>
                  <button type="button" className={styles.viewBtn} onClick={() => handleView(s.filters)}>
                    View
                  </button>
                  <button type="button" className={styles.deleteBtn} onClick={() => deleteSearch(s.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
