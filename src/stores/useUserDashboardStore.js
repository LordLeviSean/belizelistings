import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import { fetchUserOwnedListingsForDashboard } from "@/lib/listingQueries";
import {
  applyListingMetricsToRows,
  fetchOwnerListingMetricsMap,
} from "@/lib/listingOwnerMetrics";
import { deriveUserDashboardListingCounts } from "@/lib/userDashboardListingTruth";
import { isTransientNetworkError } from "@/lib/supabaseCompat";
import { logDashboardMetricFailureOnce } from "@/lib/dashboardMetricsTelemetry";
import { BL_ENABLE_INQUIRIES } from "@/lib/featureFlags";
import { BL_USER_DASHBOARD_METRICS_EVENT } from "@/lib/userDashboardMetricsBus";
import { isMissingTableError, isTerminalDashboardCountError } from "@/lib/supabaseCompat";
import { resolveUserDashboardListingCap } from "@/constants/dashboardUserConfig";

const METRICS_DEBOUNCE_MS = 480;

/** Bit flags: 1 = favorites realtime, 2 = listing_inquiries realtime */
const RT_FAVORITES = 1;
const RT_INQUIRIES = 2;

const SKIP_USER_DASHBOARD_FAVORITES_COUNT =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_BL_SKIP_USER_DASHBOARD_FAVORITES_COUNT === "1";

function initialRealtimeMask() {
  let mask = 0;
  if (!SKIP_USER_DASHBOARD_FAVORITES_COUNT) mask |= RT_FAVORITES;
  if (BL_ENABLE_INQUIRIES) mask |= RT_INQUIRIES;
  return mask;
}

/** `Math.max(0, cap - active)` — single derivation for listing slots remaining (active = published only). */
function remainingFrom(cap, active) {
  const c = Number(cap) || 0;
  const a = Number(active) || 0;
  return Math.max(0, c - a);
}

function applyListingMetricsFromRows(set, get, rows) {
  const counts = deriveUserDashboardListingCounts(rows);
  const listingCap = get().listingCap;
  return patchIfChanged(set, get, {
    activeListings: counts.activeListings,
    pendingListings: counts.pendingListings,
    archivedListings: counts.archivedListings,
    draftListings: counts.draftListings,
    rejectedListings: counts.rejectedListings,
    remainingListings: remainingFrom(listingCap, counts.activeListings),
  });
}

/** Skip Zustand writes when every key is unchanged (reduces idle re-renders). */
function patchIfChanged(set, get, patch) {
  const prev = get();
  const keys = Object.keys(patch);
  if (keys.length === 0) return false;
  for (const k of keys) {
    if (prev[k] !== patch[k]) {
      set(patch);
      return true;
    }
  }
  return false;
}

function myListingsRowsSignature(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  return rows
    .map(
      (r) =>
        `${r?.id ?? ""}:${r?.updated_at ?? ""}:${r?.status ?? ""}:${r?.lifecycle_status ?? ""}:${r?.moderation_status ?? ""}`
    )
    .join("|");
}

function sessionIsLive(get, userId) {
  return Boolean(
    userId &&
      get()._sessionUserId === String(userId) &&
      realtimeChannel &&
      busHandler
  );
}

let loadGen = 0;
let metricsInflight = false;
let pendingCoalescedMetrics = false;
let listingsInflight = false;
let pendingCoalescedListings = false;
let realtimeChannel = null;
let debounceTimer = null;
let dirtyListingsRealtime = false;
let skipFav = SKIP_USER_DASHBOARD_FAVORITES_COUNT;
let skipInq = !BL_ENABLE_INQUIRIES;
let realtimeMask = initialRealtimeMask();
let busHandler = null;

/** @type {{ userId: string, row: object } | null} */
let stagedPostCreateMyListing = null;
/** @type {number} transient read retries per session (not schema/RLS) */
let listingsTransientRetries = 0;
const LISTINGS_TRANSIENT_RETRY_MAX = 2;

