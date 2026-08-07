/**
 * Same-origin guard for authenticated push mutation routes.
 * @param {import('http').IncomingMessage} req
 */
export function isAuthorizedPushMutationRequest(req) {
  const allowedOrigins = new Set(
    [
      process.env.NEXT_PUBLIC_SITE_URL,
      "https://belizelistings.bz",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]
      .filter(Boolean)
      .map((value) => String(value).replace(/\/$/, ""))
  );

  const origin = String(req.headers.origin || "").replace(/\/$/, "");
  if (origin && allowedOrigins.has(origin)) {
    return true;
  }

  const referer = String(req.headers.referer || "");
  for (const allowed of allowedOrigins) {
    if (referer.startsWith(`${allowed}/`) || referer === allowed) {
      return true;
    }
  }

  return false;
}

/**
 * @param {import('http').IncomingMessage} req
 */
export function readBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}
