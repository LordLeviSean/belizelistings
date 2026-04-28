import { useCallback, useEffect, useMemo, useState } from "react";
import useAuth from "./useAuth";
import { addFavorite, getUserFavorites, removeFavorite } from "../lib/favorites";

export default function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        if (!cancelled) {
          setFavorites([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const { data } = await getUserFavorites();
      if (!cancelled) {
        setFavorites(data || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const favoriteIds = useMemo(() => favorites.map((listing) => listing.id), [favorites]);

  const isBusy = useCallback((id) => busyIds.includes(id), [busyIds]);

  const toggleFavorite = useCallback(
    async (listingId) => {
      if (!user?.id || !listingId || isBusy(listingId)) return;
      setBusyIds((prev) => [...prev, listingId]);
      const exists = favoriteIds.includes(listingId);
      if (exists) {
        const { error } = await removeFavorite(listingId);
        if (!error) {
          setFavorites((prev) => prev.filter((listing) => listing.id !== listingId));
        }
      } else {
        const { error } = await addFavorite(listingId);
        if (!error) {
          const { data } = await getUserFavorites();
          setFavorites(data || []);
        }
      }
      setBusyIds((prev) => prev.filter((id) => id !== listingId));
    },
    [user?.id, favoriteIds, isBusy]
  );

  const removeFromFavorites = useCallback(
    async (listingId) => {
      if (!user?.id || !listingId || isBusy(listingId)) return;
      setBusyIds((prev) => [...prev, listingId]);
      const { error } = await removeFavorite(listingId);
      if (!error) {
        setFavorites((prev) => prev.filter((listing) => listing.id !== listingId));
      }
      setBusyIds((prev) => prev.filter((id) => id !== listingId));
    },
    [user?.id, isBusy]
  );

  const isFavorite = useCallback(
    (id) => {
      return favoriteIds.includes(id);
    },
    [favoriteIds]
  );

  return {
    favorites,
    favoriteIds,
    toggleFavorite,
    removeFavorite: removeFromFavorites,
    isFavorite,
    isBusy,
    loading,
    isAuthenticated: Boolean(user?.id),
  };
}
