import { useEffect, useState } from "react";
import Link from "next/link";
import useFavorites from "../hooks/useFavorites";
import SiteNav from "../components/SiteNav";
import ListingCard from "../components/ListingCard";
import { fetchApprovedListingsWithImages } from "../lib/listingQueries";
import styles from "../styles/Favorites.module.css";

export default function FavoritesPage() {
  const { favorites, removeFavorite } = useFavorites();
  const [listingsData, setListingsData] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await fetchApprovedListingsWithImages();
      if (!cancelled) setListingsData(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const favoriteListings = listingsData.filter((l) => favorites.includes(l.id));

  return (
    <div className={styles.page}>
      <SiteNav active="favorites" />

      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h1>Saved Listings</h1>
          <p>{favoriteListings.length} saved properties</p>
        </div>

        {favoriteListings.length === 0 ? (
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
                  aria-label={`Remove ${listing.title} from favorites`}
                >
                  Remove
                </button>
                <div className={styles.cardSlot}>
                  <ListingCard listing={listing} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