function clearDebounceTimer() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function detachRealtimeInternal() {
  if (realtimeChannel) {
    void supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

function removeBusListenerInternal() {
  if (typeof window === "undefined" || !busHandler) return;
  window.removeEventListener(BL_USER_DASHBOARD_METRICS_EVENT, busHandler);
  busHandler = null;
}

function teardownLive() {
  clearDebounceTimer();
  dirtyListingsRealtime = false;
  detachRealtimeInternal();
  removeBusListenerInternal();
}

const useUserDashboardStore = create((set, get) => ({
  activeListings: 0,
  pendingListings: 0,
  archivedListings: 0,
  draftListings: 0,
  rejectedListings: 0,
  favoritesCount: 0,
  inquiriesCount: 0,
  listingCap: resolveUserDashboardListingCap(null),
  remainingListings: 0,
  myListingsRows: [],
  metricsLoading: false,
  listingsLoading: false,
  /** False until the first `loadMyListings` for the current session completes (avoids empty-state flash). */
  myListingsInitialFetchDone: false,
  listingsErrorMessage: null,
  /** True when PostgREST shape/RLS will not recover without a contract fix — blocks idle refetch loops. */
  listingsQueryTerminal: false,
  refreshStatus: "idle",
  favoritesUnavailable: SKIP_USER_DASHBOARD_FAVORITES_COUNT,
  inquiriesUnavailable: !BL_ENABLE_INQUIRIES,
  realtimeMask: initialRealtimeMask(),
  _sessionUserId: null,

  setTier(tier) {
    const listingCap = resolveUserDashboardListingCap(tier);
    const activeListings = get().activeListings;
    const remainingListings = remainingFrom(listingCap, activeListings);
    patchIfChanged(set, get, { listingCap, remainingListings });
  },

  /**
   * After create/submit success, call before navigating to `/dashboard/user?tab=my-listings`
   * so the dashboard store can show the row on first paint (quiet background refresh follows).
   * @param {string} userId
   * @param {object} row listing row shaped like `loadMyListings` rows (incl. optional `listing_images`)
   */
  stagePostCreateMyListingRow(userId, row) {
    if (!userId || !row?.id) return;
    stagedPostCreateMyListing = { userId: String(userId), row };
  },

  /**
   * @param {string} userId
   * @param {string} role expected "user" (caller guards); stored for channel filters
   */
  init(userId, role) {
    if (!userId || role !== "user") return;

    let stagedRow = null;
    if (
      stagedPostCreateMyListing &&
      String(stagedPostCreateMyListing.userId) === String(userId)
    ) {
      stagedRow = stagedPostCreateMyListing.row;
      stagedPostCreateMyListing = null;
    }

    if (sessionIsLive(get, userId)) {
      if (stagedRow) {
        const prevSig = myListingsRowsSignature(get().myListingsRows);
        const nextRows = [stagedRow];
        if (prevSig !== myListingsRowsSignature(nextRows)) {
          patchIfChanged(set, get, { myListingsRows: nextRows });
        }
        void get().loadMyListings({ syncMetrics: false, quiet: true, force: true });
      }
      return;
    }

    teardownLive();
    loadGen += 1;
    metricsInflight = false;
    pendingCoalescedMetrics = false;
    listingsInflight = false;
    pendingCoalescedListings = false;
    listingsTransientRetries = 0;
    skipFav = SKIP_USER_DASHBOARD_FAVORITES_COUNT;
    skipInq = !BL_ENABLE_INQUIRIES;
    realtimeMask = initialRealtimeMask();
    const cap = get().listingCap;
    const initialRows = stagedRow ? [stagedRow] : [];
    const initialListingCounts = deriveUserDashboardListingCounts(initialRows);
    set({
      _sessionUserId: userId,
      activeListings: initialListingCounts.activeListings,
      pendingListings: initialListingCounts.pendingListings,
      archivedListings: initialListingCounts.archivedListings,
      draftListings: initialListingCounts.draftListings,
      rejectedListings: initialListingCounts.rejectedListings,
      favoritesCount: 0,
      inquiriesCount: 0,
      remainingListings: remainingFrom(cap, initialListingCounts.activeListings),
      myListingsRows: initialRows,
      favoritesUnavailable: SKIP_USER_DASHBOARD_FAVORITES_COUNT,
      inquiriesUnavailable: !BL_ENABLE_INQUIRIES,
      realtimeMask,
      listingsErrorMessage: null,
      listingsQueryTerminal: false,
      listingsLoading: !stagedRow,
      myListingsInitialFetchDone: false,
    });
    busHandler = (evt) => {
      const id = evt?.detail?.userId;
      if (!id || String(id) !== String(userId)) return;
      get().invalidate();
    };
    if (typeof window !== "undefined") {
      window.addEventListener(BL_USER_DASHBOARD_METRICS_EVENT, busHandler);
    }
    get().attachRealtime(userId);
    // Single calm init: one owner listings fetch; metrics derive active/pending from those rows.
    void get().loadMyListings({ syncMetrics: true, quiet: Boolean(stagedRow) });
  },

  destroy() {
    teardownLive();
    loadGen += 1;
    metricsInflight = false;
    pendingCoalescedMetrics = false;
    listingsInflight = false;
    pendingCoalescedListings = false;
    set({
      _sessionUserId: null,
      myListingsRows: [],
      activeListings: 0,
      pendingListings: 0,
      archivedListings: 0,
      draftListings: 0,
      rejectedListings: 0,
      favoritesCount: 0,
      inquiriesCount: 0,
      listingCap: resolveUserDashboardListingCap(null),
      remainingListings: 0,
      metricsLoading: false,
      listingsLoading: false,
      myListingsInitialFetchDone: false,
      listingsErrorMessage: null,
      listingsQueryTerminal: false,
      refreshStatus: "idle",
      favoritesUnavailable: SKIP_USER_DASHBOARD_FAVORITES_COUNT,
      inquiriesUnavailable: !BL_ENABLE_INQUIRIES,
      realtimeMask: initialRealtimeMask(),
    });
  },

  attachRealtime(userId) {
    detachRealtimeInternal();
    if (!userId) return;
    const mask = realtimeMask;
    let channel = supabase
      .channel(`user-dashboard-store-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings", filter: `user_id=eq.${userId}` },
        () => {
          dirtyListingsRealtime = true;
          get()._scheduleDebouncedRealtimeBatch();
        }
      );
    if (mask & RT_FAVORITES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${userId}` },
        () => {
          get()._scheduleDebouncedRealtimeBatch();
        }
      );
    }
    if (mask & RT_INQUIRIES) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listing_inquiries",
          filter: `sender_user_id=eq.${userId}`,
        },
        () => {
          get()._scheduleDebouncedRealtimeBatch();
        }
      );
    }
    channel.subscribe();
    realtimeChannel = channel;
  },

  detachRealtime() {
    detachRealtimeInternal();
  },

  _scheduleDebouncedRealtimeBatch() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!get()._sessionUserId) return;
      const runListings = dirtyListingsRealtime;
      dirtyListingsRealtime = false;
      if (runListings) {
        void get().loadMyListings({ syncMetrics: true, quiet: true });
      } else {
        void get().loadMetrics({ quiet: true });
      }
    }, METRICS_DEBOUNCE_MS);
  },

  _setRealtimeMask(next) {
    if (next === realtimeMask) return;
    realtimeMask = next;
    patchIfChanged(set, get, { realtimeMask: next });
    const uid = get()._sessionUserId;
    if (uid) get().attachRealtime(uid);
  },

  async loadMetrics(opts = {}) {
    const { quiet = false } = opts;
    const uid = get()._sessionUserId;
    if (!uid) return;

    if (metricsInflight) {
      pendingCoalescedMetrics = true;
      return;
    }
    metricsInflight = true;
    const genAtStart = loadGen;
    if (!quiet) {
      const patch = { metricsLoading: true, refreshStatus: "refreshing" };
      patchIfChanged(set, get, patch);
    }

    const favRequestShape = {
      resource: "favorites",
      operation: "select",
      countMode: "exact",
      head: true,
      select: "listing_id",
      filters: [{ column: "user_id", op: "eq", value: uid }],
    };
    const inqRequestShape = {
      resource: "listing_inquiries",
      operation: "select",
      countMode: "exact",
      head: true,
      filters: [{ column: "sender_user_id", op: "eq", value: uid }],
    };

    try {
      const favQuery = skipFav
        ? Promise.resolve({ count: 0, error: null, _skipped: true })
        : supabase
            .from("favorites")
            .select("listing_id", { count: "exact", head: true })
            .eq("user_id", uid);

      const inqQuery = skipInq
        ? Promise.resolve({ count: 0, error: null, _skipped: true })
        : supabase
            .from("listing_inquiries")
            .select("id", { count: "exact", head: true })
            .eq("sender_user_id", uid);

      const derivedCounts = deriveUserDashboardListingCounts(get().myListingsRows);
      const listingCountsPromise = Promise.resolve({
        active: derivedCounts.activeListings,
        pending: derivedCounts.pendingListings,
        error: null,
      });

      const [listingCounts, favRes, inqRes] = await Promise.all([
        listingCountsPromise,
        favQuery,
        inqQuery,
      ]);

      if (genAtStart !== loadGen || !get()._sessionUserId) return;

      const listingCap = get().listingCap;
      const active = Number(listingCounts?.active ?? 0);
      const pending = Number(listingCounts?.pending ?? 0);
      const rowCounts = deriveUserDashboardListingCounts(get().myListingsRows);
      const metricsPatch = {
        activeListings: active,
        pendingListings: pending,
        archivedListings: rowCounts.archivedListings,
        draftListings: rowCounts.draftListings,
        rejectedListings: rowCounts.rejectedListings,
        remainingListings: remainingFrom(listingCap, active),
      };

      if (!favRes?._skipped) {
        if (favRes.error) {
          logDashboardMetricFailureOnce("favorites count", favRes.error, favRequestShape);
          metricsPatch.favoritesCount = 0;
          if (isTerminalDashboardCountError(favRes.error) && !skipFav) {
            skipFav = true;
            const next = realtimeMask & ~RT_FAVORITES;
            get()._setRealtimeMask(next);
            metricsPatch.favoritesUnavailable = true;
          }
        } else {
          metricsPatch.favoritesCount = Number(favRes.count || 0);
        }
      }

      if (!inqRes?._skipped) {
        if (inqRes.error) {
          const terminal = isTerminalDashboardCountError(inqRes.error);
          const silentMissingTable = BL_ENABLE_INQUIRIES && terminal && isMissingTableError(inqRes.error);
          if (!silentMissingTable) {
            logDashboardMetricFailureOnce("inquiries count", inqRes.error, inqRequestShape);
          }
          metricsPatch.inquiriesCount = 0;
          if (terminal && !skipInq) {
            skipInq = true;
            const next = realtimeMask & ~RT_INQUIRIES;
            get()._setRealtimeMask(next);
            metricsPatch.inquiriesUnavailable = true;
          }
        } else {
          metricsPatch.inquiriesCount = Number(inqRes.count || 0);
        }
      }

      patchIfChanged(set, get, metricsPatch);
      if (!quiet) patchIfChanged(set, get, { refreshStatus: "idle" });
    } catch (e) {
      if (genAtStart === loadGen && get()._sessionUserId && !quiet) {
        patchIfChanged(set, get, { refreshStatus: "error" });
      }
    } finally {
      metricsInflight = false;
      const genStillCurrent = genAtStart === loadGen;
      const runCoalesced = pendingCoalescedMetrics && genStillCurrent && get()._sessionUserId;
      pendingCoalescedMetrics = false;
      if (genStillCurrent && get()._sessionUserId) {
        patchIfChanged(set, get, { metricsLoading: false });
      }
      if (runCoalesced) {
        queueMicrotask(() => {
          if (get()._sessionUserId) void get().loadMetrics({ quiet: true });
        });
      }
    }
  },

  async loadMyListings(opts = {}) {
    const { syncMetrics = true, quiet = false, force = false } = opts;
    const uid = get()._sessionUserId;
    if (!uid) return;
    if (!force && get().listingsQueryTerminal) return;

    if (listingsInflight) {
      pendingCoalescedListings = true;
      return;
    }
    listingsInflight = true;

    if (!quiet) {
      patchIfChanged(set, get, { listingsLoading: true, listingsErrorMessage: null });
    } else {
      patchIfChanged(set, get, { listingsErrorMessage: null });
    }
    const genAtStart = loadGen;
    try {
      const { data, error, terminal } = await fetchUserOwnedListingsForDashboard(supabase, uid);

      if (genAtStart !== loadGen || !get()._sessionUserId) return;

      if (error) {
        if (terminal) {
          listingsTransientRetries = LISTINGS_TRANSIENT_RETRY_MAX;
          patchIfChanged(set, get, {
            myListingsRows: [],
            listingsErrorMessage: "Could not load your listings.",
            listingsQueryTerminal: true,
          });
          return;
        }
        if (
          isTransientNetworkError(error) &&
          listingsTransientRetries < LISTINGS_TRANSIENT_RETRY_MAX
        ) {
          listingsTransientRetries += 1;
          listingsInflight = false;
          queueMicrotask(() => {
            if (get()._sessionUserId && genAtStart === loadGen) {
              void get().loadMyListings({ syncMetrics, quiet, force: true });
            }
          });
          return;
        }
        patchIfChanged(set, get, {
          myListingsRows: [],
          listingsErrorMessage: "Could not load your listings.",
        });
        return;
      }
      listingsTransientRetries = 0;
      let rows = data || [];
      const listingIds = rows.map((r) => r?.id).filter(Boolean);
      if (listingIds.length > 0) {
        const { map: metricsMap } = await fetchOwnerListingMetricsMap(supabase, listingIds, uid);
        rows = applyListingMetricsToRows(rows, metricsMap);
      }
      const rowPatch = { listingsErrorMessage: null, listingsQueryTerminal: false };
      const sigChanged =
        myListingsRowsSignature(get().myListingsRows) !== myListingsRowsSignature(rows);
      if (force || sigChanged) {
        rowPatch.myListingsRows = rows;
      }
      patchIfChanged(set, get, rowPatch);
      applyListingMetricsFromRows(set, get, rows);
      if (syncMetrics) void get().loadMetrics({ quiet: true });
    } catch (e) {
      if (genAtStart === loadGen && get()._sessionUserId) {
        patchIfChanged(set, get, {
          myListingsRows: [],
          listingsErrorMessage: "Could not load your listings.",
        });
      }
    } finally {
      listingsInflight = false;
      const genStillCurrent = genAtStart === loadGen;
      const runCoalesced = pendingCoalescedListings && genStillCurrent && get()._sessionUserId;
      pendingCoalescedListings = false;
      if (genStillCurrent) {
        patchIfChanged(set, get, {
          listingsLoading: false,
          myListingsInitialFetchDone: true,
        });
      }
      if (runCoalesced) {
        queueMicrotask(() => {
          if (get()._sessionUserId) void get().loadMyListings({ syncMetrics: false, quiet: true });
        });
      }
    }
  },

  /**
   * Overview-tab / route-return refresh: metrics counts only (active listings cap,
   * favorites, inquiries). Does not refetch `myListingsRows` — use `invalidate()` or
   * `loadMyListings` when the My Listings grid must reconcile with the server.
   */
  flushRefresh() {
    clearDebounceTimer();
    dirtyListingsRealtime = false;
    if (!get()._sessionUserId) return;
    if (get().myListingsInitialFetchDone) {
      applyListingMetricsFromRows(set, get, get().myListingsRows);
    }
    void get().loadMetrics({ quiet: true });
  },

  invalidate(opts = {}) {
    const { listings = true } = opts;
    clearDebounceTimer();
    dirtyListingsRealtime = false;
    if (!get()._sessionUserId) return;
    listingsTransientRetries = 0;
    patchIfChanged(set, get, { listingsQueryTerminal: false });
    if (listings) {
      void get().loadMyListings({ syncMetrics: true, quiet: true, force: true });
    } else {
      void get().loadMetrics({ quiet: true });
    }
  },

  /** Optimistic lifecycle patch — reconciled by the next `invalidate()` / refetch. */
  patchMyListingRow(listingId, patch) {
    const id = String(listingId ?? "");
    if (!id || !patch || typeof patch !== "object") return;
    const prev = get().myListingsRows;
    const idx = prev.findIndex((r) => String(r?.id) === id);
    if (idx === -1) return;
    const next = [...prev];
    next[idx] = { ...next[idx], ...patch };
    patchIfChanged(set, get, { myListingsRows: next });
    applyListingMetricsFromRows(set, get, next);
  },

  /** Optimistic remove (e.g. draft discard) — reconciled by the next refetch. */
  removeMyListingRow(listingId) {
    const id = String(listingId ?? "");
    if (!id) return;
    const prev = get().myListingsRows;
    const next = prev.filter((r) => String(r?.id) !== id);
    if (next.length === prev.length) return;
    patchIfChanged(set, get, { myListingsRows: next });
    applyListingMetricsFromRows(set, get, next);
  },
}));

export default useUserDashboardStore;
