/**
 * Capture PostgREST / Supabase client errors without losing fields.
 * Use when 400s persist after minimal payloads (RLS, CHECK, triggers, enum).
 */

const verboseDiag =
  typeof process === "undefined" || process.env.NODE_ENV !== "production";

function safeJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    try {
      return String(value);
    } catch {
      return "[unserializable]";
    }
  }
}

function collectKeys(obj) {
  if (!obj || typeof obj !== "object") return [];
  return [...new Set([...Object.keys(obj), ...Object.getOwnPropertyNames(obj)])];
}

/**
 * Plain snapshot suitable for console + copy/paste (no functions).
 */
export function snapshotSupabaseError(error) {
  if (error == null) return { value: null };
  if (typeof error !== "object") return { value: error };

  const out = { _constructor: error.constructor?.name || typeof error };

  for (const key of collectKeys(error)) {
    if (key === "stack") {
      out.stack = error.stack;
      continue;
    }
    try {
      const v = error[key];
      if (typeof v === "function") continue;
      if (v && typeof v === "object") {
        out[key] = safeJson(v);
      } else {
        out[key] = v;
      }
    } catch {
      out[key] = "[unreadable]";
    }
  }

  if (error.cause) {
    out.cause = snapshotSupabaseError(error.cause);
  }

  return out;
}

/**
 * Logs the error reference (expand in DevTools) plus a serializable snapshot.
 * In production: one-line warning only; no window globals.
 */
export function logRawSupabaseError(tag, error, extra = {}) {
  if (!verboseDiag) {
    if (error && typeof console !== "undefined" && console.warn) {
      console.warn(`[supabase] ${tag}`, error?.message || error?.details || String(error));
    }
    return { tag, production: true };
  }

  const snapshot = snapshotSupabaseError(error);
  const payload = {
    tag,
    at: new Date().toISOString(),
    extra,
    snapshot,
    errorRef: error,
  };

  const useWarn = extra.logLevel === "warn" || extra.consoleLevel === "warn";
  const label = useWarn ? `[supabase-raw-warn:${tag}]` : `[supabase-raw-error:${tag}]`;
  const logFn = useWarn && typeof console !== "undefined" && console.warn ? console.warn : console.error;
  logFn(label, payload);

  if (typeof window !== "undefined" && !useWarn) {
    window.__BL_LAST_RAW_SUPABASE_ERROR = payload;
  }

  return payload;
}

/**
 * Log full Supabase .update() / .insert() return shape (data, error, status, etc.).
 * In production: warn only when result.error is set.
 */
export function logSupabaseMutationResult(tag, result, extra = {}) {
  if (!verboseDiag) {
    const err = result?.error;
    if (err && typeof console !== "undefined" && console.warn) {
      console.warn(`[supabase] ${tag}`, err?.message || err?.details || String(err));
    }
    return { tag, production: true };
  }

  const r = result || {};
  const summary = {
    tag,
    at: new Date().toISOString(),
    extra,
    keys: collectKeys(r),
    data: r.data,
    error: snapshotSupabaseError(r.error),
    count: r.count,
    status: r.status,
    statusText: r.statusText,
    details: r.details,
    hint: r.hint,
    code: r.code,
    rawResultRef: r,
  };
  console.error(`[supabase-mutation-result:${tag}]`, summary);
  if (typeof window !== "undefined") {
    window.__BL_LAST_SUPABASE_MUTATION_RESULT = summary;
  }
  return summary;
}
