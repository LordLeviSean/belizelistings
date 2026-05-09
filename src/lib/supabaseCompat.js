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
 * Best-effort parse of Postgres / PostgREST "column does not exist" errors.
 */
export function extractMissingColumnName(error) {
  const blob = collectErrorText(error);
  const patterns = [
    // PostgREST schema cache (message often on `message`, not `details`)
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

