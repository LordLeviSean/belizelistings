import { useEffect, useState } from "react";
import Link from "next/link";
import useFavorites from "../hooks/useFavorites";
import SiteNav from "../components/SiteNav";
import BackButton from "../components/BackButton";
import Breadcrumbs from "../components/Breadcrumbs";
import ListingCard from "../components/ListingCard";
import { useToast } from "../components/ui/ToastProvider";
import styles from "../styles/Favorites.module.css";

export default function FavoritesPage() {
  const { favorites, removeFavorite, clearAllFavorites, isBusy, loading } = useFavorites();
  const { showToast } = useToast();
  const [ready, setReady] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [removingIds, setRemovingIds] = useState([]);
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const favoriteListings = favorites;

  const handleClearAll = async () => {
    if (!favoriteListings.length || clearing) return;
    setClearing(true);

    try {
      const { error } = await clearAllFavorites({ silent: true });
      if (error) throw error;
      showToast({ type: "favorite_clear", message: "All favorites cleared" });
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: "Failed to clear favorites" });
    } finally {
      setClearing(false);
    }
  };
  const handleRemove = async (listingId) => {
    if (isBusy(listingId)) return;
    setRemovingIds((prev) => [...prev, String(listingId)]);
    await removeFavorite(listingId);
    setTimeout(() => {
      setRemovingIds((prev) => prev.filter((id) => id !== String(listingId)));
    }, 240);
  };

  return (
    <div className={styles.page}>
      <SiteNav active="favorites" />

      <div className={styles.wrapper}>
        <Breadcrumbs />
        <BackButton label="Back to Browse" />
        <div className={styles.header}>
          <div>
            <h1>Saved Listings</h1>
            <p>{favoriteListings.length} saved properties</p>
          </div>
          {!!favoriteListings.length && (
            <button
              type="button"
              className={styles.clearAllBtn}
              onClick={() => setShowClearModal(true)}
              disabled={clearing}
            >
              {clearing ? "Clearing..." : "Clear All"}
            </button>
          )}
        </div>

        {!ready || loading ? (
          <div className={styles.list}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={`${styles.cardRow} skeleton`} style={{ height: 112 }} />
            ))}
          </div>
        ) : favoriteListings.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>You haven&apos;t saved any listings yet</h2>
            <p className={styles.emptyText}>Save properties to view them here</p>
            <Link href="/" className={styles.cta}>
              Browse Listings
            </Link>
          </div>
        ) : (
          <div className={styles.list}>
            {favoriteListings.map((listing) => (
              <div key={listing.id} className={`${styles.cardRow} ${removingIds.includes(String(listing.id)) ? styles.cardRowRemoving : ""}`}>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => handleRemove(listing.id)}
                  disabled={isBusy(listing.id)}
                  aria-label={`Remove ${listing.title} from favorites`}
                >
                  {isBusy(listing.id) ? "Removing..." : "Remove"}
                </button>
                <span className={styles.savedBadge}>✓ SAVED</span>
                <div className={styles.cardSlot}>
                  <ListingCard
                    listing={listing}
                    showFavoriteButton={false}
                    isFavorited
                    favoriteBusy={isBusy(listing.id)}
                    onToggleFavorite={removeFavorite}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showClearModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3>Clear all saved listings?</h3>
            <p>This action cannot be undone.</p>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                disabled={clearing}
                onClick={() => setShowClearModal(false)}
              >
                Cancel
              </button>

              <button
                className={styles.dangerButton}
                disabled={clearing}
                onClick={async () => {
                  await handleClearAll();
                  setShowClearModal(false);
                }}
              >
                {clearing ? "Clearing..." : "Clear All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
