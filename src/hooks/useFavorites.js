import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "favorites";

function normalizeIds(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => Number(x))
    .filter((n) => !Number.isNaN(n));
}

export default function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setFavorites(normalizeIds(parsed));
        }
      } catch {
        /* ignore */
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  const toggleFavorite = useCallback((id) => {
    const n = Number(id);
    if (Number.isNaN(n)) return;
    setFavorites((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }, []);

  const removeFavorite = useCallback((id) => {
    const n = Number(id);
    if (Number.isNaN(n)) return;
    setFavorites((prev) => prev.filter((x) => x !== n));
  }, []);

  const isFavorite = useCallback(
    (id) => {
      const n = Number(id);
      return favorites.includes(n);
    },
    [favorites]
  );

  return { favorites, toggleFavorite, removeFavorite, isFavorite, hydrated };
}
