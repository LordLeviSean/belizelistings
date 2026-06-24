function collectErrorText(error, depth = 0) {
  if (!error || depth > 4) return "";
  const parts = [];
  if (typeof error === "string") parts.push(error);
  else {
    parts.push(
      error.message,
      error.details,
      error.hint,
      error.description,
      error.code && String(error.code)
    );
    if (error.cause) parts.push(collectErrorText(error.cause, depth + 1));
  }
  return parts.filter(Boolean).join(" | ");
}

export function isMissingColumnError(error) {
  const blob = collectErrorText(error);
  const code = String(error?.code ?? "");
  // PostgreSQL undefined_column; PostgREST often surfaces this for unknown filter fields.
  if (code === "42703") return true;
  const schemaCacheUnknown =
    /Could not find the/i.test(blob) && /schema cache/i.test(blob);
  return (
    schemaCacheUnknown ||
    (/column/i.test(blob) &&
      (/does not exist/i.test(blob) ||
        /Could not find the/i.test(blob) ||
        /undefined column/i.test(blob) ||
        /unknown column/i.test(blob)))
  );
}

/** Embed/select failed: no FK in schema cache between listings and related table. */
export function isMissingRelationshipError(error) {
  const blob = collectErrorText(error);
  return (
    /Could not find (a|the)/i.test(blob) &&
    /relationship/i.test(blob) &&
    /schema cache/i.test(blob)
  );
}

/**
 * Table not exposed to PostgREST, wrong resource path, or relation missing.
 * Distinct from {@link isMissingColumnError}: "Could not find the table …" is not a column error.
 */
export function isMissingTableError(error) {
  if (!error) return false;
  const blob = collectErrorText(error);
  const code = String(error?.code ?? "");
  if (code === "PGRST205" || code === "42P01") return true;
  if (/Could not find the table/i.test(blob)) return true;
  if (/relation\s+["'`]?[^"'`\s]+["'`]?\s+does\s+not\s+exist/i.test(blob)) return true;
  const status = Number(error?.status ?? error?.statusCode ?? NaN);
  if (status === 404) return true;
  return false;
}

/** SELECT count: no privilege / explicit forbid — retrying the same shape will not help. */
export function isPermissionDeniedCountError(error) {
  if (!error) return false;
  const code = String(error?.code ?? "");
  if (code === "42501") return true;
  const status = Number(error?.status ?? error?.statusCode ?? NaN);
  if (status === 403) return true;
  const blob = collectErrorText(error);
  if (/permission denied for (table|relation)/i.test(blob)) return true;
  if (/must be owner of (table|relation)/i.test(blob)) return true;
  return false;
}

/**
 * PostgREST / filter issues where retrying the same shape will not recover (open a circuit).
 */
export function isTerminalDashboardCountError(error) {
  if (!error) return false;
  return (
    isMissingColumnError(error) ||
    isMissingTableError(error) ||
    isMissingRelationshipError(error) ||
    isPermissionDeniedCountError(error)
  );
}

/** Alias: SELECT/embed failures that should not be retried in a loop. */
export function isTerminalListingQueryError(error) {
  return isTerminalDashboardCountError(error);
}

/**
 * INSERT/UPDATE errors where stripping columns will not help (RLS, validation, malformed contract).
 * Missing-column/schema-cache errors are recoverable via strip — not terminal here.
 */
export function isNonRecoverableMutationError(error) {
  if (!error) return false;
  if (isMissingColumnError(error)) return false;
  if (isPermissionDeniedCountError(error)) return true;
  const code = String(error?.code ?? "");
  if (code === "23505" || code === "23514" || code === "23502" || code === "PGRST204") return true;
  const status = Number(error?.status ?? error?.statusCode ?? NaN);
  if (status === 400 || status === 403 || status === 404 || status === 409 || status === 422) {
    return true;
  }
  const blob = collectErrorText(error);
  if (/violates row-level security/i.test(blob)) return true;
  if (/invalid input syntax/i.test(blob)) return true;
  return false;
}

/** Transient network / gateway — safe to retry reads sparingly. */
export function isTransientNetworkError(error) {
  if (!error) return false;
  if (isTerminalListingQueryError(error) || isNonRecoverableMutationError(error)) return false;
  const status = Number(error?.status ?? error?.statusCode ?? NaN);
  if (status === 408 || status === 429 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const blob = collectErrorText(error);
  if (/fetch failed/i.test(blob) || /network/i.test(blob) || /ECONNRESET/i.test(blob)) {
    return true;
  }
  return false;
}

/**
 * Best-effort parse of Postgres / PostgREST "column does not exist" errors.
 */
export function extractMissingColumnName(error) {
  const blob = collectErrorText(error);
  const patterns = [
    // PostgREST schema cache (message often on `message`, not `details`)
    /Could not find the '([^']+)' column of ['"]profiles['"]/i,
    /Could not find the "([^"]+)" column of ['"]profiles['"]/i,
    /Could not find the '([^']+)' column of ['"]listings['"]/i,
    /Could not find the "([^"]+)" column of ['"]listings['"]/i,
    /Could not find the `([^`]+)` column of [`']listings[`']/i,
    /Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column of ['"]listings['"]/i,
    /Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i,
    /column\s+["']([a-zA-Z0-9_]+)["']\s+of\s+relation/i,
    /column\s+["']?([a-zA-Z0-9_]+)["']?\s+does\s+not\s+exist/i,
    /['"]([a-zA-Z0-9_]+)['"]\s+column.*does not exist/i,
  ];
  for (const re of patterns) {
    const m = blob.match(re);
    if (m?.[1]) return m[1];
  }
  return "";
}

