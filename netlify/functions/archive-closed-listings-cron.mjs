/**
 * Netlify scheduled function — archives sold/rented listings after 48 hours.
 * Invokes /api/cron/archive-closed-listings with CRON_SECRET.
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

  const target = `${siteUrl.replace(/\/$/, "")}/api/cron/archive-closed-listings?limit=25`;
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
  schedule: "*/15 * * * *",
};
