/**
 * Buyer inbox reply via server API (immediate notification + push delivery).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ conversationId: string, body: string, listingId?: string|number|null, listingTitle?: string|null, senderName?: string|null }} params
 * @returns {Promise<{ data: object | null, error: { message: string, code?: string } | null }>}
 */
export async function submitBuyerReplyViaApi(client, { conversationId, body, listingId, listingTitle, senderName }) {
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData?.session?.access_token ?? null;

  if (!token) {
    return {
      data: null,
      error: { message: "authentication_required", code: "authentication_required" },
    };
  }

  const res = await fetch("/api/crm/buyer-reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      conversationId,
      body,
      listingId: listingId ?? null,
      listingTitle: listingTitle ?? null,
      senderName: senderName ?? null,
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
        message: responseBody.error || responseBody.message || "Could not send message.",
        code: responseBody.code,
      },
    };
  }

  return { data: responseBody.data ?? responseBody, error: null };
}
