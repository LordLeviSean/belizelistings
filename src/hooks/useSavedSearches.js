import { useCallback, useMemo, useState } from "react";
import {
  generateSavedSearchLabel,
  normalizeRouterQueryToFilters,
} from "../utils/savedSearchUtils";

const STORAGE_KEY = "belize_saved_searches_v2";
const LEGACY_KEY = "savedSearches";

/**
 * @typedef {object} SavedSearchFilters
 * @property {'all'|'for-sale'|'rent'} status
 * @property {number|null} [minPrice]
 * @property {number|null} [maxPrice]
 * @property {number|null} [beds]
 * @property {number|null} [baths]
 */

/**
 * @typedef {object} SavedSearch
 * @property {string} id
 * @property {number} createdAt
 * @property {SavedSearchFilters} filters
 * @property {string} label
 */

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function readRaw() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return tryMigrateLegacy();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function tryMigrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const migrated = parsed
      .map((e) => migrateLegacyEntry(e))
      .filter(Boolean);
    if (migrated.length) {
      writeRaw(migrated);
      localStorage.removeItem(LEGACY_KEY);
    }
    return migrated;
  } catch {
    return [];
  }
}

/** @param {any} e */
function migrateLegacyEntry(e) {
  if (!e || typeof e !== "object") return null;
  if (e.id && e.filters) return normalizeEntry(e);
  const query = e.query || {};
  const filters = normalizeRouterQueryToFilters(query);
  return {
    id: typeof e.id === "string" ? e.id : newId(),
    createdAt:
      typeof e.createdAt === "number"
        ? e.createdAt
        : Date.parse(e.createdAt) || Date.now(),
    filters,
    label: generateSavedSearchLabel(filters),
  };
}

/** @param {any} e */
function normalizeEntry(e) {
  const filters = {
    status: e.filters?.status ?? "all",
    minPrice: e.filters?.minPrice ?? null,
    maxPrice: e.filters?.maxPrice ?? null,
    beds: e.filters?.beds ?? null,
    baths: e.filters?.baths ?? null,
  };
  return {
    id: String(e.id),
    createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
    filters,
    label: typeof e.label === "string" ? e.label : generateSavedSearchLabel(filters),
  };
}

function writeRaw(list) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/**
 * Always returns an array of saved searches (newest first).
 * @returns {SavedSearch[]}
 */
export function getSavedSearches() {
  const raw = readRaw();
  return raw.map((e) => normalizeEntry(e)).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * @param {SavedSearchFilters} filters
 * @returns {SavedSearch}
 */
export function saveSearch(filters) {
  const normalized = {
    status: filters.status || "all",
    minPrice: filters.minPrice ?? null,
    maxPrice: filters.maxPrice ?? null,
    beds: filters.beds ?? null,
    baths: filters.baths ?? null,
  };
  const entry = {
    id: newId(),
    createdAt: Date.now(),
    filters: normalized,
    label: generateSavedSearchLabel(normalized),
  };
  const list = getSavedSearches();
  writeRaw([entry, ...list]);
  return entry;
}

/**
 * @param {string} id
 */
export function deleteSearch(id) {
  const list = getSavedSearches().filter((x) => x.id !== id);
  writeRaw(list);
  clearAlertStateForSearch(id);
}

/**
 * @param {string} id
 * @param {Partial<{ filters: SavedSearchFilters; label: string }>} updates
 */
export function updateSearch(id, updates) {
  const list = getSavedSearches();
  const next = list.map((e) => {
    if (e.id !== id) return e;
    const filters = updates.filters ? { ...e.filters, ...updates.filters } : e.filters;
    const label =
      updates.label != null
        ? updates.label
        : updates.filters
          ? generateSavedSearchLabel(filters)
          : e.label;
    return { ...e, filters, label };
  });
  writeRaw(next);
}

function clearAlertStateForSearch(searchId) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("belize_alert_last_seen");
    if (!raw) return;
    const o = JSON.parse(raw);
    if (o && typeof o === "object" && searchId in o) {
      delete o[searchId];
      localStorage.setItem("belize_alert_last_seen", JSON.stringify(o));
    }
  } catch {
    /* ignore */
  }
}

/**
 * React hook: saved searches + mutators (re-renders on change).
 */
export default function useSavedSearches() {
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const savedSearches = useMemo(() => {
    void version;
    return getSavedSearches();
  }, [version]);

  const save = useCallback(
    (filters) => {
      const entry = saveSearch(filters);
      refresh();
      return entry;
    },
    [refresh]
  );

  const remove = useCallback(
    (id) => {
      deleteSearch(id);
      refresh();
    },
    [refresh]
  );

  const update = useCallback(
    (id, updates) => {
      updateSearch(id, updates);
      refresh();
    },
    [refresh]
  );

  return {
    savedSearches,
    saveSearch: save,
    deleteSearch: remove,
    updateSearch: update,
    refresh,
  };
}
