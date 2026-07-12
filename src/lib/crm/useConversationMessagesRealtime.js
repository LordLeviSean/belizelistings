import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BL_ENABLE_CONVERSATIONS } from "@/lib/featureFlags";

/**
 * Subscribe to new messages in an open conversation thread.
 * @param {string|null|undefined} conversationId
 * @param {(row: object) => void} onInsert
 * @param {() => void} [onConversationUpdate] — refresh list previews when conversation row changes
 */
export function useConversationMessagesRealtime(conversationId, onInsert, onConversationUpdate) {
  useEffect(() => {
    if (!BL_ENABLE_CONVERSATIONS || !conversationId || !supabase?.channel) return undefined;

    const channel = supabase
      .channel(`crm-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload?.new) onInsert?.(payload.new);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        () => {
          onConversationUpdate?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, onInsert, onConversationUpdate]);
}
