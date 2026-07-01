import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import { fetchUserOwnedListingsForDashboard } from "@/lib/listingQueries";
import { deriveUserDashboardListingCounts } from "@/lib/userDashboardListingTruth";
import { isTransientNetworkError, isTerminalDashboardCountError, isMissingTableError } from "@/lib/supabaseCompat";
import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_INQUIRIES } from "@/lib/featureFlags";
import { resolveUserDashboardListingCap } from "@/constants/dashboardAgentConfig";
import { countOwnerInboxUnread } from "@/lib/crm/conversationGrouping";
import { fetchConversationsForAgent } from "@/lib/crm/conversationMutations";
import { fetchInquiriesForAgent } from "@/lib/listingInquiries";
import { INQUIRY_STATUS } from "@/constants/inquiryModel";

const METRICS_DEBOUNCE_MS = 480;

function remainingFrom(cap, active) {
  const c = Number(cap) || 0;
  const a = Number(active) || 0;
  return Math.max(0, c - a);
}

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
  return Boolean(userId && get()._sessionUserId === String(userId) && realtimeChannel);
}

let loadGen = 0;
let metricsInflight = false;
let pendingCoalescedMetrics = false;
let listingsInflight = false;
let pendingCoalescedListings = false;
let realtimeChannel = null;
let debounceTimer = null;
let dirtyListingsRealtime = false;
let skipInq = !BL_ENABLE_INQUIRIES;
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

function teardownLive() {
  clearDebounceTimer();
  dirtyListingsRealtime = false;
  detachRealtimeInternal();
}

