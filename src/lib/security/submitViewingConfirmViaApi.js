/**
 * Browser client: confirm viewing via server API with immediate push delivery.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ viewingId: string, agentUserId: string, notes?: string|null }} params
 * @returns {Promise<{ data: object|null, error: object|null, queueId?: string|null }>}
 */
export async function submitViewingConfirmViaApi(client, { viewingId, agentUserId, notes }) {
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData?.session?.access_token ?? null;

  if (!token) {
    return {
      data: null,
      error: { message: "authentication_required", code: "authentication_required" },
      queueId: null,
    };
  }

  const res = await fetch("/api/crm/viewing-confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      viewingId,
      agentUserId,
      notes: notes ?? null,
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
        message: responseBody.error || responseBody.message || "Could not confirm viewing.",
        code: responseBody.code,
      },
      queueId: null,
    };
  }

  return {
    data: responseBody.data ?? responseBody,
    error: null,
    queueId: responseBody.data?.queueId ?? responseBody.queueId ?? null,
  };
}
