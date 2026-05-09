import { useEffect, useState } from "react";
import Link from "next/link";
import useFavorites from "../hooks/useFavorites";
import SiteNav from "../components/SiteNav";
import BackButton from "../components/BackButton";
import HomePropertyCard from "../components/HomePropertyCard";
import { useToast } from "../components/ui/ToastProvider";
import styles from "../styles/Favorites.module.css";

export default function FavoritesPage() {
  const { favorites, removeFavorite, clearAllFavorites, isBusy, loading } = useFavorites();
  const { showToast } = useToast();
  const [ready, setReady] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [carouselIndexById, setCarouselIndexById] = useState({});
  const [removingIds, setRemovingIds] = useState([]);

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
    if (isBusy(listingId) || removingIds.includes(String(listingId))) return;
    setRemovingIds((prev) => [...prev, String(listingId)]);
    setTimeout(async () => {
      await removeFavorite(listingId);
      setRemovingIds((prev) => prev.filter((id) => id !== String(listingId)));
    }, 220);
  };

  return (
    <div className={styles.page}>
      <SiteNav active="favorites" />

      <div className={styles.wrapper}>
        <BackButton label="Back" className={styles.backButton} />
        <div className={styles.header}>
          <div>
            <h1>Saved Listings</h1>
            <p>{favoriteListings.length} saved listings</p>
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
          <div className={styles.listingsGrid} aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className={`${styles.gridItem} ${styles.cardSkeleton} skeleton`} />
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
          <div className={styles.listingsGrid}>
            {favoriteListings.map((listing) => (
              <div
                key={listing.id}
                className={`${styles.gridItem} ${
                  removingIds.includes(String(listing.id)) ? styles.gridItemRemoving : ""
                }`}
              >
                <HomePropertyCard
                  listing={listing}
                  showFavoriteButton
                  isFavorited
                  favoriteSurface="saved"
                  favoriteBusy={isBusy(listing.id)}
                  onFavoriteClick={handleRemove}
                  imageSizes="(max-width: 760px) 100vw, (max-width: 980px) 50vw, 33vw"
                  carouselIndex={Number(carouselIndexById[listing.id] || 0)}
                  onCarouselIndexChange={(nextIndex) =>
                    setCarouselIndexById((prev) => ({ ...prev, [listing.id]: nextIndex }))
                  }
                />
              </div>
            ))}
          </div>
        )}

        {ready && !loading && favoriteListings.length > 0 ? (
          <section className={styles.inventoryEndCap} aria-label="Inventory continuation">
            <p>More verified inventory arriving soon.</p>
          </section>
        ) : null}
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