const useAgentDashboardStore = create((set, get) => ({
  activeListings: 0,
  pendingListings: 0,
  archivedListings: 0,
  draftListings: 0,
  rejectedListings: 0,
  inquiriesCount: 0,
  inquiriesRows: [],
  unreadInquiryCount: 0,
  listingCap: resolveUserDashboardListingCap(null),
  remainingListings: 0,
  myListingsRows: [],
  metricsLoading: false,
  listingsLoading: false,
  inquiriesLoading: false,
  myListingsInitialFetchDone: false,
  listingsErrorMessage: null,
  listingsQueryTerminal: false,
  inquiriesUnavailable: !BL_ENABLE_INQUIRIES,
  _sessionUserId: null,

  setTier(tier) {
    const listingCap = resolveUserDashboardListingCap(tier);
    const activeListings = get().activeListings;
    patchIfChanged(set, get, {
      listingCap,
      remainingListings: remainingFrom(listingCap, activeListings),
    });
  },

  init(userId, role) {
    if (!userId || role !== "agent") return;

    if (sessionIsLive(get, userId)) return;

    teardownLive();
    loadGen += 1;
    metricsInflight = false;
    pendingCoalescedMetrics = false;
    listingsInflight = false;
    pendingCoalescedListings = false;
    listingsTransientRetries = 0;
    skipInq = !BL_ENABLE_INQUIRIES;
    const cap = get().listingCap;

    set({
      _sessionUserId: userId,
      activeListings: 0,
      pendingListings: 0,
      archivedListings: 0,
      draftListings: 0,
      rejectedListings: 0,
      inquiriesCount: 0,
      inquiriesRows: [],
      unreadInquiryCount: 0,
      remainingListings: remainingFrom(cap, 0),
      myListingsRows: [],
      inquiriesUnavailable: !BL_ENABLE_INQUIRIES,
      listingsErrorMessage: null,
      listingsQueryTerminal: false,
      listingsLoading: true,
      myListingsInitialFetchDone: false,
    });

    get().attachRealtime(userId);
    void get().loadMyListings({ syncMetrics: true });
    void get().loadInquiries({ quiet: true });
    if (BL_ENABLE_CONVERSATIONS) void get().loadConversationInbox({ quiet: true });
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
      inquiriesRows: [],
      activeListings: 0,
      pendingListings: 0,
      archivedListings: 0,
      draftListings: 0,
      rejectedListings: 0,
      inquiriesCount: 0,
      unreadInquiryCount: 0,
      listingCap: resolveUserDashboardListingCap(null),
      remainingListings: 0,
      metricsLoading: false,
      listingsLoading: false,
      inquiriesLoading: false,
      myListingsInitialFetchDone: false,
      listingsErrorMessage: null,
      listingsQueryTerminal: false,
      inquiriesUnavailable: !BL_ENABLE_INQUIRIES,
    });
  },

  attachRealtime(userId) {
    detachRealtimeInternal();
    if (!userId) return;

    let channel = supabase
      .channel(`agent-dashboard-store-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings", filter: `user_id=eq.${userId}` },
        () => {
          dirtyListingsRealtime = true;
          get()._scheduleDebouncedRealtimeBatch();
        }
      );

    if (!skipInq) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listing_inquiries",
          filter: `agent_user_id=eq.${userId}`,
        },
        () => {
          get()._scheduleDebouncedRealtimeBatch();
        }
      );
    }

    if (BL_ENABLE_CONVERSATIONS) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `agent_id=eq.${userId}`,
        },
        () => {
          get()._scheduleDebouncedRealtimeBatch();
        }
      );
    }

    channel.subscribe();
    realtimeChannel = channel;
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
        void get().loadInquiries({ quiet: true });
        if (BL_ENABLE_CONVERSATIONS) void get().loadConversationInbox({ quiet: true });
      }
    }, METRICS_DEBOUNCE_MS);
  },

  async loadInquiries(opts = {}) {
    const { quiet = false } = opts;
    const uid = get()._sessionUserId;
    if (!uid || skipInq) return;

    if (!quiet) patchIfChanged(set, get, { inquiriesLoading: true });
    const genAtStart = loadGen;

    try {
      const { data, error } = await fetchInquiriesForAgent(supabase, uid, { limit: 100 });
      if (genAtStart !== loadGen || !get()._sessionUserId) return;

      if (error) {
        const terminal = isTerminalDashboardCountError(error) || isMissingTableError(error);
        patchIfChanged(set, get, {
          inquiriesRows: [],
          inquiriesCount: 0,
          unreadInquiryCount: 0,
        });
        if (terminal && !skipInq) {
          skipInq = true;
          patchIfChanged(set, get, { inquiriesUnavailable: true });
          get().attachRealtime(uid);
        }
        return;
      }

      const rows = data || [];
      const patch = {
        inquiriesRows: rows,
        inquiriesCount: rows.length,
      };
      if (BL_ENABLE_CONVERSATIONS) {
        void get().loadConversationInbox({ quiet: true });
      } else {
        patch.unreadInquiryCount = rows.filter(
          (q) => !q.read_at && q.status === INQUIRY_STATUS.NEW
        ).length;
      }
      patchIfChanged(set, get, patch);
    } finally {
      if (genAtStart === loadGen) {
        patchIfChanged(set, get, { inquiriesLoading: false });
      }
    }
  },

  async loadConversationInbox(opts = {}) {
    const { quiet = false } = opts;
    const uid = get()._sessionUserId;
    if (!uid || !BL_ENABLE_CONVERSATIONS) return;

    const genAtStart = loadGen;
    try {
      const { data, error } = await fetchConversationsForAgent(supabase, uid, { limit: 80 });
      if (genAtStart !== loadGen || !get()._sessionUserId) return;
      if (error) return;

      const unread = countOwnerInboxUnread(data || []);
      patchIfChanged(set, get, { unreadInquiryCount: unread });
    } finally {
      if (!quiet && genAtStart === loadGen) {
        /* reserved for future loading indicator */
      }
    }
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
    if (!quiet) patchIfChanged(set, get, { metricsLoading: true });

    try {
      applyListingMetricsFromRows(set, get, get().myListingsRows);
      if (!skipInq) void get().loadInquiries({ quiet: true });
    } finally {
      metricsInflight = false;
      const runCoalesced = pendingCoalescedMetrics && genAtStart === loadGen && get()._sessionUserId;
      pendingCoalescedMetrics = false;
      if (genAtStart === loadGen) {
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
      const rows = data || [];
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
      void get().loadInquiries({ quiet: true });
      if (BL_ENABLE_CONVERSATIONS) void get().loadConversationInbox({ quiet: true });
    }
  },

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

export default useAgentDashboardStore;
