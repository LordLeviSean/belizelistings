import { useEffect, useState } from "react";
import Link from "next/link";
import useFavorites from "../hooks/useFavorites";
import SiteNav from "../components/SiteNav";
import ListingCard from "../components/ListingCard";
import styles from "../styles/Favorites.module.css";

export default function FavoritesPage() {
  const { favorites, removeFavorite, isBusy, loading } = useFavorites();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const favoriteListings = favorites;

  return (
    <div className={styles.page}>
      <SiteNav active="favorites" />

      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h1>Saved Listings</h1>
          <p>{favoriteListings.length} saved properties</p>
        </div>

        {!ready || loading ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>Loading saved listings...</h2>
          </div>
        ) : favoriteListings.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>Nothing saved yet</h2>
            <p className={styles.emptyText}>Tap the heart icon to save listings</p>
            <Link href="/" className={styles.cta}>
              Browse Listings
            </Link>
          </div>
        ) : (
          <div className={styles.list}>
            {favoriteListings.map((listing) => (
              <div key={listing.id} className={styles.cardRow}>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeFavorite(listing.id)}
                  disabled={isBusy(listing.id)}
                  aria-label={`Remove ${listing.title} from favorites`}
                >
                  {isBusy(listing.id) ? "Removing..." : "Remove"}
                </button>
                <div className={styles.cardSlot}>
                  <ListingCard
                    listing={listing}
                    showFavoriteButton
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
    </div>
  );
}
