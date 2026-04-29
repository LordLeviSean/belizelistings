import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAuth from "./useAuth";
import { addFavorite, getUserFavorites, removeFavorite } from "../lib/favorites";
import { useToast } from "../components/ui/ToastProvider";
import { supabase } from "../lib/supabaseClient";
import { traceAction } from "../lib/trace";

export default function useFavorites() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [favorites, setFavorites] = useState([]);
  const [favoriteIdsState, setFavoriteIdsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState([]);
  const busySetRef = useRef(new Set());

  const normalizeId = useCallback((id) => String(id ?? ""), []);

  const loadFavorites = useCallback(async () => {
    if (!user?.id) {
      setFavoriteIdsState([]);
      setFavorites([]);
      return;
    }

    const [{ data: idsData, error: idsError }, { data: listingData }] = await Promise.all([
      supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", user.id),
      getUserFavorites(),
    ]);

    if (!idsError && idsData) {
      const ids = idsData.map((f) => normalizeId(f.listing_id)).filter(Boolean);
      setFavoriteIdsState(ids);
    } else {
      setFavoriteIdsState([]);
    }

    setFavorites(listingData || []);
  }, [user?.id, normalizeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        if (!cancelled) {
          setFavorites([]);
          setFavoriteIdsState([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      if (!cancelled) {
        await loadFavorites();
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, loadFavorites]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`favorites-sync-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${user.id}` },
        () => {
          loadFavorites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadFavorites]);

  const favoriteIds = useMemo(
    () => favoriteIdsState,
    [favoriteIdsState]
  );

  const isBusy = useCallback((id) => busyIds.includes(normalizeId(id)), [busyIds, normalizeId]);

  const toggleFavorite = useCallback(
    async (listingId) => {
      const normalizedId = normalizeId(listingId);
      if (!user?.id || !normalizedId || isBusy(normalizedId) || busySetRef.current.has(normalizedId)) return;
      busySetRef.current.add(normalizedId);

      const exists = favoriteIds.includes(normalizedId);
      setFavoriteIdsState((prev) =>
        exists ? prev.filter((fav) => fav !== normalizedId) : [...prev, normalizedId]
      );
      setBusyIds((prev) => [...prev, normalizedId]);
      traceAction({
        type: "favorite_toggle",
        payload: { listingId: normalizedId, existsBefore: exists },
      });

      try {
        if (exists) {
          const { error } = await removeFavorite(normalizedId);
          if (!error) {
            setFavorites((prev) => prev.filter((listing) => normalizeId(listing.id) !== normalizedId));
            traceAction({
              type: "favorite_remove",
              payload: { listingId: normalizedId },
              result: { ok: true },
            });
            showToast({ type: "info", message: "Removed from favorites" });
          } else {
            setFavoriteIdsState((prev) => [...prev, normalizedId]);
            traceAction({
              type: "favorite_remove",
              payload: { listingId: normalizedId },
              result: { ok: false, error: error.message },
            });
            showToast({ type: "error", message: "Unable to update favorites" });
          }
        } else {
          try {
            const { error } = await addFavorite(normalizedId);
            if (!error) {
              await loadFavorites();
              traceAction({
                type: "favorite_add",
                payload: { listingId: normalizedId },
                result: { ok: true },
              });
              showToast({ type: "success", message: "Added to favorites" });
            } else {
              setFavoriteIdsState((prev) => prev.filter((fav) => fav !== normalizedId));
              traceAction({
                type: "favorite_add",
                payload: { listingId: normalizedId },
                result: { ok: false, error: error.message },
              });
              showToast({ type: "error", message: "Unable to update favorites" });
            }
          } catch (error) {
            setFavoriteIdsState((prev) => prev.filter((fav) => fav !== normalizedId));
            await loadFavorites();
            console.error("FAVORITE TOGGLE INSERT FAILED:", error);
            showToast({ type: "error", message: "Unable to update favorites" });
          }
        }
      } finally {
        setBusyIds((prev) => prev.filter((id) => id !== normalizedId));
        busySetRef.current.delete(normalizedId);
      }
    },
    [user?.id, favoriteIds, isBusy, showToast, normalizeId, loadFavorites]
  );

  const removeFromFavorites = useCallback(
    async (listingId, { silent = false } = {}) => {
      const normalizedId = normalizeId(listingId);
      if (!user?.id || !normalizedId || isBusy(normalizedId)) return;
      setFavoriteIdsState((prev) => prev.filter((fav) => fav !== normalizedId));
      setFavorites((prev) => prev.filter((listing) => normalizeId(listing.id) !== normalizedId));
      setBusyIds((prev) => [...prev, normalizedId]);
      const { error } = await removeFavorite(normalizedId, { silent });
      if (error) {
        setFavoriteIdsState((prev) => [...prev, normalizedId]);
        if (!silent) {
          showToast({ type: "error", message: "Unable to remove favorite" });
        }
      } else {
        await loadFavorites();
        if (!silent) {
          showToast({ type: "info", message: "Removed from favorites" });
        }
      }
      setBusyIds((prev) => prev.filter((id) => id !== normalizedId));
    },
    [user?.id, isBusy, showToast, normalizeId, loadFavorites]
  );

  const clearAllFavorites = useCallback(
    async ({ silent = false } = {}) => {
      if (!user?.id) return { error: new Error("Not authenticated") };
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id);

      if (!error) {
        setFavorites([]);
        setFavoriteIdsState([]);
        if (!silent) {
          showToast({ type: "info", message: "All favorites cleared" });
        }
      } else if (!silent) {
        showToast({ type: "error", message: "Failed to clear favorites" });
      }

      return { error };
    },
    [user?.id, showToast]
  );

  const isFavorite = useCallback(
    (id) => {
      return favoriteIds.includes(normalizeId(id));
    },
    [favoriteIds, normalizeId]
  );

  return {
    favorites,
    favoriteIds,
    toggleFavorite,
    removeFavorite: removeFromFavorites,
    clearAllFavorites,
    isFavorite,
    isBusy,
    loading,
    isAuthenticated: Boolean(user?.id),
  };
}
