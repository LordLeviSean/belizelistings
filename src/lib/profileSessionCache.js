/**
 * In-memory profile hydration session (cleared on logout / auth invalidation only).
 * Survives React child unmounts and dashboard `?tab=` shallow updates — tab switch must not refetch profiles.
 */

let hydratedUserId = null;
let cachedProfile = null;
let hydrated = false;
let inflight = null;
let inflightUserId = null;

export function isProfileHydratedForUser(userId) {
  return Boolean(userId && hydrated && hydratedUserId === userId);
}

export function getCachedProfileRow(userId) {
  if (!isProfileHydratedForUser(userId)) return null;
  return cachedProfile;
}

export function markProfileHydrated(userId, profileRow) {
  hydratedUserId = userId ? String(userId) : null;
  cachedProfile = profileRow ?? null;
  hydrated = Boolean(userId);
  inflight = null;
}

export function clearProfileSession() {
  hydratedUserId = null;
  cachedProfile = null;
  hydrated = false;
  inflight = null;
  inflightUserId = null;
}

/** Drop cached row for one user so the next hydrate hits the network. */
export function invalidateProfileHydration(userId) {
  const uid = userId ? String(userId) : "";
  if (!uid || hydratedUserId !== uid) return;
  hydrated = false;
  cachedProfile = null;
  inflight = null;
  inflightUserId = null;
}

/**
 * Coalesce parallel hydrate calls (bootstrap + INITIAL_SESSION, Strict Mode, etc.).
 * @param {string} userId
 * @param {() => Promise<object|null>} run
 */
export function runProfileHydrateOnce(userId, run) {
  const uid = userId ? String(userId) : "";
  if (!uid) {
    return Promise.resolve(null);
  }

  if (isProfileHydratedForUser(uid)) {
    return Promise.resolve(getCachedProfileRow(uid));
  }

  if (hydrated && hydratedUserId && hydratedUserId !== uid) {
    clearProfileSession();
  }

  if (inflight && inflightUserId === uid) {
    return inflight;
  }

  inflightUserId = uid;
  inflight = run()
    .then((row) => {
      if (inflightUserId === uid) {
        markProfileHydrated(uid, row);
      }
      return row;
    })
    .catch((err) => {
      inflight = null;
      inflightUserId = null;
      throw err;
    });
  return inflight;
}
