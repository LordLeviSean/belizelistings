/**
 * Browser client: persist viewing request via server API with immediate push delivery.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {object} payload
 * @returns {Promise<{ data: object|null, error: object|null, unavailable?: boolean }>}
 */
export async function submitViewingRequestViaApi(client, payload) {
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData?.session?.access_token ?? null;

  if (!token) {
    return {
      data: null,
      error: { message: "authentication_required", code: "authentication_required" },
    };
  }

  const res = await fetch("/api/crm/viewing-request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      listingId: payload.listingId,
      requestedDate: payload.requestedDate,
      requestedTime: payload.requestedTime,
      requesterName: payload.requesterName ?? null,
      requesterEmail: payload.requesterEmail ?? null,
      listingTitle: payload.listingTitle ?? null,
      message: payload.message ?? null,
      notes: payload.notes ?? null,
      timezone: payload.timezone ?? null,
    }),
  });

  let responseBody = {};
  try {
    responseBody = await res.json();
  } catch {
    responseBody = {};
  }

  if (!res.ok) {
    return {
      data: null,
      error: {
        message: responseBody.error || responseBody.message || "Could not schedule viewing.",
        code: responseBody.code,
      },
    };
  }

  return {
    data: responseBody.data ?? responseBody,
    error: null,
  };
}
