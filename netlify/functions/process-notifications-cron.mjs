/**
 * Netlify scheduled function — processes notification queue every 5 minutes.
 * Invokes the Next.js API route with CRON_SECRET (server env).
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET;
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "https://belizelistings.bz";

  if (!secret) {
    return new Response(
      JSON.stringify({ ok: false, error: "CRON_SECRET not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const target = `${siteUrl.replace(/\/$/, "")}/api/cron/process-notifications?limit=25`;
  const res = await fetch(target, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config = {
  schedule: "*/5 * * * *",
};
